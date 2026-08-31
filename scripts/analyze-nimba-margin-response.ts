import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { calculateReport } from '@/lib/services/report-calculator'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { SYNC_JOB_KINDS } from '@/types/sync'

const ACCOUNT_NAME = 'WB Nimba (WB_1)'
const DATE_FROM = '2026-08-01'
const DATE_TO = '2026-08-12'
const JULY_FROM = '2026-07-01'
const JULY_TO = '2026-07-12'
const DOC_SALE = 'Продажа'

function n(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator * 100, 2)
}

async function main() {
  const account = await prisma.wbAccount.findFirstOrThrow({
    where: { name: ACCOUNT_NAME },
    select: { id: true, name: true, taxRate: true, lastSyncAt: true },
  })

  const [report, julyReport, rawRows, adCoverage] = await Promise.all([
    calculateReport(account.id, DATE_FROM, DATE_TO, {
      preferPersistedAdStats: true,
      preferLiveAdCostTotals: false,
    }),
    calculateReport(account.id, JULY_FROM, JULY_TO, {
      preferPersistedAdStats: true,
      preferLiveAdCostTotals: false,
    }),
    prisma.realizationReport.findMany({
      where: {
        wbAccountId: account.id,
        OR: [
          { rrDt: { gte: new Date(DATE_FROM), lte: new Date(DATE_TO) } },
          { rrDt: null, dateFrom: { lte: new Date(DATE_TO) }, dateTo: { gte: new Date(DATE_FROM) } },
        ],
      },
      select: {
        rrdId: true,
        nmId: true,
        vendorCode: true,
        docTypeName: true,
        retailPriceWithDisc: true,
        ppvzSppPrc: true,
        commissionPercent: true,
      },
    }),
    getSyncCoverage(account.id, SYNC_JOB_KINDS.ADVERTISING_STATS, DATE_FROM, DATE_TO),
  ])

  const rawByNm = new Map<number, { base: number; kvvWeighted: number; sppWeighted: number }>()
  for (const row of rawRows) {
    if (row.docTypeName !== DOC_SALE) continue
    const base = n(row.retailPriceWithDisc.toString())
    const bucket = rawByNm.get(row.nmId) ?? { base: 0, kvvWeighted: 0, sppWeighted: 0 }
    bucket.base += base
    bucket.kvvWeighted += n(row.commissionPercent.toString()) * base
    bucket.sppWeighted += n(row.ppvzSppPrc.toString()) * base
    rawByNm.set(row.nmId, bucket)
  }

  const articles = report.rows
    .filter((row) => n(row.sale) !== 0 || n(row.operatingProfit) !== 0 || n(row.adAll) !== 0)
    .map((row) => {
      const sale = n(row.sale)
      const avgPrice = n(row.avgPrice)
      const op = n(row.operatingProfit)
      const ads = n(row.adAll) + n(row.externalAd)
      const opBeforeAds = op + ads
      const transfer = n(row.toTransfer)
      const commission = n(row.commission)
      const raw = rawByNm.get(row.nmId)
      const kvvPct = raw && raw.base ? raw.kvvWeighted / raw.base : 0
      const sppPct = raw && raw.base ? raw.sppWeighted / raw.base : 0

      // Conservative static-volume price sensitivity: incremental seller revenue follows
      // the current transfer/sales ratio, while tax follows the account tax rate.
      // Fixed costs, quantities, returns, ad spend, logistics, storage, KVV and SPP are held constant.
      const incrementalOpPerRevenueRub = Math.max(0.01, transfer / Math.max(1, sale) - n(account.taxRate.toString()) / 100)
      const breakEvenRevenueIncrease = op < 0 ? -op / incrementalOpPerRevenueRub : 0
      const breakEvenPriceIncreasePct = sale > 0 ? breakEvenRevenueIncrease / sale * 100 : 0
      const targetFivePctRevenueIncrease = op < sale * 0.05
        ? (sale * 0.05 - op) / incrementalOpPerRevenueRub
        : 0
      const targetFivePctPriceIncreasePct = sale > 0 ? targetFivePctRevenueIncrease / sale * 100 : 0

      let action: 'KEEP' | 'PAUSE_ADS_FIRST' | 'RAISE_PRICE_OR_STOP' | 'MONITOR_LOW_MARGIN'
      if (op < 0 && opBeforeAds > 0 && ads > 0) action = 'PAUSE_ADS_FIRST'
      else if (op < 0) action = 'RAISE_PRICE_OR_STOP'
      else if (pct(op, sale) < 5) action = 'MONITOR_LOW_MARGIN'
      else action = 'KEEP'

      return {
        nmId: row.nmId,
        article: row.vendorCode,
        category: row.subjectName,
        salesRub: round(sale),
        avgRealizedPriceRub: round(avgPrice),
        netUnits: row.boughtWithReturns,
        operatingProfitRub: round(op),
        marginPct: pct(op, sale),
        adsRub: round(ads),
        opBeforeAdsRub: round(opBeforeAds),
        commissionRub: round(commission),
        commissionPctOfPreSppSales: pct(commission, n(row.salesReturnsNoSpp)),
        weightedKvvPct: round(kvvPct, 2),
        weightedPlatformDiscountPct: round(sppPct, 2),
        logisticsRub: round(n(row.logistics)),
        storageRub: round(n(row.storageFee)),
        costPriceRub: round(n(row.costPrice)),
        breakEvenPriceIncreasePctStaticVolume: round(Math.max(0, breakEvenPriceIncreasePct), 1),
        breakEvenAvgRealizedPriceRub: round(avgPrice * (1 + Math.max(0, breakEvenPriceIncreasePct) / 100)),
        targetFivePctMarginPriceIncreasePctStaticVolume: round(Math.max(0, targetFivePctPriceIncreasePct), 1),
        targetFivePctMarginAvgRealizedPriceRub: round(avgPrice * (1 + Math.max(0, targetFivePctPriceIncreasePct) / 100)),
        action,
      }
    })
    .sort((a, b) => a.operatingProfitRub - b.operatingProfitRub)

  const summary = report.summary
  const totalSales = n(summary.sale)
  const totalOp = n(summary.operatingProfit)
  const totalAds = n(summary.adAll) + n(summary.externalAd)
  const totalOpBeforeAds = totalOp + totalAds
  const totalTransfer = n(summary.toTransfer)
  const taxRate = n(account.taxRate.toString()) / 100
  const totalIncrementalOpPerRevenueRub = Math.max(0.01, totalTransfer / Math.max(1, totalSales) - taxRate)
  const cabinetBreakEvenRevenueIncrease = totalOp < 0 ? -totalOp / totalIncrementalOpPerRevenueRub : 0
  const cabinetTargetFivePctRevenueIncrease = totalOp < totalSales * 0.05
    ? (totalSales * 0.05 - totalOp) / totalIncrementalOpPerRevenueRub
    : 0
  const augustPreSppBase = n(summary.salesReturnsNoSpp)
  const julyEffectiveCommissionRate = n(julyReport.summary.commission) / Math.max(1, n(julyReport.summary.salesReturnsNoSpp))
  const commissionAtJulyRate = augustPreSppBase * julyEffectiveCommissionRate
  const opAtJulyCommissionRate = totalOp + n(summary.commission) - commissionAtJulyRate

  const output = {
    generatedAt: new Date().toISOString(),
    account,
    period: { from: DATE_FROM, to: DATE_TO },
    coverage: report.coverage,
    advertisingCoverage: adCoverage,
    dataQuality: {
      rawRows: rawRows.length,
      distinctRrdIds: new Set(rawRows.map((row) => row.rrdId.toString())).size,
      reportArticleRows: articles.length,
    },
    cabinet: {
      salesRub: round(totalSales),
      operatingProfitRub: round(totalOp),
      marginPct: pct(totalOp, totalSales),
      adsRub: round(totalAds),
      opBeforeAdsRub: round(totalOpBeforeAds),
      marginBeforeAdsPct: pct(totalOpBeforeAds, totalSales),
      commissionRub: n(summary.commission),
      commissionPctOfPreSppSales: pct(n(summary.commission), n(summary.salesReturnsNoSpp)),
      logisticsRub: n(summary.logistics),
      storageRub: n(summary.storageFee),
      costPriceRub: n(summary.costPrice),
      breakEvenPriceIncreasePctStaticVolume: round(totalSales ? cabinetBreakEvenRevenueIncrease / totalSales * 100 : 0, 1),
      targetFivePctMarginPriceIncreasePctStaticVolume: round(totalSales ? cabinetTargetFivePctRevenueIncrease / totalSales * 100 : 0, 1),
      counterfactualAtJulyCommissionRate: {
        julyEffectiveCommissionPct: round(julyEffectiveCommissionRate * 100, 2),
        commissionRub: round(commissionAtJulyRate),
        operatingProfitRub: round(opAtJulyCommissionRate),
        marginPct: pct(opAtJulyCommissionRate, totalSales),
      },
    },
    julyBaseline: {
      salesRub: n(julyReport.summary.sale),
      operatingProfitRub: n(julyReport.summary.operatingProfit),
      marginPct: n(julyReport.summary.marginality),
      commissionRub: n(julyReport.summary.commission),
      commissionPctOfPreSppSales: pct(n(julyReport.summary.commission), n(julyReport.summary.salesReturnsNoSpp)),
    },
    actionSummary: {
      pauseAdsFirst: articles.filter((row) => row.action === 'PAUSE_ADS_FIRST'),
      raisePriceOrStop: articles.filter((row) => row.action === 'RAISE_PRICE_OR_STOP'),
      monitorLowMargin: articles.filter((row) => row.action === 'MONITOR_LOW_MARGIN'),
      keep: articles.filter((row) => row.action === 'KEEP'),
    },
    articles,
    scenarioAssumptions: [
      'Объём продаж и возвратов не меняется после изменения цены.',
      'КВВ и платформенная скидка остаются на фактическом августовском уровне.',
      'Реклама, логистика, хранение и себестоимость в рублях не меняются.',
      'Дополнительная выручка переходит в сумму к перечислению в текущей фактической пропорции; налог применяется по ставке кабинета.',
      'Сценарий не учитывает ценовую эластичность спроса и возможное изменение СПП, поэтому повышение цены нужно тестировать ступенчато.',
    ],
  }

  const outputDir = path.join(process.cwd(), 'output', 'analysis')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'nimba_margin_response_2026-08-01_12.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(outputPath)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
