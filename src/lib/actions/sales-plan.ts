'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'
import type { ActionResult } from '@/types'
import { getAutoFillByNmId } from '@/lib/services/spp-calculator'
import { syncOrders } from '@/lib/services/sync-orders'
import { syncSales } from '@/lib/services/sync-sales'
import { syncFunnel } from '@/lib/services/sync-funnel'
import { calculatePlanDetail } from '@/lib/services/plan-calculator'
import type {
  SalesPlanRow,
  SalesPlanDetail,
  SalesPlanItemRow,
  SalesPlanCreateInput,
  SalesPlanItemInput,
  SalesPlanUpdateInput,
  SalesPlanItemUpdateInput,
  PlanSyncResult,
  PlanMetricsData,
} from '@/types/sales-plan'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

function serializeDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── List Plans ────────────────────────────────────────────────────────────

export async function getPlansAction(
  wbAccountId: string,
): Promise<ActionResult<SalesPlanRow[]>> {
  try {
    await requireSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    const plans = await prisma.salesPlan.findMany({
      where: { wbAccountId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const rows: SalesPlanRow[] = plans.map((p) => ({
      id: p.id,
      wbAccountId: p.wbAccountId,
      name: p.name,
      description: p.description,
      dateFrom: serializeDate(p.dateFrom),
      dateTo: serializeDate(p.dateTo),
      drrPercent: p.drrPercent.toString(),
      itemCount: p._count.items,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки планов' }
  }
}

// ─── Create Plan ───────────────────────────────────────────────────────────

export async function createPlanAction(
  input: SalesPlanCreateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession()
    if (!input.wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    if (!input.name.trim()) return { success: false, error: 'Укажите название плана' }
    if (!input.dateFrom || !input.dateTo) return { success: false, error: 'Укажите период' }

    const plan = await prisma.salesPlan.create({
      data: {
        wbAccountId: input.wbAccountId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        dateFrom: new Date(input.dateFrom),
        dateTo: new Date(input.dateTo),
        drrPercent: input.drrPercent,
      },
    })

    return { success: true, data: { id: plan.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка создания плана' }
  }
}

// ─── Get Plan Detail ───────────────────────────────────────────────────────

export async function getPlanDetailAction(
  planId: string,
): Promise<ActionResult<SalesPlanDetail>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const plan = await prisma.salesPlan.findUnique({
      where: { id: planId },
      include: { items: true },
    })

    if (!plan) return { success: false, error: 'План не найден' }

    // Enrich items with Product data (photo, category, title, brand)
    const nmIds = plan.items.map((i) => i.nmId)
    const [products, salesCounts] = await Promise.all([
      nmIds.length > 0
        ? prisma.product.findMany({
            where: { wbAccountId: plan.wbAccountId, nmId: { in: nmIds } },
            select: { nmId: true, photoUrl: true, category: true, title: true, brand: true },
          })
        : Promise.resolve([]),
      // Sales count for previous calendar month (from RealizationReport — same source as autofill)
      nmIds.length > 0
        ? (async () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const to = new Date(now.getFullYear(), now.getMonth(), 0)
            const rows = await prisma.realizationReport.findMany({
              where: {
                wbAccountId: plan.wbAccountId,
                nmId: { in: nmIds },
                docTypeName: 'Продажа',
                OR: [
                  { rrDt: { gte: from, lte: to } },
                  { rrDt: null, dateFrom: { lte: to }, dateTo: { gte: from } },
                ],
              },
              select: { nmId: true, quantity: true },
            })
            const countMap = new Map<number, number>()
            for (const row of rows) {
              countMap.set(row.nmId, (countMap.get(row.nmId) ?? 0) + Math.abs(row.quantity))
            }
            return countMap
          })()
        : Promise.resolve(new Map<number, number>()),
    ])
    const productMap = new Map(products.map((p) => [p.nmId, p]))

    const items: SalesPlanItemRow[] = plan.items.map((i) => {
      const prod = productMap.get(i.nmId)
      return {
        id: i.id,
        nmId: i.nmId,
        vendorCode: i.vendorCode,
        plannedQty: i.plannedQty,
        price: i.price.toString(),
        buyoutPercent: i.buyoutPercent.toString(),
        photoUrl: prod?.photoUrl ?? null,
        category: prod?.category ?? null,
        title: prod?.title ?? null,
        brandName: prod?.brand ?? null,
        salesCount: salesCounts.get(i.nmId) ?? null,
      }
    })

    return {
      success: true,
      data: {
        id: plan.id,
        wbAccountId: plan.wbAccountId,
        name: plan.name,
        description: plan.description,
        dateFrom: serializeDate(plan.dateFrom),
        dateTo: serializeDate(plan.dateTo),
        drrPercent: plan.drrPercent.toString(),
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        items,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки плана' }
  }
}

// ─── Update Plan ───────────────────────────────────────────────────────────

export async function updatePlanAction(
  planId: string,
  input: SalesPlanUpdateInput,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.description !== undefined) data.description = input.description?.trim() || null
    if (input.dateFrom !== undefined) data.dateFrom = new Date(input.dateFrom)
    if (input.dateTo !== undefined) data.dateTo = new Date(input.dateTo)
    if (input.drrPercent !== undefined) data.drrPercent = input.drrPercent

    if (Object.keys(data).length === 0) {
      return { success: false, error: 'Нет данных для обновления' }
    }

    await prisma.salesPlan.update({ where: { id: planId }, data })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка обновления плана' }
  }
}

// ─── Delete Plan ───────────────────────────────────────────────────────────

export async function deletePlanAction(
  planId: string,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    await prisma.salesPlan.delete({ where: { id: planId } })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка удаления плана' }
  }
}

// ─── Add Plan Items ────────────────────────────────────────────────────────

export async function addPlanItemsAction(
  planId: string,
  items: SalesPlanItemInput[],
): Promise<ActionResult<{ added: number }>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }
    if (!items.length) return { success: false, error: 'Список артикулов пуст' }

    // Auto-fill buyout % and price for items with 0
    const plan = await prisma.salesPlan.findUniqueOrThrow({
      where: { id: planId },
      select: { wbAccountId: true },
    })
    const needAutoFill = items.filter((i) => !i.buyoutPercent || !i.price)
    const autoFillMap = needAutoFill.length
      ? await getAutoFillByNmId(plan.wbAccountId, needAutoFill.map((i) => i.nmId))
      : new Map()

    const result = await prisma.salesPlanItem.createMany({
      data: items.map((i) => {
        const af = autoFillMap.get(i.nmId)
        return {
          planId,
          nmId: i.nmId,
          vendorCode: i.vendorCode,
          plannedQty: i.plannedQty,
          price: i.price || af?.currentPrice || 0,
          buyoutPercent: i.buyoutPercent || af?.buyoutPercent || 0,
        }
      }),
      skipDuplicates: true,
    })

    return { success: true, data: { added: result.count } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка добавления артикулов' }
  }
}

// ─── Add All Items From Stock ──────────────────────────────────────────────

export async function addItemsFromStockAction(
  planId: string,
  wbAccountId: string,
): Promise<ActionResult<{ added: number }>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    // Fetch all products for the account
    const products = await prisma.product.findMany({
      where: { wbAccountId },
      select: { nmId: true, vendorCode: true },
    })

    if (!products.length) return { success: false, error: 'Нет товаров в кабинете. Сначала синхронизируйте карточки.' }

    // Check which nmIds are already in the plan
    const existingItems = await prisma.salesPlanItem.findMany({
      where: { planId },
      select: { nmId: true },
    })
    const existingNmIds = new Set(existingItems.map((i) => i.nmId))

    const newProducts = products.filter((p) => !existingNmIds.has(p.nmId))
    if (!newProducts.length) return { success: true, data: { added: 0 } }

    // Auto-fill buyout % and avg price from realization reports (prev month)
    const autoFillMap = await getAutoFillByNmId(
      wbAccountId,
      newProducts.map((p) => p.nmId),
    )

    const newItems = newProducts.map((p) => {
      const af = autoFillMap.get(p.nmId)
      return {
        planId,
        nmId: p.nmId,
        vendorCode: p.vendorCode,
        plannedQty: 0,
        price: af?.currentPrice ?? 0,
        buyoutPercent: af?.buyoutPercent ?? 0,
      }
    })

    const result = await prisma.salesPlanItem.createMany({
      data: newItems,
      skipDuplicates: true,
    })

    return { success: true, data: { added: result.count } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка добавления из остатков' }
  }
}

// ─── Update Plan Item ──────────────────────────────────────────────────────

export async function updatePlanItemAction(
  itemId: string,
  input: SalesPlanItemUpdateInput,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!itemId) return { success: false, error: 'Артикул не указан' }

    const data: Record<string, unknown> = {}
    if (input.plannedQty !== undefined) data.plannedQty = input.plannedQty
    if (input.price !== undefined) data.price = input.price
    if (input.buyoutPercent !== undefined) data.buyoutPercent = input.buyoutPercent

    if (Object.keys(data).length === 0) {
      return { success: false, error: 'Нет данных для обновления' }
    }

    await prisma.salesPlanItem.update({ where: { id: itemId }, data })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка обновления артикула' }
  }
}

// ─── Remove Plan Item ──────────────────────────────────────────────────────

export async function removePlanItemAction(
  itemId: string,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!itemId) return { success: false, error: 'Артикул не указан' }

    await prisma.salesPlanItem.delete({ where: { id: itemId } })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка удаления артикула' }
  }
}

// ─── Search Products (for add-article dialog) ─────────────────────────────

export interface ProductSearchRow {
  nmId: number
  vendorCode: string
  category: string | null
  photoUrl: string | null
  title: string | null
}

export async function searchProductsForPlanAction(
  wbAccountId: string,
  query: string,
): Promise<ActionResult<ProductSearchRow[]>> {
  try {
    await requireSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    const q = query.trim()
    if (!q) return { success: true, data: [] }

    const isNumeric = /^\d+$/.test(q)

    const products = await prisma.product.findMany({
      where: {
        wbAccountId,
        ...(isNumeric
          ? { nmId: { equals: parseInt(q) } }
          : { vendorCode: { contains: q, mode: 'insensitive' as const } }),
      },
      select: { nmId: true, vendorCode: true, category: true, photoUrl: true, title: true },
      take: 50,
    })

    return { success: true, data: products }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка поиска' }
  }
}

// ─── Sync Plan Data (orders + sales) ──────────────────────────────────────

export async function syncPlanDataAction(
  planId: string,
  mode: 'today' | 'full' | 'custom',
  customFrom?: string,
  customTo?: string,
): Promise<ActionResult<PlanSyncResult>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const plan = await prisma.salesPlan.findUnique({
      where: { id: planId },
      select: { wbAccountId: true, dateFrom: true, dateTo: true, items: { select: { nmId: true } } },
    })
    if (!plan) return { success: false, error: 'План не найден' }

    // Determine sync period
    let dateFrom: string
    let dateTo: string
    if (mode === 'today') {
      dateFrom = new Date().toISOString().slice(0, 10)
      dateTo = dateFrom
    } else if (mode === 'custom' && customFrom) {
      dateFrom = customFrom
      dateTo = customTo ?? plan.dateTo.toISOString().slice(0, 10)
    } else {
      // full — from plan start to plan end
      dateFrom = plan.dateFrom.toISOString().slice(0, 10)
      dateTo = plan.dateTo.toISOString().slice(0, 10)
    }

    // Orders + Sales: statistics domain (1 req/min), must be sequential (shared throttle)
    // Funnel: analytics domain (3 req/min), runs in PARALLEL with orders/sales
    const nmIds = Array.from(new Set(plan.items.map((i) => i.nmId)))

    const [ordersSalesResult, funnelResult] = await Promise.all([
      (async () => {
        const orders = await syncOrders(plan.wbAccountId, dateFrom)
        const sales = await syncSales(plan.wbAccountId, dateFrom)
        return { orders, sales }
      })(),
      syncFunnel(plan.wbAccountId, nmIds, dateFrom, dateTo),
    ])

    return {
      success: true,
      data: {
        orders: ordersSalesResult.orders,
        sales: ordersSalesResult.sales,
        funnel: funnelResult,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка синхронизации' }
  }
}

// ─── Get Plan Metrics (calculated daily breakdown) ──────────────────────────

export async function getPlanMetricsAction(
  planId: string,
): Promise<ActionResult<PlanMetricsData>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const plan = await prisma.salesPlan.findUnique({
      where: { id: planId },
      select: { wbAccountId: true, dateFrom: true, dateTo: true },
    })
    if (!plan) return { success: false, error: 'План не найден' }

    const dateFrom = serializeDate(plan.dateFrom)
    const dateTo = serializeDate(plan.dateTo)

    const data = await calculatePlanDetail(planId, plan.wbAccountId, dateFrom, dateTo)

    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка расчёта метрик' }
  }
}

// ─── Export Plan to XLSX ────────────────────────────────────────────────────

const METRIC_LABELS: { key: string; label: string }[] = [
  { key: 'revenueOrders', label: 'Выр. заказы' },
  { key: 'ordersCount', label: 'Кол-во заказов' },
  { key: 'revenueSales', label: 'Выр. продажи' },
  { key: 'boughtQty', label: 'Выкупили, шт.' },
  { key: 'visits', label: 'Переходы, шт.' },
  { key: 'cartPercent', label: 'Корзина, %' },
  { key: 'cartQty', label: 'Корзина, шт.' },
  { key: 'orderPercent', label: 'Заказ, %' },
  { key: 'avgPrice', label: 'Ср. цена' },
]

export async function exportPlanXlsxAction(
  planId: string,
): Promise<ActionResult<{ base64: string; filename: string }>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const plan = await prisma.salesPlan.findUnique({
      where: { id: planId },
      select: { name: true, wbAccountId: true, dateFrom: true, dateTo: true, drrPercent: true },
    })
    if (!plan) return { success: false, error: 'План не найден' }

    const dateFrom = serializeDate(plan.dateFrom)
    const dateTo = serializeDate(plan.dateTo)
    const metrics = await calculatePlanDetail(planId, plan.wbAccountId, dateFrom, dateTo)

    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Сводка ─────────────────────────────────────────────
    const summaryHeaders = [
      'Артикул поставщика', 'Арт. ВБ', 'Категория',
      'План, шт.', 'Цена', 'Выкуп, %',
      'Факт, шт.', 'Выполнение, %',
      'Выр. заказы', 'Выр. продажи', 'Кол-во заказов',
      'План/день', 'Факт/день',
    ]
    const summaryRows = metrics.articles.map((a) => [
      a.vendorCode,
      a.nmId,
      a.category ?? '',
      a.plannedQty,
      parseFloat(a.price),
      parseFloat(a.buyoutPercent),
      a.summary.factMonth,
      a.plannedQty > 0
        ? Math.round((a.summary.factMonth / a.plannedQty) * 100)
        : 0,
      parseFloat(a.summary.revenueOrdersTotal),
      parseFloat(a.summary.revenueSalesTotal),
      a.summary.ordersCountTotal,
      parseFloat(a.summary.planDay),
      parseFloat(a.summary.factDay),
    ])

    const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows])
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Сводка')

    // ── Sheet 2: Детализация ────────────────────────────────────────
    // Each article gets a block: header row + metric rows × dates
    const detailData: (string | number)[][] = []

    for (const article of metrics.articles) {
      // Article header row
      detailData.push([`${article.vendorCode} (${article.nmId})`])

      // Column headers: Метрика | ПЛАН/МЕС | ФАКТ/МЕС | ПЛАН/ДЕНЬ | ФАКТ/ДЕНЬ | dates...
      const dates = article.dailyBreakdown.map((d) => d.date)
      detailData.push([
        'Метрика', 'ПЛАН/МЕС', 'ФАКТ/МЕС', 'ПЛАН/ДЕНЬ', 'ФАКТ/ДЕНЬ',
        ...dates,
      ])

      // Build a date → metrics map
      const dayMap = new Map(article.dailyBreakdown.map((d) => [d.date, d]))

      for (const metric of METRIC_LABELS) {
        const row: (string | number)[] = [metric.label]

        // Summary columns
        const s = article.summary
        switch (metric.key) {
          case 'boughtQty':
            row.push(s.planMonth, s.factMonth, parseFloat(s.planDay), parseFloat(s.factDay))
            break
          case 'revenueOrders':
            row.push('', parseFloat(s.revenueOrdersTotal), '', '')
            break
          case 'ordersCount':
            row.push('', s.ordersCountTotal, '', '')
            break
          case 'revenueSales':
            row.push('', parseFloat(s.revenueSalesTotal), '', '')
            break
          default:
            row.push('', '', '', '')
        }

        // Daily values
        for (const date of dates) {
          const m = dayMap.get(date)
          if (!m) {
            row.push('')
            continue
          }
          switch (metric.key) {
            case 'revenueOrders': row.push(parseFloat(m.revenueOrders)); break
            case 'ordersCount': row.push(m.ordersCount); break
            case 'revenueSales': row.push(parseFloat(m.revenueSales)); break
            case 'boughtQty': row.push(m.boughtQty); break
            case 'visits': row.push(m.visits); break
            case 'cartPercent': row.push(parseFloat(m.cartPercent)); break
            case 'cartQty': row.push(m.cartQty); break
            case 'orderPercent': row.push(parseFloat(m.orderPercent)); break
            case 'avgPrice': row.push(parseFloat(m.avgPrice)); break
            default: row.push('')
          }
        }

        detailData.push(row)
      }

      // Empty row between articles
      detailData.push([])
    }

    const wsDetail = XLSX.utils.aoa_to_sheet(detailData)
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Детализация')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64 = Buffer.from(buf).toString('base64')
    const filename = `plan_${plan.name.replace(/[^\w\u0400-\u04ff]/gi, '_')}_${dateFrom}_${dateTo}.xlsx`

    return { success: true, data: { base64, filename } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка экспорта' }
  }
}
