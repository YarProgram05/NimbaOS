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
  const [rows, costPrices, selfPurchases, externalAds, overrides, account] =
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
    const row = calculateGroup(nmId, group, costMap, spMap, extAdMap, overrideMap, taxRate)
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
  const summary = calculateGroup(0, rows, costMap, spMap, extAdMap, overrideMap, taxRate)
  summary.subjectName = 'Итого'
  summary.vendorCode = ''
  summary.brandName = ''
  // Add unassigned external ads to summary
  summary.externalAd = fmt(Number(summary.externalAd) + extAdUnassigned)
  // Recalculate OP with unassigned external ads
  const summaryOp = Number(summary.operatingProfit) - extAdUnassigned
  summary.operatingProfit = fmt(summaryOp)
  summary.operatingProfitUnit = safeDivide(summaryOp, summary.boughtWithReturns)
  summary.operatingProfitShare = '100.00'

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
): ReportRow {
  // Collect unique vendorCode(s) for this nmId group
  const vendorCodes = new Set<string>()
  let subjectName = ''
  let brandName = ''

  // Accumulators
  let salesAmount = 0           // retail_price_withdisc_rub for "Продажа"
  let returnsAmount = 0         // retail_price_withdisc_rub for "Возврат"
  let salesForPay = 0           // ppvz_for_pay for "Продажа"
  let returnsForPay = 0         // ppvz_for_pay for "Возврат"
  let salesCount = 0            // count of "Продажа"
  let returnsCount = 0          // count of "Возврат"
  let totalDelivery = 0
  let totalPenalty = 0
  let totalAdditional = 0
  let totalStorage = 0
  let totalDeduction = 0
  let totalAcceptance = 0
  let totalAcquiring = 0
  let totalCommission = 0
  let deliveredCount = 0        // count of supplierOperName = "Логистика"

  // Detailed breakdowns
  let salesNoSpp = 0            // retail_amount by "Продажа" (without SPP — approximated as retail_price * quantity)
  let returnsNoSpp = 0          // retail_amount by "Возврат"
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
    const retailPrice = d(row.retailPrice)
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
      salesAmount += retailWithDisc
      salesForPay += forPay
      salesCount += row.quantity
      salesNoSpp += retailPrice * row.quantity
      commissionOnSale += commission
      acquiringOnSale += acquiring
    } else if (isReturn) {
      returnsAmount += retailWithDisc
      returnsForPay += forPay
      returnsCount += row.quantity
      returnsNoSpp += retailPrice * row.quantity
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

    if (row.supplierOperName === 'Логистика') {
      deliveredCount++
    }
  }

  // Derived metrics
  const sale = salesAmount - returnsAmount                           // Col 4
  const toTransfer = salesForPay - returnsForPay                    // Col 5
  const boughtWithReturns = salesCount - returnsCount               // Col 11
  const boughtWithoutReturns = salesCount                           // Col 38

  // Avg price (Col 10)
  const avgPrice = safeDivide(salesAmount, boughtWithoutReturns)

  // Buyout % (Col 12)
  const buyoutPercent = safeDivide(boughtWithReturns * 100, boughtWithoutReturns)

  // Cost price from reference (Col 27)
  let costPriceTotal = 0
  let spTotalQuantity = 0
  let spTotalAmount = 0
  let spTotalCashback = 0
  let extAdTotal = 0

  const vcArray = Array.from(vendorCodes)
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
  const primaryVendorCode = vendorCodes.values().next().value ?? ''
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

    salesReturnsNoSpp: fmt(salesNoSpp - returnsNoSpp),
    salesWithSpp: fmt(salesAmount),
    returnsWithSpp: fmt(returnsAmount),
    salesNoSpp: fmt(salesNoSpp),
    returnsNoSpp: fmt(returnsNoSpp),
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
