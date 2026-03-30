import { prisma } from '@/lib/db'

const DOC_SALE = 'Продажа'
const DOC_RETURN = 'Возврат'
const OPERATION_LOGISTICS = 'Логистика'
const BONUS_CANCEL = 'К клиенту при отмене'

function getPreviousMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from, to }
}

function getLast3MonthsRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from, to }
}

export interface AutoFillData {
  /** Σ quantity строк «Продажа» за период */
  salesCount: number
  /**
   * Идентично формуле из report-calculator:
   * (salesCount − returnsCount) / (salesCount + cancellationsCount) × 100
   */
  buyoutPercent: number
  /** Текущая цена продавца с учётом скидки, без СПП (из ProductSize) */
  currentPrice: number
}

type StatRow = {
  nmId: number
  docTypeName: string
  quantity: number
  supplierOperName: string | null
  bonusTypeName: string | null
}

type AggEntry = { sales: number; returns: number; cancellations: number }

async function fetchStatRows(
  wbAccountId: string,
  ids: number[],
  from: Date,
  to: Date,
): Promise<StatRow[]> {
  return prisma.realizationReport.findMany({
    where: {
      wbAccountId,
      nmId: { in: ids },
      AND: [
        // Date filter — mirror report-calculator OR for null rrDt rows
        {
          OR: [
            { rrDt: { gte: from, lte: to } },
            { rrDt: null, dateFrom: { lte: to }, dateTo: { gte: from } },
          ],
        },
        // Row type filter: Продажа, Возврат, or Логистика-отмена
        {
          OR: [
            { docTypeName: { in: [DOC_SALE, DOC_RETURN] } },
            { supplierOperName: OPERATION_LOGISTICS, bonusTypeName: BONUS_CANCEL },
          ],
        },
      ],
    },
    select: {
      nmId: true,
      docTypeName: true,
      quantity: true,
      supplierOperName: true,
      bonusTypeName: true,
    },
  })
}

function aggregateRows(rows: StatRow[]): Map<number, AggEntry> {
  const agg = new Map<number, AggEntry>()
  for (const row of rows) {
    let e = agg.get(row.nmId)
    if (!e) { e = { sales: 0, returns: 0, cancellations: 0 }; agg.set(row.nmId, e) }
    if (row.docTypeName === DOC_SALE) {
      e.sales += row.quantity   // quantity is already positive for Продажа
    } else if (row.docTypeName === DOC_RETURN) {
      e.returns += row.quantity // positive too — same as report-calculator uses raw qty
    } else if (row.supplierOperName === OPERATION_LOGISTICS && row.bonusTypeName === BONUS_CANCEL) {
      e.cancellations++
    }
  }
  return agg
}

/**
 * Рассчитывает автозаполнение для плана продаж.
 *
 * - currentPrice:   ProductSize.price × (1 − discount/100), среднее по размерам
 * - salesCount:     Σ quantity строк «Продажа» за прошлый месяц
 * - buyoutPercent:  (Продажи − Возвраты) / (Продажи + Отмены) × 100
 *                   — идентично формуле финансовых отчётов
 *
 * Если данных за прошлый месяц нет — берём последние 3 месяца.
 */
export async function getAutoFillByNmId(
  wbAccountId: string,
  nmIds: number[],
): Promise<Map<number, AutoFillData>> {
  if (!nmIds.length) return new Map()

  // ── 1. Current prices from ProductSize ────────────────────────────────
  const products = await prisma.product.findMany({
    where: { wbAccountId, nmId: { in: nmIds } },
    select: {
      nmId: true,
      sizes: {
        select: { price: true, discount: true },
        where: { price: { not: null } },
      },
    },
  })

  const priceMap = new Map<number, number>()
  for (const prod of products) {
    const prices = prod.sizes
      .filter((s) => s.price != null)
      .map((s) => Number(s.price!) * (1 - (s.discount ?? 0) / 100))
    if (prices.length > 0) {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length
      priceMap.set(prod.nmId, Math.round(avg * 100) / 100)
    }
  }

  // ── 2. Stats from RealizationReport (previous month) ─────────────────
  const { from, to } = getPreviousMonthRange()
  let rows = await fetchStatRows(wbAccountId, nmIds, from, to)

  // Fallback to last 3 months for articles with no Продажа data
  const coveredByPrev = new Set(rows.filter((r) => r.docTypeName === DOC_SALE).map((r) => r.nmId))
  const missing = nmIds.filter((id) => !coveredByPrev.has(id))
  if (missing.length > 0) {
    const { from: f3, to: t3 } = getLast3MonthsRange()
    const fallbackRows = await fetchStatRows(wbAccountId, missing, f3, t3)
    rows = [...rows, ...fallbackRows]
  }

  const agg = aggregateRows(rows)

  // ── 3. Build result ───────────────────────────────────────────────────
  const result = new Map<number, AutoFillData>()
  for (const nmId of nmIds) {
    const currentPrice = priceMap.get(nmId) ?? 0
    const stat = agg.get(nmId)

    if (!stat || stat.sales === 0) {
      if (currentPrice > 0) {
        result.set(nmId, { salesCount: 0, buyoutPercent: 0, currentPrice })
      }
      continue
    }

    const net = Math.max(0, stat.sales - stat.returns)
    const delivered = stat.sales + stat.cancellations
    const buyoutPercent = delivered > 0 ? Math.round((net / delivered) * 100) : 0

    result.set(nmId, { salesCount: stat.sales, buyoutPercent, currentPrice })
  }

  return result
}
