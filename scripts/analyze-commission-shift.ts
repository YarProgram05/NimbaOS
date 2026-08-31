import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { calculateReport } from '@/lib/services/report-calculator'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { SYNC_JOB_KINDS } from '@/types/sync'

const PERIODS = [
  { id: 'july', label: '1–12 июля 2026', from: '2026-07-01', to: '2026-07-12' },
  { id: 'august', label: '1–12 августа 2026', from: '2026-08-01', to: '2026-08-12' },
] as const

const LOCAL_REPORT_OPTIONS = {
  preferPersistedAdStats: true,
  preferLiveAdCostTotals: false,
}

const DOC_SALE = 'Продажа'
const DOC_RETURN = 'Возврат'

const SOURCE_SQL = `
SELECT
  rr."rrdId"::text AS "rrdId",
  rr."rrDt"::date::text AS "rrDt",
  rr."dateFrom"::date::text AS "dateFrom",
  rr."dateTo"::date::text AS "dateTo",
  rr."nmId",
  rr."vendorCode",
  rr."docTypeName",
  rr.quantity,
  rr."retailPriceWithDisc"::double precision AS "retailPriceWithDisc",
  rr."ppvzSppPrc"::double precision AS "ppvzSppPrc",
  rr."commissionPercent"::double precision AS "commissionPercent",
  rr."ppvzSalesCommission"::double precision AS "ppvzSalesCommission"
FROM realization_reports rr
JOIN wb_accounts wa ON wa.id = rr."wbAccountId"
WHERE wa.name = 'WB Nimba (WB_1)'
  AND (
    rr."rrDt" BETWEEN DATE '2026-07-01' AND DATE '2026-07-12'
    OR rr."rrDt" BETWEEN DATE '2026-08-01' AND DATE '2026-08-12'
    OR (
      rr."rrDt" IS NULL
      AND (
        (rr."dateFrom" <= DATE '2026-07-12' AND rr."dateTo" >= DATE '2026-07-01')
        OR (rr."dateFrom" <= DATE '2026-08-12' AND rr."dateTo" >= DATE '2026-08-01')
      )
    )
  )
ORDER BY COALESCE(rr."rrDt", rr."dateFrom"), rr."rrdId";
`.trim()

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function num(value: unknown) {
  if (value == null || value === '') return 0
  return Number(value)
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier
}

function pct(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : round((numerator / denominator) * 100, 4)
}

function dayKey(value: Date | null, fallback: Date) {
  return (value ?? fallback).toISOString().slice(0, 10)
}

async function analyzePeriod(account: { id: string; name: string; lastSyncAt: Date | null }, period: typeof PERIODS[number]) {
  const from = date(period.from)
  const to = date(period.to)

  const [report, coverage, rows, coverageRows, recentJobs] = await Promise.all([
    calculateReport(account.id, period.from, period.to, LOCAL_REPORT_OPTIONS),
    getSyncCoverage(account.id, SYNC_JOB_KINDS.REPORTS_PERIOD, period.from, period.to),
    prisma.realizationReport.findMany({
      where: {
        wbAccountId: account.id,
        OR: [
          { rrDt: { gte: from, lte: to } },
          { rrDt: null, dateFrom: { lte: to }, dateTo: { gte: from } },
        ],
      },
      select: {
        rrdId: true,
        realizationReportId: true,
        rrDt: true,
        dateFrom: true,
        dateTo: true,
        fetchedAt: true,
        nmId: true,
        vendorCode: true,
        docTypeName: true,
        supplierOperName: true,
        quantity: true,
        retailPriceWithDisc: true,
        ppvzSppPrc: true,
        ppvzSalesCommission: true,
        commissionPercent: true,
        ppvzForPay: true,
      },
    }),
    prisma.syncDataCoverage.findMany({
      where: {
        wbAccountId: account.id,
        kind: 'REPORTS_PERIOD',
        dateTo: { gte: from },
        dateFrom: { lte: to },
      },
      select: { dateFrom: true, dateTo: true, syncedAt: true },
      orderBy: [{ dateFrom: 'asc' }, { dateTo: 'asc' }],
    }),
    prisma.syncJobRun.findMany({
      where: {
        wbAccountId: account.id,
        kind: 'REPORTS_PERIOD',
        createdAt: { gte: new Date(from.getTime() - 45 * 24 * 60 * 60 * 1000) },
      },
      select: { status: true, createdAt: true, finishedAt: true, error: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const sales = rows.filter((row) => row.docTypeName === DOC_SALE)
  const returns = rows.filter((row) => row.docTypeName === DOC_RETURN)
  const saleCommission = sales.reduce((sum, row) => sum + num(row.ppvzSalesCommission), 0)
  const returnCommission = returns.reduce((sum, row) => sum + num(row.ppvzSalesCommission), 0)
  const rawNetCommission = saleCommission - returnCommission
  const saleBase = sales.reduce((sum, row) => sum + num(row.retailPriceWithDisc), 0)
  const returnBase = returns.reduce((sum, row) => sum + num(row.retailPriceWithDisc), 0)
  const netRetailNoSpp = saleBase - returnBase

  const daily = new Map<string, { day: string; commission: number; saleCommission: number; returnCommission: number; saleRetailNoSpp: number; returnRetailNoSpp: number; saleQty: number; returnQty: number; rowCount: number }>()
  const article = new Map<string, { nmId: number; vendorCode: string; commission: number; saleCommission: number; returnCommission: number; saleRetailNoSpp: number; returnRetailNoSpp: number; saleKvvWeighted: number; saleSppWeighted: number; saleQty: number; returnQty: number; rowCount: number }>()
  const rate = new Map<string, { commissionPercent: number; commission: number; saleRetailNoSpp: number; saleQty: number; saleRows: number }>()
  const operation = new Map<string, { operation: string; commission: number; rowCount: number; quantity: number }>()

  for (const row of rows) {
    const day = dayKey(row.rrDt, row.dateFrom)
    const dailyRow = daily.get(day) ?? { day, commission: 0, saleCommission: 0, returnCommission: 0, saleRetailNoSpp: 0, returnRetailNoSpp: 0, saleQty: 0, returnQty: 0, rowCount: 0 }
    dailyRow.rowCount += 1

    const articleKey = `${row.nmId}:${row.vendorCode}`
    const articleRow = article.get(articleKey) ?? { nmId: row.nmId, vendorCode: row.vendorCode, commission: 0, saleCommission: 0, returnCommission: 0, saleRetailNoSpp: 0, returnRetailNoSpp: 0, saleKvvWeighted: 0, saleSppWeighted: 0, saleQty: 0, returnQty: 0, rowCount: 0 }
    articleRow.rowCount += 1

    const commission = num(row.ppvzSalesCommission)
    const retail = num(row.retailPriceWithDisc)
    if (row.docTypeName === DOC_SALE) {
      dailyRow.commission += commission
      dailyRow.saleCommission += commission
      dailyRow.saleRetailNoSpp += retail
      dailyRow.saleQty += row.quantity
      articleRow.commission += commission
      articleRow.saleCommission += commission
      articleRow.saleRetailNoSpp += retail
      articleRow.saleKvvWeighted += num(row.commissionPercent) * retail
      articleRow.saleSppWeighted += num(row.ppvzSppPrc) * retail
      articleRow.saleQty += row.quantity

      const commissionPercent = num(row.commissionPercent)
      const rateKey = commissionPercent.toFixed(2)
      const rateRow = rate.get(rateKey) ?? { commissionPercent, commission: 0, saleRetailNoSpp: 0, saleQty: 0, saleRows: 0 }
      rateRow.commission += commission
      rateRow.saleRetailNoSpp += retail
      rateRow.saleQty += row.quantity
      rateRow.saleRows += 1
      rate.set(rateKey, rateRow)
    } else if (row.docTypeName === DOC_RETURN) {
      dailyRow.commission -= commission
      dailyRow.returnCommission += commission
      dailyRow.returnRetailNoSpp += retail
      dailyRow.returnQty += row.quantity
      articleRow.commission -= commission
      articleRow.returnCommission += commission
      articleRow.returnRetailNoSpp += retail
      articleRow.returnQty += row.quantity
    }
    daily.set(day, dailyRow)
    article.set(articleKey, articleRow)

    if (commission !== 0) {
      const opKey = `${row.docTypeName} / ${row.supplierOperName ?? 'без операции'}`
      const opRow = operation.get(opKey) ?? { operation: opKey, commission: 0, rowCount: 0, quantity: 0 }
      opRow.commission += row.docTypeName === DOC_RETURN ? -commission : commission
      opRow.rowCount += 1
      opRow.quantity += row.quantity
      operation.set(opKey, opRow)
    }
  }

  const reportCommission = num(report.summary.commission)

  return {
    period,
    coverage: {
      serviceCovered: coverage.isCovered,
      serviceSyncedAt: coverage.syncedAt,
      reportCovered: report.coverage.isCovered,
      reportSyncedAt: report.coverage.syncedAt,
      accountLastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      coverageRows: coverageRows.map((row) => ({
        dateFrom: row.dateFrom.toISOString().slice(0, 10),
        dateTo: row.dateTo.toISOString().slice(0, 10),
        syncedAt: row.syncedAt.toISOString(),
      })),
      recentJobs: recentJobs.map((job) => ({
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        hasError: Boolean(job.error),
      })),
    },
    quality: {
      rowCount: rows.length,
      distinctRrdIdCount: new Set(rows.map((row) => row.rrdId.toString())).size,
      distinctReportCount: new Set(rows.map((row) => row.realizationReportId.toString())).size,
      minOperationDate: rows.length ? rows.reduce((min, row) => dayKey(row.rrDt, row.dateFrom) < min ? dayKey(row.rrDt, row.dateFrom) : min, dayKey(rows[0].rrDt, rows[0].dateFrom)) : null,
      maxOperationDate: rows.length ? rows.reduce((max, row) => dayKey(row.rrDt, row.dateFrom) > max ? dayKey(row.rrDt, row.dateFrom) : max, dayKey(rows[0].rrDt, rows[0].dateFrom)) : null,
      minFetchedAt: rows.length ? new Date(Math.min(...rows.map((row) => row.fetchedAt.getTime()))).toISOString() : null,
      maxFetchedAt: rows.length ? new Date(Math.max(...rows.map((row) => row.fetchedAt.getTime()))).toISOString() : null,
      reportVsRawCommissionDifference: round(reportCommission - rawNetCommission),
    },
    summary: {
      commission: reportCommission,
      commissionOnSale: num(report.summary.commissionOnSale),
      commissionOnReturn: num(report.summary.commissionOnReturn),
      rawNetCommission: round(rawNetCommission),
      sale: num(report.summary.sale),
      salesWithSpp: num(report.summary.salesWithSpp),
      returnsWithSpp: num(report.summary.returnsWithSpp),
      salesNoSpp: num(report.summary.salesNoSpp),
      returnsNoSpp: num(report.summary.returnsNoSpp),
      netRetailNoSpp: round(netRetailNoSpp),
      commissionToNetRetailNoSppPct: pct(rawNetCommission, netRetailNoSpp),
      boughtWithReturns: report.summary.boughtWithReturns,
      boughtWithoutReturns: report.summary.boughtWithoutReturns,
      returns: report.summary.returns,
      rowsSale: sales.length,
      rowsReturn: returns.length,
      quantitySale: sales.reduce((sum, row) => sum + row.quantity, 0),
      quantityReturn: returns.reduce((sum, row) => sum + row.quantity, 0),
      commissionPerNetUnit: report.summary.boughtWithReturns === 0 ? 0 : round(rawNetCommission / report.summary.boughtWithReturns),
      weightedSaleSppPct: saleBase === 0 ? 0 : round(sales.reduce((sum, row) => sum + num(row.ppvzSppPrc) * num(row.retailPriceWithDisc), 0) / saleBase, 4),
      averageSaleCommissionPctFieldWeightedByRetail: saleBase === 0 ? 0 : round(sales.reduce((sum, row) => sum + num(row.commissionPercent) * num(row.retailPriceWithDisc), 0) / saleBase, 4),
    },
    daily: Array.from(daily.values()).sort((a, b) => a.day.localeCompare(b.day)).map((row) => ({
      ...row,
      commission: round(row.commission),
      saleCommission: round(row.saleCommission),
      returnCommission: round(row.returnCommission),
      saleRetailNoSpp: round(row.saleRetailNoSpp),
      returnRetailNoSpp: round(row.returnRetailNoSpp),
      commissionRatePct: pct(row.commission, row.saleRetailNoSpp - row.returnRetailNoSpp),
    })),
    commissionRates: Array.from(rate.values()).sort((a, b) => b.commission - a.commission).map((row) => ({
      ...row,
      commission: round(row.commission),
      saleRetailNoSpp: round(row.saleRetailNoSpp),
      realizedRatePct: pct(row.commission, row.saleRetailNoSpp),
    })),
    operations: Array.from(operation.values()).sort((a, b) => Math.abs(b.commission) - Math.abs(a.commission)).map((row) => ({ ...row, commission: round(row.commission) })),
    articles: Array.from(article.values()).sort((a, b) => b.commission - a.commission).map((row) => ({
      ...row,
      commission: round(row.commission),
      saleCommission: round(row.saleCommission),
      returnCommission: round(row.returnCommission),
      saleRetailNoSpp: round(row.saleRetailNoSpp),
      returnRetailNoSpp: round(row.returnRetailNoSpp),
      weightedKvvPct: row.saleRetailNoSpp === 0 ? 0 : round(row.saleKvvWeighted / row.saleRetailNoSpp, 4),
      weightedSppPct: row.saleRetailNoSpp === 0 ? 0 : round(row.saleSppWeighted / row.saleRetailNoSpp, 4),
      commissionRatePct: pct(row.commission, row.saleRetailNoSpp - row.returnRetailNoSpp),
    })),
  }
}

async function main() {
  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true, name: true, lastSyncAt: true },
    orderBy: { name: 'asc' },
  })

  const output = []
  for (const account of accounts) {
    const periods = []
    for (const period of PERIODS) periods.push(await analyzePeriod(account, period))
    output.push({
      account: { id: account.id, name: account.name },
      periods,
    })
  }

  const sqlRows = await prisma.$queryRawUnsafe<Array<{ rrdId: string }>>(SOURCE_SQL)

  const outputDir = path.join(process.cwd(), 'output', 'analysis')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'commission_shift_2026-07-01_12_vs_2026-08-01_12.json')
  fs.writeFileSync(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceSql: SOURCE_SQL,
    sqlVerification: {
      rowCount: sqlRows.length,
      distinctRrdIdCount: new Set(sqlRows.map((row) => row.rrdId)).size,
    },
    accounts: output,
  }, null, 2), 'utf8')
  console.log(outputPath)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
