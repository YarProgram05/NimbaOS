import type { WbApiClient } from './client'
import type { WbWarehouseStockItem, WbWarehouseStocksResponse } from '@/types/stocks'

interface FetchWarehouseStocksParams {
  nmIds: number[]
  chrtIds?: number[]
  limit?: number
  offset?: number
}

export async function fetchWbWarehouseStocks(
  client: WbApiClient,
  params: FetchWarehouseStocksParams,
): Promise<WbWarehouseStockItem[]> {
  const resp = await client.post<WbWarehouseStocksResponse>(
    'analytics',
    '/api/analytics/v1/stocks-report/wb-warehouses',
    {
      nmIds: params.nmIds,
      ...(params.chrtIds?.length ? { chrtIds: params.chrtIds } : {}),
      limit: params.limit ?? 250000,
      offset: params.offset ?? 0,
    },
  )

  return resp?.data?.items ?? []
}
