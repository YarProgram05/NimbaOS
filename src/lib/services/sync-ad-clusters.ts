import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import {
  fetchAdvertInfoByIds,
  fetchClusterStats,
} from '@/lib/wb-api/advertising'
import type { AdClusterSyncResult } from '@/types/advertising'

interface ClusterAccumulator {
  views: number
  clicks: number
  cartAdds: number
  orders: number
  weightedCtr: number
  weightedPosition: number
  weightedCpm: number
  weight: number
}

function toNumber(value: number | undefined | null): number {
  return Number(value ?? 0)
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

/**
 * Syncs aggregated search cluster stats for a campaign and period.
 * WB returns clusters per product card, so we aggregate them at the campaign level.
 */
export async function syncAdClusters(
  wbAccountId: string,
  campaignId: string,
  advertId: number,
  dateFrom: string,
  dateTo: string,
): Promise<AdClusterSyncResult> {
  const startMs = Date.now()
  const result: AdClusterSyncResult = {
    totalRows: 0,
    created: 0,
    deleted: 0,
    errors: 0,
    durationMs: 0,
  }

  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))

  let campaignInfo
  try {
    campaignInfo = await fetchAdvertInfoByIds(client, [advertId])
  } catch (error) {
    result.errors++
    result.durationMs = Date.now() - startMs
    throw error
  }

  const nmIds = Array.from(
    new Set((campaignInfo[0]?.nm_settings ?? []).map((item) => item.nm_id)),
  )

  if (nmIds.length === 0) {
    result.durationMs = Date.now() - startMs
    return result
  }

  let statsGroups
  try {
    statsGroups = await fetchClusterStats(client, advertId, nmIds, dateFrom, dateTo)
  } catch (error) {
    result.errors++
    result.durationMs = Date.now() - startMs
    throw error
  }

  const aggregated = new Map<string, ClusterAccumulator>()

  for (const group of statsGroups) {
    for (const stat of group.stats ?? []) {
      const cluster = stat.norm_query?.trim()
      if (!cluster) continue

      const views = toNumber(stat.views)
      const clicks = toNumber(stat.clicks)
      const cartAdds = toNumber(stat.atbs)
      const orders = toNumber(stat.orders)
      const weight = Math.max(views, 1)

      const entry = aggregated.get(cluster) ?? {
        views: 0,
        clicks: 0,
        cartAdds: 0,
        orders: 0,
        weightedCtr: 0,
        weightedPosition: 0,
        weightedCpm: 0,
        weight: 0,
      }

      entry.views += views
      entry.clicks += clicks
      entry.cartAdds += cartAdds
      entry.orders += orders
      entry.weightedCtr += toNumber(stat.ctr) * weight
      entry.weightedPosition += toNumber(stat.avg_pos) * weight
      entry.weightedCpm += toNumber(stat.cpm) * weight
      entry.weight += weight

      aggregated.set(cluster, entry)
    }
  }

  result.totalRows = aggregated.size

  try {
    const deleteResult = await prisma.adCampaignCluster.deleteMany({
      where: {
        campaignId,
        dateFrom: parseDate(dateFrom),
        dateTo: parseDate(dateTo),
      },
    })
    result.deleted = deleteResult.count

    if (aggregated.size > 0) {
      const createResult = await prisma.adCampaignCluster.createMany({
        data: Array.from(aggregated.entries()).map(([cluster, value]) => ({
          campaignId,
          cluster,
          ctr: value.weight > 0 ? value.weightedCtr / value.weight : 0,
          position: value.weight > 0 ? value.weightedPosition / value.weight : 0,
          views: value.views,
          clicks: value.clicks,
          cartAdds: value.cartAdds,
          orders: value.orders,
          cpm: value.weight > 0 ? value.weightedCpm / value.weight : 0,
          dateFrom: parseDate(dateFrom),
          dateTo: parseDate(dateTo),
        })),
      })
      result.created = createResult.count
    }
  } catch (error) {
    result.errors++
    result.durationMs = Date.now() - startMs
    throw error
  }

  result.durationMs = Date.now() - startMs
  return result
}
