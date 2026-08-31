import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { calculateReport } from '@/lib/services/report-calculator'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { SYNC_JOB_KINDS } from '@/types/sync'

const ACCOUNT_NAME = 'WB Galioni (WB_2)'
const DATE_FROM = '2026-04-01'
const DATE_TO = '2026-04-30'
const DOC_SALE = 'Продажа'
const DOC_RETURN = 'Возврат'

const SOURCE_SQL = `
SELECT rr."rrdId", rr."rrDt", rr."docTypeName", rr."supplierOperName",
       rr."nmId", rr."vendorCode", rr.quantity,
       rr."retailPriceWithDisc", rr."ppvzSppPrc", rr."ppvzForPay",
       rr."commissionPercent", rr."ppvzSalesCommission",
       rr."deliveryRub", rr."storageFee", rr.penalty, rr.deduction,
       rr."additionalPayment", rr.acceptance
FROM realization_reports rr
JOIN wb_accounts wa ON wa.id = rr."wbAccountId"
WHERE wa.name = 'WB Galioni (WB_2)'
  AND (
    rr."rrDt" BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
    OR (rr."rrDt" IS NULL AND rr."dateFrom" <= DATE '2026-04-30' AND rr."dateTo" >= DATE '2026-04-01')
  )
ORDER BY COALESCE(rr."rrDt", rr."dateFrom"), rr."rrdId";
`.trim()

function num(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

async function main() {
  const account = await prisma.wbAccount.findFirstOrThrow({
    where: { name: ACCOUNT_NAME },
    select: { id: true, name: true, lastSyncAt: true },
  })

  const [report, coverage, rows] = await Promise.all([
    calculateReport(account.id, DATE_FROM, DATE_TO, {
      preferPersistedAdStats: true,
      preferLiveAdCostTotals: false,
    }),
    getSyncCoverage(account.id, SYNC_JOB_KINDS.REPORTS_PERIOD, DATE_FROM, DATE_TO),
    prisma.realizationReport.findMany({
      where: {
        wbAccountId: account.id,
        OR: [
          { rrDt: { gte: new Date(DATE_FROM), lte: new Date(DATE_TO) } },
          {
            rrDt: null,
            dateFrom: { lte: new Date(DATE_TO) },
            dateTo: { gte: new Date(DATE_FROM) },
          },
        ],
      },
      select: {
        rrdId: true,
        rrDt: true,
        dateFrom: true,
        docTypeName: true,
        supplierOperName: true,
        nmId: true,
        vendorCode: true,
        quantity: true,
        retailPriceWithDisc: true,
        ppvzSppPrc: true,
        ppvzForPay: true,
        commissionPercent: true,
        ppvzSalesCommission: true,
        deliveryRub: true,
        storageFee: true,
        penalty: true,
        deduction: true,
        additionalPayment: true,
        acceptance: true,
      },
      orderBy: [{ rrDt: 'asc' }, { rrdId: 'asc' }],
    }),
  ])

  const operationMap = new Map<string, { rows: number; quantity: number; commissionImpact: number; rawCommission: number }>()
  const dailyMap = new Map<string, { saleCommission: number; returnCommission: number; netCommission: number; sales: number; returns: number }>()
  const articleMap = new Map<string, { nmId: number; vendorCode: string; saleCommission: number; returnCommission: number; netCommission: number; saleQty: number; returnQty: number }>()

  let saleCommission = 0
  let returnCommission = 0
  let otherCommissionImpact = 0
  let saleRowsWithNegativeCommission = 0
  let returnRowsWithNegativeCommission = 0
  let saleRetailBase = 0
  let saleWeightedKvv = 0
  let saleWeightedPlatformDiscount = 0

  for (const row of rows) {
    const rawCommission = num(row.ppvzSalesCommission)
    const isSale = row.docTypeName === DOC_SALE
    const isReturn = row.docTypeName === DOC_RETURN
    const impact = isReturn ? -rawCommission : rawCommission
    const operation = `${row.docTypeName || 'без типа'} / ${row.supplierOperName || 'без операции'}`
    const op = operationMap.get(operation) ?? { rows: 0, quantity: 0, commissionImpact: 0, rawCommission: 0 }
    op.rows += 1
    op.quantity += row.quantity
    op.commissionImpact += impact
    op.rawCommission += rawCommission
    operationMap.set(operation, op)

    if (isSale) {
      saleCommission += rawCommission
      if (rawCommission < 0) saleRowsWithNegativeCommission += 1
      const retailBase = num(row.retailPriceWithDisc)
      saleRetailBase += retailBase
      saleWeightedKvv += num(row.commissionPercent) * retailBase
      saleWeightedPlatformDiscount += num(row.ppvzSppPrc) * retailBase
    } else if (isReturn) {
      returnCommission += rawCommission
      if (rawCommission < 0) returnRowsWithNegativeCommission += 1
    } else {
      otherCommissionImpact += rawCommission
    }

    const date = (row.rrDt ?? row.dateFrom).toISOString().slice(0, 10)
    const daily = dailyMap.get(date) ?? { saleCommission: 0, returnCommission: 0, netCommission: 0, sales: 0, returns: 0 }
    if (isSale) {
      daily.saleCommission += rawCommission
      daily.sales += row.quantity
      daily.netCommission += rawCommission
    } else if (isReturn) {
      daily.returnCommission += rawCommission
      daily.returns += row.quantity
      daily.netCommission -= rawCommission
    }
    dailyMap.set(date, daily)

    if (isSale || isReturn) {
      const key = `${row.nmId}:${row.vendorCode}`
      const article = articleMap.get(key) ?? {
        nmId: row.nmId,
        vendorCode: row.vendorCode,
        saleCommission: 0,
        returnCommission: 0,
        netCommission: 0,
        saleQty: 0,
        returnQty: 0,
      }
      if (isSale) {
        article.saleCommission += rawCommission
        article.netCommission += rawCommission
        article.saleQty += row.quantity
      } else {
        article.returnCommission += rawCommission
        article.netCommission -= rawCommission
        article.returnQty += row.quantity
      }
      articleMap.set(key, article)
    }
  }

  const rawNetCommission = saleCommission - returnCommission
  const summary = report.summary
  const reportCommission = num(summary.commission)
  const output = {
    generatedAt: new Date().toISOString(),
    question: 'Почему комиссия WB Galioni за 1-30 апреля отрицательная и означает ли это прибыль?',
    account,
    period: { from: DATE_FROM, to: DATE_TO },
    coverage,
    dataQuality: {
      rowCount: rows.length,
      distinctRrdIds: new Set(rows.map((row) => row.rrdId.toString())).size,
      minOperationDate: rows.length ? (rows[0].rrDt ?? rows[0].dateFrom).toISOString().slice(0, 10) : null,
      maxOperationDate: rows.length ? (rows.at(-1)!.rrDt ?? rows.at(-1)!.dateFrom).toISOString().slice(0, 10) : null,
      saleRowsWithNegativeCommission,
      returnRowsWithNegativeCommission,
      reportVsRawCommissionDifference: round(reportCommission - rawNetCommission),
    },
    commissionReconciliation: {
      commissionOnSales: round(saleCommission),
      commissionReturnedOnReturns: round(returnCommission),
      otherCommissionImpact: round(otherCommissionImpact),
      netCommission: round(rawNetCommission),
      weightedKvvPct: saleRetailBase === 0 ? 0 : round(saleWeightedKvv / saleRetailBase, 4),
      weightedPlatformDiscountPct: saleRetailBase === 0 ? 0 : round(saleWeightedPlatformDiscount / saleRetailBase, 4),
      effectiveCommissionPctOfPreSppNetSales: num(summary.salesReturnsNoSpp) === 0 ? 0 : round(rawNetCommission / num(summary.salesReturnsNoSpp) * 100, 4),
      formula: 'commissionOnSales - commissionReturnedOnReturns',
    },
    businessResult: {
      sales: num(summary.sale),
      salesNoSppNet: num(summary.salesReturnsNoSpp),
      soldNetUnits: num(summary.boughtWithReturns),
      returnsUnits: num(summary.returns),
      toTransfer: num(summary.toTransfer),
      logistics: num(summary.logistics),
      storage: num(summary.storageFee),
      advertising: num(summary.adAll),
      costPrice: num(summary.costPrice),
      taxes: num(summary.taxes),
      penalty: num(summary.penalty),
      deductions: num(summary.deductions),
      operatingProfit: num(summary.operatingProfit),
      marginalityPct: num(summary.marginality),
    },
    daily: Array.from(dailyMap.entries()).map(([date, value]) => ({
      date,
      ...Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, round(amount)])),
    })),
    operations: Array.from(operationMap.entries())
      .map(([operation, value]) => ({ operation, ...value, commissionImpact: round(value.commissionImpact), rawCommission: round(value.rawCommission) }))
      .filter((row) => row.rawCommission !== 0)
      .sort((a, b) => Math.abs(b.commissionImpact) - Math.abs(a.commissionImpact)),
    articlesWithLargestNegativeImpact: Array.from(articleMap.values())
      .map((row) => ({ ...row, saleCommission: round(row.saleCommission), returnCommission: round(row.returnCommission), netCommission: round(row.netCommission) }))
      .sort((a, b) => a.netCommission - b.netCommission)
      .slice(0, 15),
    source: {
      engine: 'postgresql',
      sql: SOURCE_SQL,
      tables: ['realization_reports', 'wb_accounts'],
    },
  }

  const outputDir = path.join(process.cwd(), 'output', 'analysis')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'galioni_negative_commission_2026-04-01_30.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
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
