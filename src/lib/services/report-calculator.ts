import { prisma } from '@/lib/db'
import type { ReportRow, ReportData } from '@/types/reports'

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads raw RealizationReport rows + reference data from the database,
 * groups by nmId, and calculates all 52 report columns.
 */
export async function calculateReport(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ReportData> {
  const dfrom = new Date(dateFrom)
  const dto = new Date(dateTo)

  // 1. Parallel fetch of all required data
  const [rows, costPrices, selfPurchases, externalAds, overrides, account, products] =
    await Promise.all([
      prisma.realizationReport.findMany({
        where: {
          wbAccountId,
          dateFrom: { gte: dfrom },
          dateTo: { lte: dto },
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
        select: { taxRate: true },
      }),
      prisma.product.findMany({
        where: { wbAccountId },
        select: { nmId: true, vendorCode: true },
      }),
    ])

  // 2. Build lookup maps keyed by vendorCode
  const costMap = new Map<string, number>()
  for (const cp of costPrices) {
    costMap.set(cp.vendorCode, d(cp.costPrice))
  }

  // Self-purchases aggregated by vendorCode
  const spMap = new Map<string, { quantity: number; amount: number; cashback: number }>()
  for (const sp of selfPurchases) {
    const existing = spMap.get(sp.vendorCode) ?? { quantity: 0, amount: 0, cashback: 0 }
    existing.quantity += sp.quantity
    existing.amount += d(sp.amount)
    existing.cashback += d(sp.cashback)
    spMap.set(sp.vendorCode, existing)
  }

  // External ads aggregated by vendorCode (null vendorCode → summary only)
  const extAdMap = new Map<string, number>()
  let extAdUnassigned = 0
  for (const ad of externalAds) {
    if (ad.vendorCode) {
      extAdMap.set(ad.vendorCode, (extAdMap.get(ad.vendorCode) ?? 0) + d(ad.amount))
    } else {
      extAdUnassigned += d(ad.amount)
    }
  }

  // Article overrides by vendorCode
  const overrideMap = new Map<string, { localName: string | null }>()
  for (const ov of overrides) {
    overrideMap.set(ov.vendorCode, { localName: ov.localName })
  }

  // nmId → vendorCode fallback (WB API reportDetailByPeriod often omits vendor_code)
  const nmVendorMap = new Map<number, string>()
  for (const p of products) {
    if (p.vendorCode) nmVendorMap.set(p.nmId, p.vendorCode)
  }

  const taxRate = d(account.taxRate)

  // 3. Group rows by nmId
  const grouped = new Map<number, typeof rows>()
  for (const row of rows) {
    const arr = grouped.get(row.nmId) ?? []
    arr.push(row)
    grouped.set(row.nmId, arr)
  }

  // 4. Calculate per-nmId (pass 1: everything except operatingProfitShare)
  const reportRows: ReportRow[] = []
  let totalOP = 0

  for (const [nmId, group] of Array.from(grouped.entries())) {
    const row = calculateGroup(nmId, group, costMap, spMap, extAdMap, overrideMap, taxRate, nmVendorMap)
    totalOP += Number(row.operatingProfit)
    reportRows.push(row)
  }

  // 5. Pass 2: operatingProfitShare (% от всей ОП)
  for (const row of reportRows) {
    row.operatingProfitShare = safeDivide(Number(row.operatingProfit), totalOP, 2)
  }

  // 6. Sort by sale descending (biggest sellers first)
  reportRows.sort((a, b) => Number(b.sale) - Number(a.sale))

  // 7. Summary row (all rows aggregated)
  const summary = calculateGroup(0, rows, costMap, spMap, extAdMap, overrideMap, taxRate, nmVendorMap)
  summary.subjectName = 'Итого'
  summary.vendorCode = ''
  summary.brandName = ''

  // ── Summary: aggregate reference-based fields from per-item rows ──────────────
  // calculateGroup(nmId=0, allRows) cannot resolve per-item vendorCodes when all
  // realization_report rows have empty vendor_code (WB API omission). Aggregate from
  // individual rows that already resolved their vendorCodes via nmVendorMap.
  const sumCostPrice     = reportRows.reduce((s, r) => s + Number(r.costPrice), 0)
  const sumExtAd         = reportRows.reduce((s, r) => s + Number(r.externalAd), 0)
  const sumSpCost        = reportRows.reduce((s, r) => s + Number(r.selfPurchaseCost), 0)
  const sumCashback      = reportRows.reduce((s, r) => s + Number(r.cashbackDistributions), 0)
  const sumSpAmount      = reportRows.reduce((s, r) => s + Number(r.selfPurchaseAmount), 0)

  summary.costPrice            = fmt(sumCostPrice)
  summary.selfPurchaseCost     = fmt(sumSpCost)
  summary.cashbackDistributions = fmt(sumCashback)
  summary.selfPurchaseAmount   = fmt(sumSpAmount)
  summary.selfPurchases        = fmt(sumSpAmount + sumCashback)

  // External ad: per-item assigned + global unassigned
  const totalExtAd = sumExtAd + extAdUnassigned
  summary.externalAd = fmt(totalExtAd)

  // Recalculate taxes (depends on toTransfer, which is already correct in summary)
  const summaryToTransfer = Number(summary.toTransfer)
  const summaryTaxes = summaryToTransfer * (taxRate / 100)
  summary.taxes = fmt(summaryTaxes)

  // Recalculate operating profit with corrected reference-based costs
  const summaryOp =
    summaryToTransfer
    - 0 // adAll — Phase 7
    - totalExtAd
    - Number(summary.logistics)
    - sumCostPrice
    - Number(summary.storageFee)
    - Number(summary.acceptance)
    - Number(summary.additionalPayment)
    - Number(summary.penalty)
    - summaryTaxes
    - Number(summary.deductions)
    - sumSpAmount
    - sumCashback

  summary.operatingProfit      = fmt(summaryOp)
  summary.operatingProfitUnit  = safeDivide(summaryOp, summary.boughtWithReturns)
  summary.operatingProfitShare = '100.00'

  // Recalculate marginality and rentability for summary
  const summarySale = Number(summary.sale)
  summary.marginality = safeDivide((summarySale - sumCostPrice) * 100, summarySale)
  summary.rentability = safeDivide(summaryOp * 100, sumCostPrice)

  // Find last fetchedAt as lastSyncAt
  let lastSyncAt: string | null = null
  if (rows.length > 0) {
    const maxFetched = rows.reduce(
      (max, r) => (r.fetchedAt > max ? r.fetchedAt : max),
      rows[0].fetchedAt,
    )
    lastSyncAt = maxFetched.toISOString()
  }

  return {
    rows: reportRows,
    summary,
    dateFrom,
    dateTo,
    lastSyncAt,
  }
}

// ── Core calculation for a group of rows (by nmId or all) ────────────────────

type DbRow = Awaited<ReturnType<typeof prisma.realizationReport.findMany>>[number]

function calculateGroup(
  nmId: number,
  group: DbRow[],
  costMap: Map<string, number>,
  spMap: Map<string, { quantity: number; amount: number; cashback: number }>,
  extAdMap: Map<string, number>,
  overrideMap: Map<string, { localName: string | null }>,
  taxRate: number,
  nmVendorMap: Map<number, string>,
): ReportRow {
  // Collect unique vendorCode(s) for this nmId group
  const vendorCodes = new Set<string>()
  let subjectName = ''
  let brandName = ''

  // Accumulators
  let salesAmtWithSpp = 0       // Σ retailPriceWithDisc × (1 − sppPrc/100) for "Продажа" — actual buyer price
  let salesAmtNoSpp = 0         // Σ retailPriceWithDisc for "Продажа" — with seller discount, no WB SPP
  let returnsAmtWithSpp = 0     // same for "Возврат"
  let returnsAmtNoSpp = 0       // same for "Возврат"
  let salesForPay = 0           // ppvz_for_pay for "Продажа"
  let returnsForPay = 0         // ppvz_for_pay for "Возврат"
  let salesCount = 0            // sum of quantity for "Продажа"
  let returnsCount = 0          // sum of quantity for "Возврат"
  let totalDelivery = 0
  let totalPenalty = 0
  let totalAdditional = 0
  let totalStorage = 0
  let totalDeduction = 0
  let totalAcceptance = 0
  let totalAcquiring = 0
  let totalCommission = 0

  // Detailed breakdowns
  let commissionOnSale = 0
  let commissionOnReturn = 0
  let acquiringOnSale = 0
  let acquiringOnReturn = 0

  for (const row of group) {
    vendorCodes.add(row.vendorCode)
    if (!subjectName && row.subjectName) subjectName = row.subjectName
    if (!brandName && row.brandName) brandName = row.brandName

    const isSale = row.docTypeName === 'Продажа'
    const isReturn = row.docTypeName === 'Возврат'
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
    }

    totalDelivery += delivery
    totalPenalty += penalty
    totalAdditional += additional
    totalStorage += storage
    totalDeduction += deduction
    totalAcceptance += acceptance
    totalAcquiring += acquiring
    totalCommission += commission
  }

  // Delivered = выкупы + возвраты (+ отмены = 0 до Фазы 8)
  const deliveredCount = salesCount + returnsCount

  // ── Resolve effective vendor codes ────────────────────────────────────────────
  // WB API reportDetailByPeriod sometimes returns empty vendor_code.
  // Fall back to the Products table (synced via Phase 3) keyed by nmId.
  const resolvedVendorCodes = new Set<string>()
  for (const vc of Array.from(vendorCodes)) {
    if (vc) resolvedVendorCodes.add(vc)
  }
  if (resolvedVendorCodes.size === 0 && nmId > 0) {
    const fallback = nmVendorMap.get(nmId)
    if (fallback) resolvedVendorCodes.add(fallback)
  }

  // Derived metrics
  const sale = salesAmtWithSpp - returnsAmtWithSpp                  // Col 4 — с учётом WB СПП
  const toTransfer = salesForPay - returnsForPay                    // Col 5
  const boughtWithReturns = salesCount - returnsCount               // Col 11
  const boughtWithoutReturns = salesCount                           // Col 38

  // Avg price (Col 10) — с СПП (actual buyer price)
  const avgPrice = safeDivide(salesAmtWithSpp, salesCount)

  // Buyout % (Col 12) — выкуплено / (выкупы + возвраты) × 100
  const buyoutPercent = safeDivide(boughtWithReturns * 100, deliveredCount)

  // Cost price from reference (Col 27)
  let costPriceTotal = 0
  let spTotalQuantity = 0
  let spTotalAmount = 0
  let spTotalCashback = 0
  let extAdTotal = 0

  const vcArray = resolvedVendorCodes.size > 0 ? Array.from(resolvedVendorCodes) : Array.from(vendorCodes)
  for (const vc of vcArray) {
    const unitCost = costMap.get(vc) ?? 0
    costPriceTotal += unitCost * boughtWithReturns

    const sp = spMap.get(vc)
    if (sp) {
      spTotalQuantity += sp.quantity
      spTotalAmount += sp.amount
      spTotalCashback += sp.cashback
    }

    extAdTotal += extAdMap.get(vc) ?? 0
  }

  // Self-purchase cost = quantity of self-purchases × unit cost (Col 23)
  let selfPurchaseCost = 0
  for (const vc of vcArray) {
    const sp = spMap.get(vc)
    const unitCost = costMap.get(vc) ?? 0
    if (sp) selfPurchaseCost += sp.quantity * unitCost
  }

  // Taxes (Col 32)
  const taxes = toTransfer * (taxRate / 100)

  // Ad balance / all (Col 15-16) — 0 until Phase 7
  const adBalance = 0
  const adAll = 0

  // ОП — Operating Profit (Col 7)
  const op =
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

  // Итого к оплате (Col 6)
  const totalToPay =
    toTransfer
    - adBalance
    - totalDelivery
    - totalAdditional
    - totalPenalty
    - totalStorage
    - totalAcceptance
    - totalDeduction

  // ОП ед. (Col 8)
  const opUnit = safeDivide(op, boughtWithReturns)

  // Маржинальность (Col 13): (sale - costPrice) / sale × 100
  const marginality = safeDivide((sale - costPriceTotal) * 100, sale)

  // Рентабельность (Col 14): ОП / costPrice × 100
  const rentability = safeDivide(op * 100, costPriceTotal)

  // ДРР % (Col 17)
  const drr = safeDivide(adAll * 100, sale)

  // Логистика ед. (Col 19)
  const logisticsUnit = safeDivide(totalDelivery, deliveredCount)

  // Логистика от продаж % (Col 21)
  const logisticsFromSalesPercent = safeDivide(totalDelivery * 100, sale)

  // Хранение от продаж % (Col 26)
  const storageFromSalesPercent = safeDivide(totalStorage * 100, sale)

  // Determine display vendorCode (with override)
  const primaryVendorCode = (resolvedVendorCodes.size > 0 ? resolvedVendorCodes : vendorCodes).values().next().value ?? ''
  const override = overrideMap.get(primaryVendorCode)
  const displayVendorCode = override?.localName ?? primaryVendorCode

  return {
    nmId,
    subjectName,
    vendorCode: displayVendorCode,
    brandName,

    sale: fmt(sale),
    toTransfer: fmt(toTransfer),
    totalToPay: fmt(totalToPay),
    operatingProfit: fmt(op),
    operatingProfitUnit: opUnit,
    operatingProfitShare: '0.00', // Set in pass 2
    avgPrice,

    boughtWithReturns,
    buyoutPercent,
    boughtWithoutReturns,
    returns: returnsCount,

    marginality,
    rentability,

    adBalance: fmt(adBalance),
    adAll: fmt(adAll),
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

    cancellations: 0, // Phase 8

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
    tags: '', // Can be enriched from Product.tags later
    acquiringOnReturn: fmt(acquiringOnReturn),
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

/** Convert Prisma Decimal (or any numeric) to number. Handles null → 0. */
function d(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

/** Format number to 2-decimal string. */
function fmt(value: number): string {
  return value.toFixed(2)
}

/** Safe division returning a formatted string. Returns "0.00" when divisor is 0. */
function safeDivide(numerator: number, denominator: number, decimals = 2): string {
  if (denominator === 0) return (0).toFixed(decimals)
  return (numerator / denominator).toFixed(decimals)
}
