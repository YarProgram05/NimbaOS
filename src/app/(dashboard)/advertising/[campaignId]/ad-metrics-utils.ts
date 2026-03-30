import type { AdCampaignMetrics, AdDailyMetrics, AdSource, AdStatRow } from '@/types/advertising'

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function createEmptyDailyMetrics(date: string): AdDailyMetrics {
  return {
    date,
    searchViews: 0,
    searchClicks: 0,
    searchCartAdds: 0,
    searchOrders: 0,
    searchSpend: '0.00',
    searchCtr: '0.00',
    searchCpc: '0.00',
    searchCpo: '0.00',
    searchBid: null,
    recoViews: 0,
    recoClicks: 0,
    recoCartAdds: 0,
    recoOrders: 0,
    recoSpend: '0.00',
    recoCtr: '0.00',
    recoCpc: '0.00',
    recoCpo: '0.00',
    recoBid: null,
    totalViews: 0,
    totalClicks: 0,
    totalCartAdds: 0,
    totalOrders: 0,
    totalSpend: '0.00',
    totalCtr: '0.00',
    totalCpc: '0.00',
    totalCpo: '0.00',
    totalBid: null,
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildCampaignMetrics(rows: AdStatRow[]): AdCampaignMetrics {
  const byDate = new Map<string, AdDailyMetrics>()

  for (const row of rows) {
    const existing = byDate.get(row.date) ?? createEmptyDailyMetrics(row.date)

    const source = row.source as AdSource
    const spend = parseFloat(row.spend) || 0
    const bid = row.bid

    if (source === 'search') {
      existing.searchViews = row.views
      existing.searchClicks = row.clicks
      existing.searchCartAdds = row.cartAdds
      existing.searchOrders = row.orders
      existing.searchSpend = row.spend
      existing.searchCtr = row.ctr
      existing.searchCpc = row.cpc
      existing.searchCpo = row.orders > 0 ? (spend / row.orders).toFixed(2) : '0.00'
      existing.searchBid = bid
    }

    if (source === 'recommendations') {
      existing.recoViews = row.views
      existing.recoClicks = row.clicks
      existing.recoCartAdds = row.cartAdds
      existing.recoOrders = row.orders
      existing.recoSpend = row.spend
      existing.recoCtr = row.ctr
      existing.recoCpc = row.cpc
      existing.recoCpo = row.orders > 0 ? (spend / row.orders).toFixed(2) : '0.00'
      existing.recoBid = bid
    }

    if (source === 'total') {
      existing.totalViews = row.views
      existing.totalClicks = row.clicks
      existing.totalCartAdds = row.cartAdds
      existing.totalOrders = row.orders
      existing.totalSpend = row.spend
      existing.totalCtr = row.ctr
      existing.totalCpc = row.cpc
      existing.totalCpo = row.orders > 0 ? (spend / row.orders).toFixed(2) : '0.00'
      existing.totalBid = bid
    }

    if (!existing.totalViews && source !== 'total') {
      existing.totalViews = existing.searchViews + existing.recoViews
      existing.totalClicks = existing.searchClicks + existing.recoClicks
      existing.totalCartAdds = existing.searchCartAdds + existing.recoCartAdds
      existing.totalOrders = existing.searchOrders + existing.recoOrders

      const totalSpend = (parseFloat(existing.searchSpend) || 0) + (parseFloat(existing.recoSpend) || 0)
      existing.totalSpend = totalSpend.toFixed(2)
      existing.totalCtr = existing.totalViews > 0
        ? ((existing.totalClicks / existing.totalViews) * 100).toFixed(2)
        : '0.00'
      existing.totalCpc = existing.totalClicks > 0
        ? (totalSpend / existing.totalClicks).toFixed(2)
        : '0.00'
      existing.totalCpo = existing.totalOrders > 0
        ? (totalSpend / existing.totalOrders).toFixed(2)
        : '0.00'
      existing.totalBid = existing.searchBid ?? existing.recoBid
    }

    byDate.set(row.date, existing)
  }

  const daily = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))

  const searchViews = daily.reduce((sum, item) => sum + item.searchViews, 0)
  const searchClicks = daily.reduce((sum, item) => sum + item.searchClicks, 0)
  const searchCartAdds = daily.reduce((sum, item) => sum + item.searchCartAdds, 0)
  const searchOrders = daily.reduce((sum, item) => sum + item.searchOrders, 0)
  const searchSpend = daily.reduce((sum, item) => sum + (parseFloat(item.searchSpend) || 0), 0)

  const recoViews = daily.reduce((sum, item) => sum + item.recoViews, 0)
  const recoClicks = daily.reduce((sum, item) => sum + item.recoClicks, 0)
  const recoCartAdds = daily.reduce((sum, item) => sum + item.recoCartAdds, 0)
  const recoOrders = daily.reduce((sum, item) => sum + item.recoOrders, 0)
  const recoSpend = daily.reduce((sum, item) => sum + (parseFloat(item.recoSpend) || 0), 0)

  const totalViews = daily.reduce((sum, item) => sum + item.totalViews, 0)
  const totalClicks = daily.reduce((sum, item) => sum + item.totalClicks, 0)
  const totalCartAdds = daily.reduce((sum, item) => sum + item.totalCartAdds, 0)
  const totalOrders = daily.reduce((sum, item) => sum + item.totalOrders, 0)
  const totalSpendValue = daily.reduce((sum, item) => sum + (parseFloat(item.totalSpend) || 0), 0)
  const totalBidValues = daily
    .map((item) => item.totalBid)
    .filter((value): value is string => value !== null)
    .map((value) => parseFloat(value))
    .filter((value) => Number.isFinite(value))

  const totals: AdCampaignMetrics['totals'] = {
    searchViews,
    searchClicks,
    searchCartAdds,
    searchOrders,
    searchSpend: searchSpend.toFixed(2),
    searchCtr: searchViews > 0 ? ((searchClicks / searchViews) * 100).toFixed(2) : '0.00',
    searchCpc: searchClicks > 0 ? (searchSpend / searchClicks).toFixed(2) : '0.00',
    searchCpo: searchOrders > 0 ? (searchSpend / searchOrders).toFixed(2) : '0.00',
    searchBid: null,
    recoViews,
    recoClicks,
    recoCartAdds,
    recoOrders,
    recoSpend: recoSpend.toFixed(2),
    recoCtr: recoViews > 0 ? ((recoClicks / recoViews) * 100).toFixed(2) : '0.00',
    recoCpc: recoClicks > 0 ? (recoSpend / recoClicks).toFixed(2) : '0.00',
    recoCpo: recoOrders > 0 ? (recoSpend / recoOrders).toFixed(2) : '0.00',
    recoBid: null,
    totalViews,
    totalClicks,
    totalCartAdds,
    totalOrders,
    totalSpend: totalSpendValue.toFixed(2),
    totalCtr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00',
    totalCpc: totalClicks > 0 ? (totalSpendValue / totalClicks).toFixed(2) : '0.00',
    totalCpo: totalOrders > 0 ? (totalSpendValue / totalOrders).toFixed(2) : '0.00',
    totalBid: totalBidValues.length > 0 ? average(totalBidValues).toFixed(2) : null,
  }

  return { daily, totals }
}
