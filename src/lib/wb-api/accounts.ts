import { WbApiClient } from './client'
import { ping, getSellerInfo, type SellerInfo } from './common'

export type { SellerInfo }

/**
 * Validates an API key by calling ping() then fetches seller info.
 * Throws WbApiError (or WbRateLimitError) if the key is invalid.
 */
export async function validateAndFetchSellerInfo(apiKey: string): Promise<SellerInfo> {
  const client = new WbApiClient(apiKey)
  await ping(client)
  return getSellerInfo(client)
}
