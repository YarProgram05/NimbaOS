import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchFullStats } from '@/lib/wb-api/advertising'
import type {
  AdSource,
  AdStatsSyncResult,
  WbFullStatsAppType,
  WbFullStatsCampaign,
  WbFullStatsDayItem,
  WbFullStatsMetricPoint,
} from '@/types/advertising'

const SEARCH_APP_TYPE = 1
const RECOMMENDATION_APP_TYPES = new Set([32, 64, 128])
const MAX_FULLSTATS_DAYS = 31
const MAX_INT = 2_147_483_647
const MAX_PERCENT = 99.9999
const MAX_MONEY = 99_999_999.99

interface DaySourceMetrics {
  views: number
  clicks: number
  cartAdds: number
  orders: number
  spend: number
  ctr: number
  cpc: number
  bid: number | null
}

function toNumber(value: number | string | undefined | null): number {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale
  return Math.round(value * factor) / factor
}

function toDbInt(value: number): number {
  return Math.trunc(clampNumber(toNumber(value), 0, MAX_INT))
}

function toDbPercent(value: number): number {
  return roundToScale(clampNumber(toNumber(value), 0, MAX_PERCENT), 4)
}

function toDbMoney(value: number): number {
  return roundToScale(clampNumber(toNumber(value), 0, MAX_MONEY), 2)
}

function toDbNullableMoney(value: number | null): number | null {
  return value === null ? null : toDbMoney(value)
}

function toDbMetrics(metrics: DaySourceMetrics): DaySourceMetrics {
  return {
    views: toDbInt(metrics.views),
    clicks: toDbInt(metrics.clicks),
    cartAdds: toDbInt(metrics.cartAdds),
    orders: toDbInt(metrics.orders),
    spend: toDbMoney(metrics.spend),
    ctr: toDbPercent(metrics.ctr),
    cpc: toDbMoney(metrics.cpc),
    bid: toDbNullableMoney(metrics.bid),
  }
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function buildDateChunks(dateFrom: string, dateTo: string): Array<{ dateFrom: string; dateTo: string }> {
  const chunks: Array<{ dateFrom: string; dateTo: string }> = []
  const end = parseDate(dateTo)
  let current = parseDate(dateFrom)

  while (current <= end) {
    const chunkEnd = addDays(current, MAX_FULLSTATS_DAYS - 1)
    const boundedEnd = chunkEnd < end ? chunkEnd : end
    chunks.push({
      dateFrom: formatDate(current),
      dateTo: formatDate(boundedEnd),
    })
    current = addDays(boundedEnd, 1)
  }

  return chunks
}

function sumMetricPoints(
  points: WbFullStatsAppType['stats'] | undefined,
): Pick<DaySourceMetrics, 'views' | 'clicks' | 'cartAdds' | 'orders' | 'spend'> & { bid: number | null } {
  let views = 0
  let clicks = 0
  let cartAdds = 0
  let orders = 0
  let spend = 0
  let bid: number | null = null

  for (const stat of points ?? []) {
    views += toNumber(stat.views)
    clicks += toNumber(stat.clicks)
    cartAdds += toNumber(stat.atbs)
    orders += toNumber(stat.orders)
    spend += toNumber(stat.sum ?? stat.spend)
    if (bid === null && stat.price !== undefined) {
      bid = toNumber(stat.price)
    }
  }

  return { views, clicks, cartAdds, orders, spend, bid }
}

function normalizeAppStats(
  appStats: WbFullStatsAppType[] | undefined,
  source: Exclude<AdSource, 'total'>,
): DaySourceMetrics {
  const matched = (appStats ?? []).filter((item) => {
    const appType = item.appType ?? item.app_type ?? 0
    if (source === 'search') return appType === SEARCH_APP_TYPE
    return RECOMMENDATION_APP_TYPES.has(appType)
  })

  let views = 0
  let clicks = 0
  let cartAdds = 0
  let orders = 0
  let spend = 0
  let bid: number | null = null

  for (const item of matched) {
    const nestedTotals = sumMetricPoints(item.stats)
    const itemViews = toNumber(item.views) || nestedTotals.views
    const itemClicks = toNumber(item.clicks) || nestedTotals.clicks
    const itemCartAdds = toNumber(item.atbs) || nestedTotals.cartAdds
    const itemOrders = toNumber(item.orders) || nestedTotals.orders
    const itemSpend = toNumber(item.sum ?? item.spend) || nestedTotals.spend
    const itemBid = item.price !== undefined ? toNumber(item.price) : nestedTotals.bid

    views += itemViews
    clicks += itemClicks
    cartAdds += itemCartAdds
    orders += itemOrders
    spend += itemSpend

    if (bid === null && itemBid !== null) {
      bid = itemBid
    }
  }

  return {
    views,
    clicks,
    cartAdds,
    orders,
    spend,
    ctr: views > 0 ? (clicks / views) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    bid,
  }
}

function normalizeNmPoint(point: WbFullStatsMetricPoint): DaySourceMetrics {
  const views = toNumber(point.views)
  const clicks = toNumber(point.clicks)
  const cartAdds = toNumber(point.atbs)
  const orders = toNumber(point.orders)
  const spend = toNumber(point.sum ?? point.spend ?? point.sum_price)

  return {
    views,
    clicks,
    cartAdds,
    orders,
    spend,
    ctr: toNumber(point.ctr) || (views > 0 ? (clicks / views) * 100 : 0),
    cpc: toNumber(point.cpc) || (clicks > 0 ? spend / clicks : 0),
    bid: null,
  }
}

function mergeMetrics(target: DaySourceMetrics, incoming: DaySourceMetrics): DaySourceMetrics {
  const views = target.views + incoming.views
  const clicks = target.clicks + incoming.clicks
  const cartAdds = target.cartAdds + incoming.cartAdds
  const orders = target.orders + incoming.orders
  const spend = target.spend + incoming.spend

  return {
    views,
    clicks,
    cartAdds,
    orders,
    spend,
    ctr: views > 0 ? (clicks / views) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    bid: target.bid ?? incoming.bid,
  }
}

function aggregateNmStats(
  appStats: WbFullStatsAppType[] | undefined,
  source: Exclude<AdSource, 'total'>,
): Map<number, DaySourceMetrics> {
  const byNm = new Map<number, DaySourceMetrics>()
  const matched = (appStats ?? []).filter((item) => {
    const appType = item.appType ?? item.app_type ?? 0
    if (source === 'search') return appType === SEARCH_APP_TYPE
    return RECOMMENDATION_APP_TYPES.has(appType)
  })

  for (const item of matched) {
    for (const point of item.nms ?? []) {
      const nmId = point.nmId ?? point.nm_id
      if (!nmId) continue

      const existing = byNm.get(nmId) ?? {
        views: 0,
        clicks: 0,
        cartAdds: 0,
        orders: 0,
        spend: 0,
        ctr: 0,
        cpc: 0,
        bid: null,
      }

      byNm.set(nmId, mergeMetrics(existing, normalizeNmPoint(point)))
    }
  }

  return byNm
}

function mergeNmMaps(
  left: Map<number, DaySourceMetrics>,
  right: Map<number, DaySourceMetrics>,
): Map<number, DaySourceMetrics> {
  const merged = new Map<number, DaySourceMetrics>(left)

  for (const [nmId, metrics] of Array.from(right.entries())) {
    const existing = merged.get(nmId)
    merged.set(nmId, existing ? mergeMetrics(existing, metrics) : metrics)
  }

  return merged
}

function normalizeTotalStats(day: WbFullStatsDayItem): DaySourceMetrics {
  const appStats = day.apps ?? day.app_type_stats ?? day.appTypeStats

  const views = toNumber(day.views)
  const clicks = toNumber(day.clicks)
  const cartAdds = toNumber(day.atbs)
  const orders = toNumber(day.orders)
  const spend = toNumber(day.sum ?? day.spend)

  if (views > 0 || clicks > 0 || cartAdds > 0 || orders > 0 || spend > 0) {
    return {
      views,
      clicks,
      cartAdds,
      orders,
      spend,
      ctr: toNumber(day.ctr) || (views > 0 ? (clicks / views) * 100 : 0),
      cpc: toNumber(day.cpc) || (clicks > 0 ? spend / clicks : 0),
      bid: day.price !== undefined ? toNumber(day.price) : null,
    }
  }

  const search = normalizeAppStats(appStats, 'search')
  const recommendations = normalizeAppStats(appStats, 'recommendations')
  const totalViews = search.views + recommendations.views
  const totalClicks = search.clicks + recommendations.clicks
  const totalCartAdds = search.cartAdds + recommendations.cartAdds
  const totalOrders = search.orders + recommendations.orders
  const totalSpend = search.spend + recommendations.spend

  return {
    views: totalViews,
    clicks: totalClicks,
    cartAdds: totalCartAdds,
    orders: totalOrders,
    spend: totalSpend,
    ctr: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    bid: day.price !== undefined ? toNumber(day.price) : null,
  }
}

function getCampaignDays(
  campaigns: WbFullStatsCampaign[] | null | undefined,
): WbFullStatsDayItem[] {
  return (campaigns ?? []).flatMap((campaign) => campaign.days ?? campaign.daily_stats ?? [])
}

async function syncDaySourceRow(
  campaignId: string,
  date: Date,
  source: AdSource,
  metrics: DaySourceMetrics,
): Promise<void> {
  const dbMetrics = toDbMetrics(metrics)

  await prisma.adCampaignStat.upsert({
    where: {
      campaignId_date_source: {
        campaignId,
        date,
        source,
      },
    },
    create: {
      campaignId,
      date,
      source,
      views: dbMetrics.views,
      clicks: dbMetrics.clicks,
      ctr: dbMetrics.ctr,
      cpc: dbMetrics.cpc,
      spend: dbMetrics.spend,
      orders: dbMetrics.orders,
      cartAdds: dbMetrics.cartAdds,
      bid: dbMetrics.bid,
    },
    update: {
      views: dbMetrics.views,
      clicks: dbMetrics.clicks,
      ctr: dbMetrics.ctr,
      cpc: dbMetrics.cpc,
      spend: dbMetrics.spend,
      orders: dbMetrics.orders,
      cartAdds: dbMetrics.cartAdds,
      bid: dbMetrics.bid,
    },
  })
}

async function syncDayNmRows(
  campaignId: string,
  date: Date,
  source: AdSource,
  rows: Map<number, DaySourceMetrics>,
): Promise<number> {
  let upserted = 0

  for (const [nmId, metrics] of Array.from(rows.entries())) {
    const dbMetrics = toDbMetrics(metrics)

    await prisma.adCampaignNmStat.upsert({
      where: {
        campaignId_date_source_nmId: {
          campaignId,
          date,
          source,
          nmId,
        },
      },
      create: {
        campaignId,
        date,
        source,
        nmId,
        views: dbMetrics.views,
        clicks: dbMetrics.clicks,
        ctr: dbMetrics.ctr,
        cpc: dbMetrics.cpc,
        spend: dbMetrics.spend,
        orders: dbMetrics.orders,
        cartAdds: dbMetrics.cartAdds,
      },
      update: {
        views: dbMetrics.views,
        clicks: dbMetrics.clicks,
        ctr: dbMetrics.ctr,
        cpc: dbMetrics.cpc,
        spend: dbMetrics.spend,
        orders: dbMetrics.orders,
        cartAdds: dbMetrics.cartAdds,
      },
    })

    upserted++
  }

  return upserted
}

/**
 * Syncs daily advertising stats for one campaign and date range.
 */
export async function syncAdStats(params: {
  wbAccountId: string
  campaignId: string
  advertId: number
  dateFrom: string
  dateTo: string
}): Promise<AdStatsSyncResult> {
  const startMs = Date.now()
  const result: AdStatsSyncResult = {
    totalRows: 0,
    upserted: 0,
    errors: 0,
    durationMs: 0,
  }

  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: params.wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))

  const days: WbFullStatsDayItem[] = []
  for (const chunk of buildDateChunks(params.dateFrom, params.dateTo)) {
    try {
      const campaigns = await fetchFullStats(client, params.advertId, chunk.dateFrom, chunk.dateTo)
      days.push(...getCampaignDays(campaigns))
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }
  }

  for (const day of days) {
    const appStats = day.apps ?? day.app_type_stats ?? day.appTypeStats
    const dayDate = parseDate(day.date)
    const searchNmRows = aggregateNmStats(appStats, 'search')
    const recoNmRows = aggregateNmStats(appStats, 'recommendations')
    const totalNmRows = mergeNmMaps(searchNmRows, recoNmRows)
    const sourceRows: Array<{ source: AdSource; metrics: DaySourceMetrics }> = [
      { source: 'search', metrics: normalizeAppStats(appStats, 'search') },
      { source: 'recommendations', metrics: normalizeAppStats(appStats, 'recommendations') },
      { source: 'total', metrics: normalizeTotalStats(day) },
    ]

    for (const row of sourceRows) {
      result.totalRows++

      try {
        await syncDaySourceRow(params.campaignId, dayDate, row.source, row.metrics)

        result.upserted++
      } catch (error) {
        result.errors++
        result.durationMs = Date.now() - startMs
        throw error
      }
    }

    for (const [source, nmRows] of [
      ['search', searchNmRows],
      ['recommendations', recoNmRows],
      ['total', totalNmRows],
    ] as Array<[AdSource, Map<number, DaySourceMetrics>]>) {
      result.totalRows += nmRows.size

      try {
        result.upserted += await syncDayNmRows(params.campaignId, dayDate, source, nmRows)
      } catch (error) {
        result.errors++
        result.durationMs = Date.now() - startMs
        throw error
      }
    }
  }

  result.durationMs = Date.now() - startMs
  return result
}
