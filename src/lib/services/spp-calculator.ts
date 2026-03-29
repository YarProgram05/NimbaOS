import { prisma } from '@/lib/db'

const DOC_SALE = 'Продажа'
const DOC_RETURN = 'Возврат'

/** Returns [firstDayOfPrevMonth, lastDayOfPrevMonth] as Date objects */
function getPreviousMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0) // last day of prev month
  return { from, to }
}

export interface AutoFillData {
  buyoutPercent: number  // 0–100
  avgPrice: number       // средняя цена продажи (retailPriceWithDisc)
}

/**
 * Рассчитывает средний % выкупа и среднюю цену по каждому nmId
 * из RealizationReport за прошлый календарный месяц.
 *
 * buyoutPercent = salesQty / (salesQty + returnsQty) × 100
 * avgPrice = Σ retailPriceWithDisc (продажи) / salesQty
 */
export async function getAutoFillByNmId(
  wbAccountId: string,
  nmIds: number[],
): Promise<Map<number, AutoFillData>> {
  const result = new Map<number, AutoFillData>()
  if (!nmIds.length) return result

  const { from, to } = getPreviousMonthRange()

  const rows = await prisma.realizationReport.findMany({
    where: {
      wbAccountId,
      nmId: { in: nmIds },
      rrDt: { gte: from, lte: to },
      docTypeName: { in: [DOC_SALE, DOC_RETURN] },
    },
    select: {
      nmId: true,
      docTypeName: true,
      quantity: true,
      retailPriceWithDisc: true,
    },
  })

  const agg = new Map<number, { sales: number; returns: number; revenueSum: number }>()
  for (const row of rows) {
    let entry = agg.get(row.nmId)
    if (!entry) {
      entry = { sales: 0, returns: 0, revenueSum: 0 }
      agg.set(row.nmId, entry)
    }
    const qty = Math.abs(row.quantity)
    if (row.docTypeName === DOC_SALE) {
      entry.sales += qty
      entry.revenueSum += Number(row.retailPriceWithDisc) * qty
    } else {
      entry.returns += qty
    }
  }

  agg.forEach(({ sales, returns, revenueSum }, nmId) => {
    const total = sales + returns
    const buyoutPercent = total > 0 ? Math.round((sales / total) * 100) : 0
    const avgPrice = sales > 0 ? Math.round(revenueSum / sales) : 0
    result.set(nmId, { buyoutPercent, avgPrice })
  })

  return result
}
