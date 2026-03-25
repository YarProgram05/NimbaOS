import type { WbApiClient } from './client'

export interface SellerInfo {
  sellerName: string
  sellerId: string
  tradeMark?: string
}

interface SellerInfoResponse {
  name: string
  sid: string
  tradeMark?: string
}

/**
 * Checks connectivity for a given WB API client by hitting /ping on the common domain.
 * Throws WbApiError if unreachable or the key is invalid.
 */
export async function ping(client: WbApiClient): Promise<void> {
  await client.get<unknown>('common', '/ping')
}

/**
 * Fetches seller info (name, sid, tradeMark) using the provided client.
 */
export async function getSellerInfo(client: WbApiClient): Promise<SellerInfo> {
  const data = await client.get<SellerInfoResponse>('common', '/api/v1/seller-info')
  return {
    sellerName: data.name,
    sellerId: data.sid,
    tradeMark: data.tradeMark,
  }
}
