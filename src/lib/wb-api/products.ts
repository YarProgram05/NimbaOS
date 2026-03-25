import type { WbApiClient } from './client'
import type {
  WbCard,
  WbCardsCursor,
  WbCardsListResponse,
  WbGoodsItem,
  WbPricesResponse,
  PriceUpdateItem,
} from '@/types/products'

export interface CardsCursor {
  updatedAt?: string
  nmID?: number
}

export interface CardsPage {
  cards: WbCard[]
  cursor: WbCardsCursor
  hasMore: boolean
}

/**
 * Fetches a single page of product cards.
 * POST /content/v2/get/cards/list — content domain (600 ms rate limit).
 * Pass cursor from the previous page for pagination.
 * hasMore=false signals the end of the catalogue.
 */
export async function fetchCardsList(
  client: WbApiClient,
  cursor?: CardsCursor,
  limit = 100,
): Promise<CardsPage> {
  const body = {
    settings: {
      cursor: {
        limit,
        ...(cursor?.updatedAt ? { updatedAt: cursor.updatedAt } : {}),
        ...(cursor?.nmID !== undefined ? { nmID: cursor.nmID } : {}),
      },
      filter: {
        withPhoto: -1,  // -1 = all cards regardless of photo status
      },
    },
  }

  const resp = await client.post<WbCardsListResponse>(
    'content',
    '/content/v2/get/cards/list',
    body,
  )

  const cards = resp?.cards ?? []

  return {
    cards,
    cursor: resp?.cursor ?? { updatedAt: '', nmID: 0, total: 0 },
    hasMore: cards.length === limit,
  }
}

/**
 * Fetches a single page of price/discount data.
 * GET /api/v2/list/goods/filter — prices domain (600 ms rate limit).
 * Returns an empty array when no more pages.
 */
export async function fetchPrices(
  client: WbApiClient,
  offset = 0,
  limit = 1000,
): Promise<WbGoodsItem[]> {
  const resp = await client.get<WbPricesResponse>(
    'prices',
    '/api/v2/list/goods/filter',
    { limit: String(limit), offset: String(offset) },
  )

  return resp?.data?.listGoods ?? []
}

/**
 * Creates a price-update task on WB.
 * POST /api/v2/upload/task — prices domain.
 * WB processes the update asynchronously; typical lag is a few seconds.
 */
export async function uploadPriceTask(
  client: WbApiClient,
  items: PriceUpdateItem[],
): Promise<void> {
  await client.post<unknown>('prices', '/api/v2/upload/task', { data: items })
}
