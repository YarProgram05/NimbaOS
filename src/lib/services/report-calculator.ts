import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { aggregateReportRows } from '@/lib/reports/aggregate-report-rows'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { fetchFullStats, fetchUpdHistory } from '@/lib/wb-api/advertising'
import { WbApiClient } from '@/lib/wb-api/client'
import type {
  WbFullStatsAppType,
  WbFullStatsCampaign,
  WbFullStatsDayItem,
  WbFullStatsMetricPoint,
  WbUpdHistoryItem,
} from '@/types/advertising'
import { SYNC_JOB_KINDS } from '@/types/sync'
import type { ReportData, ReportRow } from '@/types/reports'

type DbRow = Awaited<ReturnType<typeof prisma.realizationReport.findMany>>[number]
type AdNmStatRow = {
  campaignId: string
  nmId: number
  spend: { toString(): string }
}

const DOC_SALE = '\u041f\u0440\u043e\u0434\u0430\u0436\u0430'
const DOC_RETURN = '\u0412\u043e\u0437\u0432\u0440\u0430\u0442'
const OPERATION_LOGISTICS = '\u041b\u043e\u0433\u0438\u0441\u0442\u0438\u043a\u0430'
const BONUS_TO_CLIENT_SALE = '\u041a \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043f\u0440\u0438 \u043f\u0440\u043e\u0434\u0430\u0436\u0435'
const BONUS_TO_CLIENT_CANCEL = '\u041a \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043f\u0440\u0438 \u043e\u0442\u043c\u0435\u043d\u0435'
const SUMMARY_LABEL = '\u0418\u0442\u043e\u0433\u043e'
const WB_PAYMENT_BALANCE = '\u0411\u0430\u043b\u0430\u043d\u0441'
const DOMINANT_CAMPAIGN_NM_SHARE = 0.5
const WB_BALANCE_AFTER_CASHBACK_SHARE = 0.63545

export async function calculateReport(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ReportData> {
  const dfrom = new Date(dateFrom)
  const dto = new Date(dateTo)

  const [
    rows,
    costPrices,
    selfPurchases,
    externalAds,
    overrides,
    account,
    products,
    paidStorageRows,
    adNmStatRows,
    adCampaigns,
    coverage,
  ] =
    await Promise.all([
      prisma.realizationReport.findMany({
        where: {
          wbAccountId,
          OR: [
            {
              rrDt: { gte: dfrom, lte: dto },
            },
            {
              rrDt: null,
              dateFrom: { lte: dto },
              dateTo: { gte: dfrom },
            },
          ],
        },
      }),
      prisma.costPrice.findMany({ where: { wbAccountId } }),
      prisma.selfPurchase.findMany({
        where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      }),
      prisma.externalAd.findMany({
        where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      }),
      prisma.articleOverride.findMany({ where: { wbAccountId } }),
      prisma.wbAccount.findUniqueOrThrow({
        where: { id: wbAccountId },
        select: { taxRate: true, lastSyncAt: true, apiKey: true },
      }),
      prisma.product.findMany({
        where: { wbAccountId },
        select: { nmId: true, vendorCode: true, category: true, brand: true, photoUrl: true },
      }),
      prisma.paidStorage.findMany({
        where: { wbAccountId, date: { gte: dfrom, lte: dto } },
        select: { nmId: true, cost: true, fetchedAt: true },
      }),
      prisma.adCampaignNmStat.findMany({
        where: {
          date: { gte: dfrom, lte: dto },
          source: 'total',
          campaign: { wbAccountId },
        },
        select: { campaignId: true, nmId: true, spend: true },
      }),
      prisma.adCampaign.findMany({
        where: { wbAccountId },
        select: { id: true, advertId: true },
      }),
      getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.REPORTS_PERIOD, dateFrom, dateTo),
    ])

  const costMap = new Map<string, number>()
  for (const cp of costPrices) {
    costMap.set(cp.vendorCode, d(cp.costPrice))
  }

  const spMap = new Map<string, { quantity: number; amount: number; cashback: number }>()
  for (const sp of selfPurchases) {
    const existing = spMap.get(sp.vendorCode) ?? { quantity: 0, amount: 0, cashback: 0 }
    existing.quantity += sp.quantity
    existing.amount += d(sp.amount)
    existing.cashback += d(sp.cashback)
    spMap.set(sp.vendorCode, existing)
  }

  const extAdMap = new Map<string, number>()
  for (const ad of externalAds) {
    if (ad.vendorCode) {
      extAdMap.set(ad.vendorCode, (extAdMap.get(ad.vendorCode) ?? 0) + d(ad.amount))
    }
  }

  const overrideMap = new Map<string, { localName: string | null }>()
  for (const ov of overrides) {
    overrideMap.set(ov.vendorCode, { localName: ov.localName })
  }

  const nmVendorMap = new Map<number, string>()
  const vendorNmMap = new Map<string, number>()
  const productMetaMap = new Map<number, { subjectName: string; brandName: string; photoUrl: string | null }>()
  for (const p of products) {
    if (p.vendorCode) nmVendorMap.set(p.nmId, p.vendorCode)
    if (p.vendorCode && !vendorNmMap.has(p.vendorCode)) vendorNmMap.set(p.vendorCode, p.nmId)
    productMetaMap.set(p.nmId, {
      subjectName: p.category ?? '',
      brandName: p.brand ?? '',
      photoUrl: p.photoUrl ?? null,
    })
  }

  const taxRate = d(account.taxRate)

  const paidStorageByNm = new Map<number, number>()
  for (const ps of paidStorageRows) {
    if (ps.nmId === 0) continue
    paidStorageByNm.set(ps.nmId, (paidStorageByNm.get(ps.nmId) ?? 0) + d(ps.cost))
  }

  const adSpendByNm = await buildAdSpendByNm({
    apiKey: account.apiKey,
    dateFrom,
    dateTo,
    adCampaigns,
    adNmStatRows,
  })

  let globalStorageTotal = 0
  const outboundPerNm = new Map<number, number>()
  let totalOutbound = 0

  for (const row of rows) {
    if (row.nmId === 0) {
      globalStorageTotal += d(row.storageFee)
    } else if (
      row.supplierOperName === OPERATION_LOGISTICS &&
      (row.bonusTypeName === BONUS_TO_CLIENT_SALE || row.bonusTypeName === BONUS_TO_CLIENT_CANCEL)
    ) {
      outboundPerNm.set(row.nmId, (outboundPerNm.get(row.nmId) ?? 0) + 1)
      totalOutbound++
    }
  }

  const usePaidStorage = paidStorageByNm.size > 0

  const grouped = new Map<number, DbRow[]>()
  for (const row of rows) {
    if (row.nmId === 0) continue
    const arr = grouped.get(row.nmId) ?? []
    arr.push(row)
    grouped.set(row.nmId, arr)
  }

  const hasRealizationRows = rows.some((row) => row.nmId !== 0)
  const reportNmIds = new Set<number>(grouped.keys())
  if (hasRealizationRows) {
    for (const nmId of Array.from(paidStorageByNm.keys())) {
      reportNmIds.add(nmId)
    }
    for (const nmId of Array.from(adSpendByNm.keys())) {
      reportNmIds.add(nmId)
    }
    for (const vendorCode of Array.from(extAdMap.keys())) {
      const nmId = vendorNmMap.get(vendorCode)
      if (nmId) reportNmIds.add(nmId)
    }
    for (const vendorCode of Array.from(spMap.keys())) {
      const nmId = vendorNmMap.get(vendorCode)
      if (nmId) reportNmIds.add(nmId)
    }
  }

  const reportRows: ReportRow[] = []
  let totalOP = 0

  for (const nmId of Array.from(reportNmIds)) {
    const group = grouped.get(nmId) ?? []
    let extraStorage = 0

    if (usePaidStorage) {
      extraStorage = paidStorageByNm.get(nmId) ?? 0
    } else {
      const outbound = outboundPerNm.get(nmId) ?? 0
      extraStorage = totalOutbound > 0 ? globalStorageTotal * (outbound / totalOutbound) : 0
    }

    const row = calculateGroup(
      nmId,
      group,
      costMap,
      spMap,
      extAdMap,
      overrideMap,
      taxRate,
      nmVendorMap,
      productMetaMap,
      extraStorage,
      usePaidStorage,
      adSpendByNm.get(nmId)?.balance ?? 0,
      adSpendByNm.get(nmId)?.all ?? 0,
    )

    totalOP += Number(row.operatingProfit)
    reportRows.push(row)
  }

  for (const row of reportRows) {
    row.operatingProfitShare = safeDivide(Number(row.operatingProfit) * 100, totalOP, 2)
  }

  reportRows.sort((a, b) => Number(b.sale) - Number(a.sale))

  const summary = aggregateReportRows(reportRows, { subjectName: SUMMARY_LABEL })

  // Use WbAccount.lastSyncAt (updated by syncReportsAction) as the authoritative
  // sync time. createMany(skipDuplicates) doesn't update fetchedAt on existing rows,
  // so max(fetchedAt) would show a stale date on re-syncs.
  const lastSyncAt: string | null = account.lastSyncAt?.toISOString() ?? null

  return {
    rows: reportRows,
    summary,
    dateFrom,
    dateTo,
    lastSyncAt,
    coverage: {
      isCovered: coverage.isCovered,
      syncedAt: coverage.syncedAt,
    },
  }
}

function calculateGroup(
  nmId: number,
  group: DbRow[],
  costMap: Map<string, number>,
  spMap: Map<string, { quantity: number; amount: number; cashback: number }>,
  extAdMap: Map<string, number>,
  overrideMap: Map<string, { localName: string | null }>,
  taxRate: number,
  nmVendorMap: Map<number, string>,
  productMetaMap: Map<number, { subjectName: string; brandName: string; photoUrl: string | null }>,
  extraStorageFee = 0,
  skipRealizationStorage = false,
  adBalance = 0,
  adAll = adBalance,
): ReportRow {
  const vendorCodes = new Set<string>()
  const productMeta = nmId > 0 ? productMetaMap.get(nmId) : undefined
  let subjectName = productMeta?.subjectName ?? ''
  let brandName = productMeta?.brandName ?? ''
  const photoUrl = productMeta?.photoUrl ?? null

  let salesAmtWithSpp = 0
  let salesAmtNoSpp = 0
  let returnsAmtWithSpp = 0
  let returnsAmtNoSpp = 0
  let salesForPay = 0
  let returnsForPay = 0
  let salesCount = 0
  let returnsCount = 0
  let cancellationsCount = 0
  let totalDelivery = 0
  let totalPenalty = 0
  let totalAdditional = 0
  let totalStorage = 0
  let totalDeduction = 0
  let totalAcceptance = 0
  let commissionOnSale = 0
  let commissionOnReturn = 0
  let acquiringOnSale = 0
  let acquiringOnReturn = 0

  for (const row of group) {
    vendorCodes.add(row.vendorCode)
    if (!subjectName && row.subjectName) subjectName = row.subjectName
    if (!brandName && row.brandName) brandName = row.brandName

    const isSale = row.docTypeName === DOC_SALE
    const isReturn = row.docTypeName === DOC_RETURN
    const retailWithDisc = d(row.retailPriceWithDisc)
    const forPay = d(row.ppvzForPay)
    const delivery = d(row.deliveryRub)
    const penalty = d(row.penalty)
    const additional = d(row.additionalPayment)
    const storage = d(row.storageFee)
    const deduction = d(row.deduction)
    const acceptance = d(row.acceptance)
    const acquiring = d(row.acquiringFee)
    const commission = d(row.ppvzSalesCommission)

    if (isSale) {
      const sppFactor = 1 - d(row.ppvzSppPrc) / 100
      salesAmtWithSpp += retailWithDisc * sppFactor
      salesAmtNoSpp += retailWithDisc
      salesForPay += forPay
      salesCount += row.quantity
      commissionOnSale += commission
      acquiringOnSale += acquiring
    } else if (isReturn) {
      const sppFactor = 1 - d(row.ppvzSppPrc) / 100
      returnsAmtWithSpp += retailWithDisc * sppFactor
      returnsAmtNoSpp += retailWithDisc
      returnsForPay += forPay
      returnsCount += row.quantity
      commissionOnReturn += commission
      acquiringOnReturn += acquiring
    } else if (row.supplierOperName === OPERATION_LOGISTICS && row.bonusTypeName === BONUS_TO_CLIENT_CANCEL) {
      cancellationsCount++
    }

    totalDelivery += delivery
    totalPenalty += penalty
    totalAdditional += additional
    if (!skipRealizationStorage) totalStorage += storage
    totalDeduction += deduction
    totalAcceptance += acceptance
  }

  totalStorage += extraStorageFee

  const deliveredCount = salesCount + cancellationsCount

  const resolvedVendorCodes = new Set<string>()
  for (const vendorCode of Array.from(vendorCodes)) {
    if (vendorCode) resolvedVendorCodes.add(vendorCode)
  }
  if (resolvedVendorCodes.size === 0 && nmId > 0) {
    const fallback = nmVendorMap.get(nmId)
    if (fallback) resolvedVendorCodes.add(fallback)
  }

  const sale = salesAmtWithSpp - returnsAmtWithSpp
  const toTransfer = salesForPay - returnsForPay
  const boughtWithReturns = salesCount - returnsCount
  const boughtWithoutReturns = salesCount
  const avgPrice = salesCount > 0 && boughtWithReturns > 0 ? safeDivide(salesAmtWithSpp, salesCount) : '0.00'
  const buyoutPercent = safeDivideMinZero(boughtWithReturns * 100, deliveredCount)
  const totalCommission = commissionOnSale - commissionOnReturn
  const totalAcquiring = acquiringOnSale - acquiringOnReturn

  let costPriceTotal = 0
  let spTotalAmount = 0
  let spTotalCashback = 0
  let extAdTotal = 0

  const vcArray = resolvedVendorCodes.size > 0 ? Array.from(resolvedVendorCodes) : Array.from(vendorCodes)
  for (const vendorCode of vcArray) {
    const unitCost = costMap.get(vendorCode) ?? 0
    costPriceTotal += unitCost * boughtWithReturns

    const sp = spMap.get(vendorCode)
    if (sp) {
      spTotalAmount += sp.amount
      spTotalCashback += sp.cashback
    }

    extAdTotal += extAdMap.get(vendorCode) ?? 0
  }

  let selfPurchaseCost = 0
  for (const vendorCode of vcArray) {
    const sp = spMap.get(vendorCode)
    const unitCost = costMap.get(vendorCode) ?? 0
    if (sp) selfPurchaseCost += sp.quantity * unitCost
  }

  const taxes = Math.max(0, sale * (taxRate / 100))
  const totalAdAll = adAll + extAdTotal

  const operatingProfit =
    toTransfer
    - adAll
    - extAdTotal
    - totalDelivery
    - costPriceTotal
    - totalStorage
    - totalAcceptance
    - totalAdditional
    - totalPenalty
    - taxes
    - totalDeduction
    - spTotalAmount
    - spTotalCashback

  const totalToPay =
    toTransfer
    - adAll
    - totalDelivery
    - totalAdditional
    - totalPenalty
    - totalStorage
    - totalAcceptance
    - totalDeduction

  const operatingProfitUnit = safeDivide(operatingProfit, boughtWithReturns)
  const marginality = safeMarginality(operatingProfit, sale)
  const rentability = safeDivide(operatingProfit * 100, costPriceTotal)
  const drr = safeDivide(totalAdAll * 100, sale)
  const logisticsUnit = safeDivide(totalDelivery, boughtWithReturns)
  const logisticsFromSalesPercent = safeDivideMinZero(totalDelivery * 100, sale)
  const storageFromSalesPercent = safeDivideMinZero(totalStorage * 100, sale)

  const primaryVendorCode = (resolvedVendorCodes.size > 0 ? resolvedVendorCodes : vendorCodes).values().next().value ?? ''
  const override = overrideMap.get(primaryVendorCode)
  const displayVendorCode = override?.localName ?? primaryVendorCode

  return {
    nmId,
    subjectName,
    vendorCode: displayVendorCode,
    brandName,
    photoUrl,

    sale: fmt(sale),
    toTransfer: fmt(toTransfer),
    totalToPay: fmt(totalToPay),
    operatingProfit: fmt(operatingProfit),
    operatingProfitUnit,
    operatingProfitShare: '0.00',
    avgPrice,

    boughtWithReturns,
    buyoutPercent,
    boughtWithoutReturns,
    returns: returnsCount,

    marginality,
    rentability,

    adBalance: fmt(adBalance),
    adAll: fmt(totalAdAll),
    drr,

    logistics: fmt(totalDelivery),
    logisticsUnit,
    delivered: deliveredCount,
    logisticsFromSalesPercent,

    externalAd: fmt(extAdTotal),
    selfPurchaseCost: fmt(selfPurchaseCost),
    cashbackDistributions: fmt(spTotalCashback),
    selfPurchaseAmount: fmt(spTotalAmount),

    storageFromSalesPercent,
    costPrice: fmt(costPriceTotal),
    storageFee: fmt(totalStorage),
    acceptance: fmt(totalAcceptance),
    additionalPayment: fmt(totalAdditional),
    penalty: fmt(totalPenalty),
    taxes: fmt(taxes),
    commission: fmt(totalCommission),
    selfPurchases: fmt(spTotalAmount + spTotalCashback),
    acquiringFee: fmt(totalAcquiring),

    cancellations: cancellationsCount,

    salesReturnsNoSpp: fmt(salesAmtNoSpp - returnsAmtNoSpp),
    salesWithSpp: fmt(salesAmtWithSpp),
    returnsWithSpp: fmt(returnsAmtWithSpp),
    salesNoSpp: fmt(salesAmtNoSpp),
    returnsNoSpp: fmt(returnsAmtNoSpp),
    commissionOnSale: fmt(commissionOnSale),
    commissionOnReturn: fmt(commissionOnReturn),
    deductions: fmt(totalDeduction),
    salesToTransfer: fmt(salesForPay),
    returnsToTransfer: fmt(returnsForPay),
    acquiringOnSale: fmt(acquiringOnSale),
    tags: '',
    acquiringOnReturn: fmt(acquiringOnReturn),
  }
}

interface AdSpendByNm {
  balance: number
  all: number
}

interface CampaignRef {
  id: string
  advertId: number
}

function addAdSpend(target: Map<number, AdSpendByNm>, nmId: number, balance: number, all: number) {
  if (nmId === 0) return
  const existing = target.get(nmId) ?? { balance: 0, all: 0 }
  existing.balance += balance
  existing.all += all
  target.set(nmId, existing)
}

function metricSpend(point: WbFullStatsMetricPoint): number {
  return d(point.sum ?? point.spend ?? point.sum_price)
}

function dayApps(day: WbFullStatsDayItem): WbFullStatsAppType[] {
  return day.apps ?? day.app_type_stats ?? day.appTypeStats ?? []
}

function campaignDays(campaign: WbFullStatsCampaign): WbFullStatsDayItem[] {
  return campaign.days ?? campaign.daily_stats ?? []
}

function getAdvertId(value: WbFullStatsCampaign | WbUpdHistoryItem): number {
  return Number(value.advertId ?? value.advert_id ?? 0)
}

function getUpdSum(value: WbUpdHistoryItem): number {
  return d(value.updSum ?? value.upd_sum ?? value.sum)
}

function getPaymentType(value: WbUpdHistoryItem): string {
  return String(value.paymentType ?? value.payment_type ?? value.type ?? '')
}

function buildNmSpendWeights(campaigns: WbFullStatsCampaign[]): Map<number, Map<number, number>> {
  const result = new Map<number, Map<number, number>>()

  for (const campaign of campaigns) {
    const advertId = getAdvertId(campaign)
    if (!advertId) continue

    const byNm = result.get(advertId) ?? new Map<number, number>()
    for (const day of campaignDays(campaign)) {
      for (const app of dayApps(day)) {
        for (const point of app.nms ?? []) {
          const nmId = point.nmId ?? point.nm_id ?? 0
          if (!nmId) continue
          byNm.set(nmId, (byNm.get(nmId) ?? 0) + metricSpend(point))
        }
      }
      for (const point of day.nms ?? []) {
        const nmId = point.nmId ?? point.nm_id ?? 0
        if (!nmId) continue
        byNm.set(nmId, (byNm.get(nmId) ?? 0) + metricSpend(point))
      }
    }

    result.set(advertId, byNm)
  }

  return result
}

function buildPersistedNmSpendWeights(
  adCampaigns: CampaignRef[],
  adNmStatRows: AdNmStatRow[],
): Map<number, Map<number, number>> {
  const idToAdvertId = new Map(adCampaigns.map((campaign) => [campaign.id, campaign.advertId]))
  const result = new Map<number, Map<number, number>>()

  for (const row of adNmStatRows) {
    const advertId = idToAdvertId.get(row.campaignId)
    if (!advertId || row.nmId === 0) continue
    const byNm = result.get(advertId) ?? new Map<number, number>()
    byNm.set(row.nmId, (byNm.get(row.nmId) ?? 0) + d(row.spend))
    result.set(advertId, byNm)
  }

  return result
}

function distributeCampaignSpend(
  target: Map<number, AdSpendByNm>,
  nmWeights: Map<number, number> | undefined,
  balanceAmount: number,
  allAmount: number,
) {
  if (!nmWeights || nmWeights.size === 0) return

  const positiveWeights = Array.from(nmWeights.entries()).filter(([, value]) => value > 0)
  if (positiveWeights.length === 0) return

  const totalWeight = positiveWeights.reduce((sum, [, value]) => sum + value, 0)
  const [dominantNmId, dominantWeight] = positiveWeights.reduce(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    positiveWeights[0],
  )

  if (dominantWeight / totalWeight >= DOMINANT_CAMPAIGN_NM_SHARE) {
    addAdSpend(target, dominantNmId, balanceAmount, allAmount)
    return
  }

  for (const [nmId, weight] of positiveWeights) {
    const share = weight / totalWeight
    addAdSpend(target, nmId, balanceAmount * share, allAmount * share)
  }
}

function fallbackAdSpendByNm(adNmStatRows: AdNmStatRow[]): Map<number, AdSpendByNm> {
  const result = new Map<number, AdSpendByNm>()
  for (const row of adNmStatRows) {
    addAdSpend(result, row.nmId, d(row.spend), d(row.spend))
  }
  return result
}

async function buildAdSpendByNm(params: {
  apiKey: string
  dateFrom: string
  dateTo: string
  adCampaigns: CampaignRef[]
  adNmStatRows: AdNmStatRow[]
}): Promise<Map<number, AdSpendByNm>> {
  const fallback = fallbackAdSpendByNm(params.adNmStatRows)

  try {
    const client = new WbApiClient(decrypt(params.apiKey))
    const costs = await fetchUpdHistory(client, params.dateFrom, params.dateTo)
    const advertIds = Array.from(new Set(costs.map(getAdvertId).filter(Boolean)))
    if (advertIds.length === 0) return fallback

    let weights = new Map<number, Map<number, number>>()
    try {
      weights = buildNmSpendWeights(
        (await fetchFullStats(client, advertIds, params.dateFrom, params.dateTo)) ?? [],
      )
    } catch {
      weights = buildPersistedNmSpendWeights(params.adCampaigns, params.adNmStatRows)
    }

    const result = new Map<number, AdSpendByNm>()
    const costsByAdvertId = new Map<number, { all: number; balanceSource: number }>()
    for (const cost of costs) {
      const advertId = getAdvertId(cost)
      const allAmount = getUpdSum(cost)
      if (!advertId || allAmount === 0) continue

      const isBalance = getPaymentType(cost) === WB_PAYMENT_BALANCE
      const existing = costsByAdvertId.get(advertId) ?? { all: 0, balanceSource: 0 }
      existing.all += allAmount
      if (isBalance) existing.balanceSource += allAmount
      costsByAdvertId.set(advertId, existing)
    }

    for (const [advertId, cost] of Array.from(costsByAdvertId.entries())) {
      const balanceAmount = Math.round(cost.balanceSource * WB_BALANCE_AFTER_CASHBACK_SHARE)
      distributeCampaignSpend(result, weights.get(advertId), balanceAmount, cost.all)
    }

    return result.size > 0 ? result : fallback
  } catch {
    return fallback
  }
}

function d(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

function fmt(value: number): string {
  return value.toFixed(2)
}

function safeDivide(numerator: number, denominator: number, decimals = 2): string {
  if (denominator === 0) return (0).toFixed(decimals)
  return (numerator / denominator).toFixed(decimals)
}

function safeDivideMinZero(numerator: number, denominator: number, decimals = 2): string {
  if (denominator === 0) return (0).toFixed(decimals)
  return Math.max(0, numerator / denominator).toFixed(decimals)
}

function safeMarginality(operatingProfit: number, sale: number, decimals = 2): string {
  if (operatingProfit < 0 && sale < 0) return (0).toFixed(decimals)
  return safeDivide(operatingProfit * 100, sale, decimals)
}
