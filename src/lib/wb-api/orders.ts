import type { WbApiClient } from './client'
import type { WbOrderRow } from '@/types/sales-plan'

/**
 * Fetches orders from WB Statistics API.
 * GET /api/v1/supplier/orders — statistics domain (60s rate limit).
 *
 * Pagination: pass `dateFrom` as the initial flag (RFC3339), then `lastChangeDate`
 * from the last row to advance. Stop when response is `[]`.
 */
export async function fetchOrdersPage(
  client: WbApiClient,
  dateFrom: string,
  lastChangeDate?: string,
): Promise<WbOrderRow[]> {
  const params: Record<string, string> = {
    dateFrom,
    flag: '0',
  }
  if (lastChangeDate) {
    params.dateFrom = lastChangeDate
    params.flag = '1' // flag=1 means use dateFrom as lastChangeDate cursor
  }

  const rows = await client.get<WbOrderRow[] | null>(
    'statistics',
    '/api/v1/supplier/orders',
    params,
  )

  return rows ?? []
}
