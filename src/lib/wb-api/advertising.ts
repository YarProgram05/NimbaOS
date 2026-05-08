import type { WbApiClient } from './client'
import type {
  AdStatus,
  WbAdvertInfoItem,
  WbAdvertInfoResponse,
  WbBidPlacement,
  WbCampaignBudgetDepositRequest,
  WbCampaignBudgetResponse,
  WbClusterStatsResponse,
  WbFullStatsResponse,
  WbPaymentType,
  WbUpdHistoryItem,
} from '@/types/advertising'

const ALL_AD_STATUSES: AdStatus[] = [-1, 4, 7, 8, 9, 11]
const MAX_CAMPAIGN_IDS = 50
const MAX_CLUSTER_ITEMS = 100

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

/**
 * Fetches campaign details for a status filter.
 * Uses the current WB endpoint /api/advert/v2/adverts, not the older list-only shortcut.
 */
export async function fetchAdvertList(
  client: WbApiClient,
  status?: AdStatus | AdStatus[],
): Promise<WbAdvertInfoItem[]> {
  const statuses = Array.isArray(status)
    ? status
    : status !== undefined
      ? [status]
      : ALL_AD_STATUSES

  const response = await client.get<WbAdvertInfoResponse>(
    'advert',
    '/api/advert/v2/adverts',
    { statuses: statuses.join(',') },
  )

  return response.adverts ?? []
}

/**
 * Fetches campaign details by explicit campaign IDs.
 * WB limits the ids query parameter to 50 campaign IDs per request.
 */
export async function fetchAdvertInfoByIds(
  client: WbApiClient,
  advertIds: number[],
): Promise<WbAdvertInfoItem[]> {
  if (advertIds.length === 0) return []

  const result: WbAdvertInfoItem[] = []

  for (const idsChunk of chunk(advertIds, MAX_CAMPAIGN_IDS)) {
    const response = await client.get<WbAdvertInfoResponse>(
      'advert',
      '/api/advert/v2/adverts',
      { ids: idsChunk.join(',') },
    )

    result.push(...(response.adverts ?? []))
  }

  return result
}

/**
 * Fetches campaign budget.
 */
export async function fetchCampaignBudget(
  client: WbApiClient,
  advertId: number,
): Promise<WbCampaignBudgetResponse> {
  return client.get<WbCampaignBudgetResponse>(
    'advert',
    '/adv/v1/budget',
    { id: String(advertId) },
  )
}

/**
 * Fetches campaign full stats for a date range.
 * Current WB docs use GET /adv/v3/fullstats with ids/beginDate/endDate query params.
 */
export async function fetchFullStats(
  client: WbApiClient,
  advertId: number | number[],
  dateFrom: string,
  dateTo: string,
): Promise<WbFullStatsResponse> {
  const ids = Array.isArray(advertId) ? advertId.join(',') : String(advertId)

  return client.get<WbFullStatsResponse>(
    'advert',
    '/adv/v3/fullstats',
    {
      ids,
      beginDate: dateFrom,
      endDate: dateTo,
    },
  )
}

/**
 * Fetches search cluster stats for the campaign's product cards.
 * The current endpoint requires advert_id + nm_id pairs, up to 100 items per request.
 */
export async function fetchClusterStats(
  client: WbApiClient,
  advertId: number,
  nmIds: number[],
  dateFrom: string,
  dateTo: string,
): Promise<WbClusterStatsResponse['stats']> {
  if (nmIds.length === 0) return []

  const allStats: WbClusterStatsResponse['stats'] = []

  for (const nmIdsChunk of chunk(nmIds, MAX_CLUSTER_ITEMS)) {
    const response = await client.post<WbClusterStatsResponse>(
      'advert',
      '/adv/v0/normquery/stats',
      {
        from: dateFrom,
        to: dateTo,
        items: nmIdsChunk.map((nmId) => ({
          advert_id: advertId,
          nm_id: nmId,
        })),
      },
    )

    allStats.push(...(response.stats ?? []))
  }

  return allStats
}

/**
 * Fetches WB spending/update history for a campaign.
 */
export async function fetchUpdHistory(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
): Promise<WbUpdHistoryItem[]> {
  const response = await client.get<WbUpdHistoryItem[] | null>(
    'advert',
    '/adv/v1/upd',
    { from: dateFrom, to: dateTo },
  )

  return response ?? []
}

/**
 * Sets the same bid for one or more WB articles inside the campaign.
 * WB expects bid values in kopecks and requires placement per nm_id row.
 */
export async function setBid(
  client: WbApiClient,
  advertId: number,
  nmIds: number[],
  bidKopecks: number,
  placement: WbBidPlacement,
): Promise<void> {
  if (nmIds.length === 0) return

  await client.request(
    'advert',
    '/api/advert/v1/bids',
    {
      method: 'PATCH',
      body: JSON.stringify({
        bids: [
          {
            advert_id: advertId,
            nm_bids: nmIds.map((nmId) => ({
              nm_id: nmId,
              bid_kopecks: bidKopecks,
              placement,
            })),
          },
        ],
      }),
    },
  )
}

/**
 * Tops up the campaign budget.
 * The campaign ID is passed as a query parameter; the source type is defined by WB docs.
 */
export async function depositBudget(
  client: WbApiClient,
  advertId: number,
  body: WbCampaignBudgetDepositRequest,
): Promise<WbCampaignBudgetResponse | null> {
  return client.request<WbCampaignBudgetResponse | null>(
    'advert',
    `/adv/v1/budget/deposit?id=${advertId}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

export async function startCampaign(
  client: WbApiClient,
  advertId: number,
): Promise<void> {
  await client.get<null>('advert', '/adv/v0/start', { id: String(advertId) })
}

export async function pauseCampaign(
  client: WbApiClient,
  advertId: number,
): Promise<void> {
  await client.get<null>('advert', '/adv/v0/pause', { id: String(advertId) })
}

export async function stopCampaign(
  client: WbApiClient,
  advertId: number,
): Promise<void> {
  await client.get<null>('advert', '/adv/v0/stop', { id: String(advertId) })
}

export function getBidPlacement(
  bidType: string | null | undefined,
  paymentType: WbPaymentType | null | undefined,
  placementSearch: boolean,
  placementReco: boolean,
): WbBidPlacement {
  if (paymentType === 'cpc') {
    return 'combined'
  }

  if (bidType === 'unified' || (placementSearch && placementReco)) {
    return 'combined'
  }

  if (placementReco && !placementSearch) {
    return 'recommendations'
  }

  return 'search'
}
