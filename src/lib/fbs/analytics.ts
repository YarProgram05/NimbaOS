interface NumberLike {
  toString(): string
}

export interface FbsAnalyticsOrder {
  externalOrderId: bigint
  nmId: number
  vendorCode: string | null
  supplierStatus: string
  wbStatus: string
}

export interface FbsAnalyticsFinanceRow {
  orderId: bigint | null
  deliveryMethod: string | null
  nmId: number
  vendorCode: string
  docTypeName: string
  quantity: number
  retailPriceWithDisc: NumberLike
  ppvzSppPrc: NumberLike
  ppvzForPay: NumberLike
  deliveryRub: NumberLike
  storageFee: NumberLike
  acceptance: NumberLike
  additionalPayment: NumberLike
  penalty: NumberLike
  deduction: NumberLike
}

const CANCELED_WB_STATUSES = new Set([
  'canceled',
  'canceled_by_client',
  'declined_by_client',
  'defect',
])

export function isFbsCanceledOrder(order: Pick<FbsAnalyticsOrder, 'supplierStatus' | 'wbStatus'>) {
  return order.supplierStatus === 'cancel' || CANCELED_WB_STATUSES.has(order.wbStatus)
}

export function isFbsFinanceRow(
  row: Pick<FbsAnalyticsFinanceRow, 'orderId' | 'deliveryMethod'>,
  knownFbsOrderIds: ReadonlySet<string>,
) {
  return (
    row.deliveryMethod?.toLowerCase().includes('fbs') === true ||
    (row.orderId !== null && knownFbsOrderIds.has(row.orderId.toString()))
  )
}

export function summarizeFbsAnalytics(input: {
  orders: FbsAnalyticsOrder[]
  financeRows: FbsAnalyticsFinanceRow[]
  knownFbsOrderIds: ReadonlySet<string>
  costPriceByVendorCode?: ReadonlyMap<string, number>
  taxRate?: number
}) {
  let sales = 0
  let returns = 0
  let revenue = 0
  let toTransfer = 0
  const financeByArticle = new Map<
    string,
    {
      nmId: number
      vendorCode: string
      orders: number
      cancellations: number
      sales: number
      returns: number
      revenue: number
      toTransfer: number
      directExpenses: number
      costPrice: number
      taxes: number
      operatingProfit: number
      marginality: number
      profitability: number
      buyoutPercent: number
    }
  >()

  const getArticle = (nmId: number, vendorCode: string) => {
    const key = `${nmId}:${vendorCodeKey(vendorCode)}`
    const article = financeByArticle.get(key) ?? {
      nmId,
      vendorCode: vendorCode || (nmId > 0 ? String(nmId) : 'Без артикула'),
      orders: 0,
      cancellations: 0,
      sales: 0,
      returns: 0,
      revenue: 0,
      toTransfer: 0,
      directExpenses: 0,
      costPrice: 0,
      taxes: 0,
      operatingProfit: 0,
      marginality: 0,
      profitability: 0,
      buyoutPercent: 0,
    }
    financeByArticle.set(key, article)
    return article
  }

  for (const order of input.orders) {
    const article = getArticle(order.nmId, order.vendorCode ?? '')
    article.orders += 1
    if (isFbsCanceledOrder(order)) article.cancellations += 1
  }

  for (const row of input.financeRows) {
    if (!isFbsFinanceRow(row, input.knownFbsOrderIds)) continue

    const article = getArticle(row.nmId, row.vendorCode)
    article.directExpenses +=
      Number(row.deliveryRub) +
      Number(row.storageFee) +
      Number(row.acceptance) +
      Number(row.additionalPayment) +
      Number(row.penalty) +
      Number(row.deduction)

    const docType = row.docTypeName.trim().toLowerCase()
    const isSale = docType === 'продажа'
    const isReturn = docType === 'возврат'
    if (!isSale && !isReturn) continue

    const quantity = Math.abs(row.quantity)
    if (quantity === 0) continue

    const saleAmount =
      Number(row.retailPriceWithDisc) * (1 - Number(row.ppvzSppPrc) / 100)
    const payout = Number(row.ppvzForPay)
    const unitCost = input.costPriceByVendorCode?.get(vendorCodeKey(row.vendorCode)) ?? 0

    if (isSale) {
      sales += quantity
      revenue += saleAmount
      toTransfer += payout
      article.sales += quantity
      article.revenue += saleAmount
      article.toTransfer += payout
      article.costPrice += unitCost * quantity
    } else {
      returns += quantity
      revenue -= saleAmount
      toTransfer -= payout
      article.returns += quantity
      article.revenue -= saleAmount
      article.toTransfer -= payout
      article.costPrice -= unitCost * quantity
    }
  }

  for (const article of Array.from(financeByArticle.values())) {
    article.taxes = Math.max(0, article.revenue * ((input.taxRate ?? 0) / 100))
    article.operatingProfit =
      article.toTransfer - article.directExpenses - article.costPrice - article.taxes
    article.marginality = article.revenue > 0
      ? (article.operatingProfit / article.revenue) * 100
      : 0
    const expenses = article.revenue - article.operatingProfit
    article.profitability = expenses > 0 ? (article.operatingProfit / expenses) * 100 : 0
    const delivered = article.sales + article.cancellations
    article.buyoutPercent = delivered > 0
      ? (Math.max(0, article.sales - article.returns) / delivered) * 100
      : 0
  }

  const articleRows = Array.from(financeByArticle.values())
  const operatingProfit = articleRows.reduce((sum, article) => sum + article.operatingProfit, 0)
  const totalExpenses = revenue - operatingProfit
  const marginality = revenue > 0 ? (operatingProfit / revenue) * 100 : 0
  const profitability = totalExpenses > 0 ? (operatingProfit / totalExpenses) * 100 : 0
  const delivered = sales + input.orders.filter(isFbsCanceledOrder).length
  const buyoutPercent = delivered > 0 ? (Math.max(0, sales - returns) / delivered) * 100 : 0

  return {
    orders: input.orders.length,
    cancellations: input.orders.filter(isFbsCanceledOrder).length,
    sales,
    returns,
    revenue,
    toTransfer,
    operatingProfit,
    marginality,
    profitability,
    buyoutPercent,
    financeByArticle: articleRows.sort(
      (left, right) => right.revenue - left.revenue || left.vendorCode.localeCompare(right.vendorCode, 'ru'),
    ),
  }
}

function vendorCodeKey(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU')
}
