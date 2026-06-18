import { prisma } from '@/lib/db'
import {
  articleVersionGroupKey,
  buildArticleVersionMap,
  findArticleVersionsForPeriod,
  resolveArticleVersion,
} from '@/lib/services/article-versions'
import type {
  DailyMetrics,
  ArticleSummary,
  ArticleDetailData,
  PlanMetricsData,
} from '@/types/sales-plan'

// ── Helpers ─────────────────────────────────────────────────────

/** Decimal / BigInt → number */
function d(v: unknown): number {
  if (v === null || v === undefined) return 0
  return Number(v)
}

function toFixed2(n: number): string {
  return n.toFixed(2)
}

function toFixed4(n: number): string {
  return n.toFixed(4)
}

/** Generate array of YYYY-MM-DD strings between dateFrom and dateTo inclusive */
function generateDateRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = []
  const current = new Date(dateFrom)
  const end = new Date(dateTo)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/** Date → YYYY-MM-DD key */
function dateKey(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

// ── Main calculator ─────────────────────────────────────────────

export async function calculatePlanDetail(
  planId: string,
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<PlanMetricsData> {
  const dfrom = new Date(dateFrom)
  const dto = new Date(dateTo)

  // 1. Parallel DB queries
  const [plan, orders, sales, funnelStats, products, articleVersions] = await Promise.all([
    prisma.salesPlan.findUniqueOrThrow({
      where: { id: planId },
      include: { items: true },
    }),
    prisma.wbOrder.findMany({
      where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      select: { nmId: true, date: true, finishedPrice: true, isCancel: true },
    }),
    prisma.wbSale.findMany({
      where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      select: { nmId: true, date: true, priceWithDisc: true, isReturn: true },
    }),
    prisma.wbFunnelStat.findMany({
      where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      select: {
        nmId: true,
        date: true,
        openCount: true,
        addToCartCount: true,
        addToCartConversion: true,
        cartCount: true,
        cartToOrderConversion: true,
        ordersCount: true,
        ordersSumRub: true,
      },
    }),
    prisma.product.findMany({
      where: { wbAccountId },
      select: { nmId: true, photoUrl: true, category: true },
    }),
    findArticleVersionsForPeriod(wbAccountId, dfrom, dto),
  ])

  const productMap = new Map(products.map((p) => [p.nmId, p]))
  const versionsByNm = buildArticleVersionMap(articleVersions)

  // 2. Index orders by nmId → date
  type OrderAgg = { revenue: number; count: number }
  const orderIndex = new Map<string, OrderAgg>() // key: "nmId:date"
  for (const o of orders) {
    if (o.isCancel) continue
    const key = `${o.nmId}:${dateKey(o.date)}`
    const agg = orderIndex.get(key) ?? { revenue: 0, count: 0 }
    agg.revenue += d(o.finishedPrice)
    agg.count += 1
    orderIndex.set(key, agg)
  }

  // 3. Index sales by nmId → date
  type SaleAgg = { revenue: number; count: number }
  const saleIndex = new Map<string, SaleAgg>()
  for (const s of sales) {
    if (s.isReturn) continue
    const key = `${s.nmId}:${dateKey(s.date)}`
    const agg = saleIndex.get(key) ?? { revenue: 0, count: 0 }
    agg.revenue += d(s.priceWithDisc)
    agg.count += 1
    saleIndex.set(key, agg)
  }

  // 4. Index funnel by nmId → date
  const funnelIndex = new Map<string, typeof funnelStats[number]>()
  for (const f of funnelStats) {
    const key = `${f.nmId}:${dateKey(f.date)}`
    funnelIndex.set(key, f)
  }

  // 5. Build daily breakdown for each plan item
  const allDates = generateDateRange(dateFrom, dateTo)
  const totalDays = allDates.length

  // Days elapsed (up to today)
  const today = new Date().toISOString().slice(0, 10)
  const daysElapsed = allDates.filter((d) => d <= today).length || 1

  const articles: ArticleDetailData[] = plan.items.flatMap((item) => {
    const prod = productMap.get(item.nmId)
    const groups = new Map<string, { vendorCode: string; dates: string[] }>()

    for (const date of allDates) {
      const version = resolveArticleVersion(versionsByNm, item.nmId, parseDateKey(date))
      const key = articleVersionGroupKey(item.nmId, version)
      const group = groups.get(key) ?? {
        vendorCode: version?.vendorCode ?? item.vendorCode,
        dates: [],
      }
      group.dates.push(date)
      groups.set(key, group)
    }

    return Array.from(groups.values()).map((group) => {
      let factMonthBought = 0
      let revenueOrdersTotal = 0
      let revenueSalesTotal = 0
      let ordersCountTotal = 0

      const dailyBreakdown: DailyMetrics[] = group.dates.map((date) => {
        const key = `${item.nmId}:${date}`

        // Orders
        const orderAgg = orderIndex.get(key)
        const revenueOrders = orderAgg?.revenue ?? 0
        const ordersCount = orderAgg?.count ?? 0

        // Sales
        const saleAgg = saleIndex.get(key)
        const revenueSales = saleAgg?.revenue ?? 0
        const boughtQty = saleAgg?.count ?? 0

        // Avg price
        const avgPrice = boughtQty > 0 ? revenueSales / boughtQty : 0

        // Funnel
        const funnel = funnelIndex.get(key)
        const visits = funnel ? d(funnel.openCount) : 0
        const cartPercent = funnel ? d(funnel.addToCartConversion) : 0
        const cartQty = funnel ? d(funnel.cartCount) : 0
        const orderPercent = funnel ? d(funnel.cartToOrderConversion) : 0

        // Accumulate totals
        factMonthBought += boughtQty
        revenueOrdersTotal += revenueOrders
        revenueSalesTotal += revenueSales
        ordersCountTotal += ordersCount

        return {
          date,
          revenueOrders: toFixed2(revenueOrders),
          ordersCount,
          revenueSales: toFixed2(revenueSales),
          boughtQty,
          avgPrice: toFixed2(avgPrice),
          visits,
          cartPercent: toFixed4(cartPercent),
          cartQty,
          orderPercent: toFixed4(orderPercent),
        }
      })

      const hasSplitVersions = groups.size > 1
      const planMonth = hasSplitVersions && totalDays > 0
        ? Number((item.plannedQty * (group.dates.length / totalDays)).toFixed(2))
        : item.plannedQty
      const planDay = group.dates.length > 0 ? planMonth / group.dates.length : 0
      const groupDaysElapsed = group.dates.filter((date) => date <= today).length || daysElapsed
      const factDay = groupDaysElapsed > 0 ? factMonthBought / groupDaysElapsed : 0

      const summary: ArticleSummary = {
        planMonth,
        factMonth: factMonthBought,
        planDay: toFixed2(planDay),
        factDay: toFixed2(factDay),
        revenueOrdersTotal: toFixed2(revenueOrdersTotal),
        revenueSalesTotal: toFixed2(revenueSalesTotal),
        ordersCountTotal,
      }

      return {
        nmId: item.nmId,
        vendorCode: group.vendorCode,
        photoUrl: prod?.photoUrl ?? null,
        category: prod?.category ?? null,
        plannedQty: planMonth,
        price: item.price.toString(),
        buyoutPercent: item.buyoutPercent.toString(),
        summary,
        dailyBreakdown,
      }
    })
  })

  return {
    planId,
    dateFrom,
    dateTo,
    articles,
  }
}
