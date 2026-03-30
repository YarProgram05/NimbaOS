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
} from '@/types/advertising'

const SEARCH_APP_TYPE = 1
const RECOMMENDATION_APP_TYPES = new Set([32, 64, 128])

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
  return Number(value ?? 0)
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
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

function getCampaignDays(campaigns: WbFullStatsCampaign[]): WbFullStatsDayItem[] {
  const campaign = campaigns[0]
  return campaign?.days ?? campaign?.daily_stats ?? []
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

  let campaigns
  try {
    campaigns = await fetchFullStats(client, params.advertId, params.dateFrom, params.dateTo)
  } catch {
    result.errors++
    result.durationMs = Date.now() - startMs
    return result
  }

  const days = getCampaignDays(campaigns)

  for (const day of days) {
    const appStats = day.apps ?? day.app_type_stats ?? day.appTypeStats
    const dayDate = parseDate(day.date)
    const sourceRows: Array<{ source: AdSource; metrics: DaySourceMetrics }> = [
      { source: 'search', metrics: normalizeAppStats(appStats, 'search') },
      { source: 'recommendations', metrics: normalizeAppStats(appStats, 'recommendations') },
      { source: 'total', metrics: normalizeTotalStats(day) },
    ]

    for (const row of sourceRows) {
      result.totalRows++

      try {
        await prisma.adCampaignStat.upsert({
          where: {
            campaignId_date_source: {
              campaignId: params.campaignId,
              date: dayDate,
              source: row.source,
            },
          },
          create: {
            campaignId: params.campaignId,
            date: dayDate,
            source: row.source,
            views: row.metrics.views,
            clicks: row.metrics.clicks,
            ctr: row.metrics.ctr,
            cpc: row.metrics.cpc,
            spend: row.metrics.spend,
            orders: row.metrics.orders,
            cartAdds: row.metrics.cartAdds,
            bid: row.metrics.bid,
          },
          update: {
            views: row.metrics.views,
            clicks: row.metrics.clicks,
            ctr: row.metrics.ctr,
            cpc: row.metrics.cpc,
            spend: row.metrics.spend,
            orders: row.metrics.orders,
            cartAdds: row.metrics.cartAdds,
            bid: row.metrics.bid,
          },
        })

        result.upserted++
      } catch {
        result.errors++
      }
    }
  }

  result.durationMs = Date.now() - startMs
  return result
}
