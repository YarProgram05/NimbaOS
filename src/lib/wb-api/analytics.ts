import type { WbApiClient } from './client'
import type {
  WbFunnelHistoryRequest,
  WbFunnelHistoryResponse,
  WbFunnelHistoryCard,
} from '@/types/sales-plan'

/**
 * Max nmIDs per single request to the funnel API.
 * WB docs don't specify a hard limit; 20 is safe and keeps payloads small.
 */
const BATCH_SIZE = 20

/**
 * Fetches sales-funnel history from WB Analytics API.
 * POST /api/analytics/v3/sales-funnel/products/history — analytics domain (3 req/min).
 *
 * If `nmIds` exceeds BATCH_SIZE, splits into batches automatically.
 * Returns merged per-nmId per-day analytics.
 */
export async function fetchFunnelHistory(
  client: WbApiClient,
  nmIds: number[],
  dateFrom: string,
  dateTo: string,
): Promise<WbFunnelHistoryCard[]> {
  if (nmIds.length === 0) return []

  const allCards: WbFunnelHistoryCard[] = []

  // Split nmIds into batches
  for (let i = 0; i < nmIds.length; i += BATCH_SIZE) {
    const batch = nmIds.slice(i, i + BATCH_SIZE)

    const body: WbFunnelHistoryRequest = {
      nmIds: batch,
      selectedPeriod: {
        start: dateFrom,
        end: dateTo,
      },
      timezone: 'Europe/Moscow',
      aggregationLevel: 'day',
    }

    const response = await client.post<WbFunnelHistoryResponse>(
      'analytics',
      '/api/analytics/v3/sales-funnel/products/history',
      body,
    )

    if (response.error) {
      throw new Error(`WB Funnel API error: ${response.errorText}`)
    }

    if (response.data) {
      allCards.push(...response.data)
    }
  }

  return allCards
}
