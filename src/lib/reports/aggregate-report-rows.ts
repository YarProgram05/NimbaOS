import type { ReportRow } from '@/types/reports'

interface AggregateReportRowsOptions {
  nmId?: number
  subjectName?: string
  vendorCode?: string
  brandName?: string
}

export function aggregateReportRows(
  rows: ReportRow[],
  options: AggregateReportRowsOptions = {},
): ReportRow {
  const totalSale = sumStr(rows, 'sale')
  const totalToTransfer = sumStr(rows, 'toTransfer')
  const totalToPay = sumStr(rows, 'totalToPay')
  const totalOperatingProfit = sumStr(rows, 'operatingProfit')
  const totalBoughtWithReturns = sumNum(rows, 'boughtWithReturns')
  const totalBoughtWithoutReturns = sumNum(rows, 'boughtWithoutReturns')
  const totalDelivered = sumNum(rows, 'delivered')
  const totalCostPrice = sumStr(rows, 'costPrice')
  const totalAdAll = sumStr(rows, 'adAll')
  const totalLogistics = sumStr(rows, 'logistics')
  const totalStorageFee = sumStr(rows, 'storageFee')
  const totalSalesWithSpp = sumStr(rows, 'salesWithSpp')
  const totalCommissionOnSale = sumStr(rows, 'commissionOnSale')
  const totalCommissionOnReturn = sumStr(rows, 'commissionOnReturn')
  const totalAcquiringOnSale = sumStr(rows, 'acquiringOnSale')
  const totalAcquiringOnReturn = sumStr(rows, 'acquiringOnReturn')

  return {
    nmId: options.nmId ?? 0,
    subjectName: options.subjectName ?? '',
    vendorCode: options.vendorCode ?? '',
    brandName: options.brandName ?? '',

    sale: fmt(totalSale),
    toTransfer: fmt(totalToTransfer),
    totalToPay: fmt(totalToPay),
    operatingProfit: fmt(totalOperatingProfit),
    operatingProfitUnit: safeDivide(totalOperatingProfit, totalBoughtWithReturns),
    operatingProfitShare: fmt(sumStr(rows, 'operatingProfitShare')),
    avgPrice: totalBoughtWithoutReturns > 0 && totalBoughtWithReturns > 0
      ? safeDivide(totalSalesWithSpp, totalBoughtWithoutReturns)
      : '0.00',

    boughtWithReturns: totalBoughtWithReturns,
    buyoutPercent: safeDivideMinZero(totalBoughtWithReturns * 100, totalDelivered),
    boughtWithoutReturns: totalBoughtWithoutReturns,
    returns: sumNum(rows, 'returns'),

    marginality: safeMarginality(totalOperatingProfit, totalSale),
    rentability: safeDivide(totalOperatingProfit * 100, totalCostPrice),

    adBalance: fmt(sumStr(rows, 'adBalance')),
    adAll: fmt(totalAdAll),
    drr: safeDivide(totalAdAll * 100, totalSale),

    logistics: fmt(totalLogistics),
    logisticsUnit: safeDivide(totalLogistics, totalBoughtWithReturns),
    delivered: totalDelivered,
    logisticsFromSalesPercent: safeDivideMinZero(totalLogistics * 100, totalSale),

    externalAd: fmt(sumStr(rows, 'externalAd')),
    selfPurchaseCost: fmt(sumStr(rows, 'selfPurchaseCost')),
    cashbackDistributions: fmt(sumStr(rows, 'cashbackDistributions')),
    selfPurchaseAmount: fmt(sumStr(rows, 'selfPurchaseAmount')),

    storageFromSalesPercent: safeDivideMinZero(totalStorageFee * 100, totalSale),
    costPrice: fmt(totalCostPrice),
    storageFee: fmt(totalStorageFee),
    acceptance: fmt(sumStr(rows, 'acceptance')),
    additionalPayment: fmt(sumStr(rows, 'additionalPayment')),
    penalty: fmt(sumStr(rows, 'penalty')),
    taxes: fmt(sumStr(rows, 'taxes')),
    commission: fmt(totalCommissionOnSale - totalCommissionOnReturn),
    selfPurchases: fmt(sumStr(rows, 'selfPurchases')),
    acquiringFee: fmt(totalAcquiringOnSale - totalAcquiringOnReturn),

    cancellations: sumNum(rows, 'cancellations'),

    salesReturnsNoSpp: fmt(sumStr(rows, 'salesReturnsNoSpp')),
    salesWithSpp: fmt(sumStr(rows, 'salesWithSpp')),
    returnsWithSpp: fmt(sumStr(rows, 'returnsWithSpp')),
    salesNoSpp: fmt(sumStr(rows, 'salesNoSpp')),
    returnsNoSpp: fmt(sumStr(rows, 'returnsNoSpp')),
    commissionOnSale: fmt(sumStr(rows, 'commissionOnSale')),
    commissionOnReturn: fmt(sumStr(rows, 'commissionOnReturn')),
    deductions: fmt(sumStr(rows, 'deductions')),
    salesToTransfer: fmt(sumStr(rows, 'salesToTransfer')),
    returnsToTransfer: fmt(sumStr(rows, 'returnsToTransfer')),
    acquiringOnSale: fmt(sumStr(rows, 'acquiringOnSale')),
    tags: '',
    acquiringOnReturn: fmt(sumStr(rows, 'acquiringOnReturn')),
  }
}

function sumStr(rows: ReportRow[], key: keyof ReportRow): number {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)
}

function sumNum(rows: ReportRow[], key: keyof ReportRow): number {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0)
}

function safeDivide(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00'
  return (numerator / denominator).toFixed(2)
}

function safeDivideMinZero(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00'
  return Math.max(0, numerator / denominator).toFixed(2)
}

function safeMarginality(operatingProfit: number, sale: number): string {
  if (operatingProfit < 0 && sale < 0) return '0.00'
  return safeDivide(operatingProfit * 100, sale)
}

function fmt(value: number): string {
  return value.toFixed(2)
}
