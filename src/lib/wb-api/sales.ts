import type { WbApiClient } from './client'
import type { WbSaleRow } from '@/types/sales-plan'

/**
 * Fetches sales from WB Statistics API.
 * GET /api/v1/supplier/sales — statistics domain (60s rate limit).
 *
 * Pagination: pass `dateFrom` as the initial flag (RFC3339), then `lastChangeDate`
 * from the last row to advance. Stop when response is `[]`.
 */
export async function fetchSalesPage(
  client: WbApiClient,
  dateFrom: string,
  lastChangeDate?: string,
): Promise<WbSaleRow[]> {
  const params: Record<string, string> = {
    dateFrom,
    flag: '0',
  }
  if (lastChangeDate) {
    params.dateFrom = lastChangeDate
    params.flag = '1'
  }

  const rows = await client.get<WbSaleRow[] | null>(
    'statistics',
    '/api/v1/supplier/sales',
    params,
  )

  return rows ?? []
}
