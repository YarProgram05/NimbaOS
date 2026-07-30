import type {
  WbFbsOrder,
  WbFbsOrderMeta,
  WbFbsOrderStatus,
  WbFbsStock,
  WbFbsSticker,
  WbFbsSupply,
  WbFbsWarehouse,
} from '@/types/fbs'
import type { WbApiClient } from './client'

const MAX_ORDER_BATCH = 100
const MAX_STOCK_BATCH = 1_000

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function ordersFromResponse(response: unknown): WbFbsOrder[] {
  if (Array.isArray(response)) return response as WbFbsOrder[]
  if (response && typeof response === 'object') {
    const orders = (response as { orders?: unknown }).orders
    if (Array.isArray(orders)) return orders as WbFbsOrder[]
  }
  return []
}

function optionalClassifier(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : null
}

export function normalizeFbsWarehousesResponse(response: unknown): WbFbsWarehouse[] {
  if (!Array.isArray(response)) {
    throw new Error('WB API returned an invalid FBS warehouses response')
  }

  return response.map((value, index) => {
    if (!value || typeof value !== 'object') {
      throw new Error(`WB API returned an invalid FBS warehouse at index ${index}`)
    }

    const row = value as Record<string, unknown>
    const id = Number(row.id)
    const officeId = row.officeId == null ? null : Number(row.officeId)
    if (!Number.isSafeInteger(id) || id <= 0 || typeof row.name !== 'string') {
      throw new Error(`WB API returned an invalid FBS warehouse at index ${index}`)
    }
    if (officeId !== null && (!Number.isSafeInteger(officeId) || officeId <= 0)) {
      throw new Error(`WB API returned an invalid FBS warehouse officeId at index ${index}`)
    }

    return {
      id,
      name: row.name,
      officeId,
      deliveryType: optionalClassifier(row.deliveryType),
      cargoType: optionalClassifier(row.cargoType),
    }
  })
}

export async function fetchFbsWarehouses(client: WbApiClient) {
  const response = await client.get<unknown>('marketplace', '/api/v3/warehouses')
  return normalizeFbsWarehousesResponse(response)
}

export async function fetchNewFbsOrders(client: WbApiClient): Promise<WbFbsOrder[]> {
  const response = await client.get<unknown>('marketplace', '/api/v3/orders/new')
  return ordersFromResponse(response)
}

export async function fetchFbsOrdersPeriod(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
): Promise<WbFbsOrder[]> {
  const result: WbFbsOrder[] = []
  let next = 0
  const fromUnix = Math.floor(new Date(`${dateFrom}T00:00:00+03:00`).getTime() / 1_000)
  const toUnix = Math.floor(new Date(`${dateTo}T23:59:59+03:00`).getTime() / 1_000)

  if (!Number.isFinite(fromUnix) || !Number.isFinite(toUnix) || fromUnix > toUnix) {
    throw new Error(`Invalid FBS orders period: ${dateFrom} - ${dateTo}`)
  }

  for (let page = 0; page < 100; page += 1) {
    const response = await client.get<unknown>('marketplace', '/api/v3/orders', {
      limit: '1000',
      next: String(next),
      dateFrom: String(fromUnix),
      dateTo: String(toUnix),
    })
    const orders = ordersFromResponse(response)
    result.push(...orders)

    const responseNext =
      response && typeof response === 'object'
        ? Number((response as { next?: unknown }).next)
        : 0
    if (!Number.isFinite(responseNext) || responseNext <= 0 || orders.length === 0) break
    next = responseNext
  }

  return result
}

export async function fetchFbsOrderStatuses(
  client: WbApiClient,
  orderIds: number[],
): Promise<WbFbsOrderStatus[]> {
  const result: WbFbsOrderStatus[] = []
  for (const batch of chunks(orderIds, MAX_ORDER_BATCH)) {
    const response = await client.post<{ orders?: WbFbsOrderStatus[] } | WbFbsOrderStatus[]>(
      'marketplace',
      '/api/v3/orders/status',
      { orders: batch },
    )
    result.push(...(Array.isArray(response) ? response : response?.orders ?? []))
  }
  return result
}

export async function fetchFbsOrderMeta(
  client: WbApiClient,
  orderIds: number[],
): Promise<WbFbsOrderMeta[]> {
  const result: WbFbsOrderMeta[] = []
  for (const batch of chunks(orderIds, MAX_ORDER_BATCH)) {
    const response = await client.post<{ orders?: WbFbsOrderMeta[] } | WbFbsOrderMeta[]>(
      'marketplace',
      '/api/marketplace/v3/orders/meta',
      { orders: batch },
    )
    result.push(...(Array.isArray(response) ? response : response?.orders ?? []))
  }
  return result
}

export async function fetchFbsSupplies(client: WbApiClient): Promise<WbFbsSupply[]> {
  const result: WbFbsSupply[] = []
  let next = 0

  for (let page = 0; page < 100; page += 1) {
    const response = await client.get<{ supplies?: WbFbsSupply[]; next?: number }>(
      'marketplace',
      '/api/v3/supplies',
      { limit: '1000', next: String(next) },
    )
    result.push(...(response?.supplies ?? []))
    const responseNext = Number(response?.next)
    if (!Number.isFinite(responseNext) || responseNext <= 0 || !response?.supplies?.length) break
    next = responseNext
  }
  return result
}

export async function fetchFbsStocks(
  client: WbApiClient,
  warehouseExternalId: string,
  chrtIds: number[],
): Promise<WbFbsStock[]> {
  const result: WbFbsStock[] = []
  for (const batch of chunks(chrtIds, MAX_STOCK_BATCH)) {
    const response = await client.post<{ stocks?: WbFbsStock[] } | WbFbsStock[]>(
      'marketplace',
      `/api/v3/stocks/${warehouseExternalId}`,
      { chrtIds: batch },
    )
    result.push(...(Array.isArray(response) ? response : response?.stocks ?? []))
  }
  return result
}

export function fetchFbsMarkingReport(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
) {
  const query = new URLSearchParams({ dateFrom, dateTo }).toString()
  return client.post<unknown>(
    'analytics',
    `/api/v1/analytics/excise-report?${query}`,
    {},
  )
}

export function attachKizToFbsOrder(
  client: WbApiClient,
  orderExternalId: string,
  normalizedKiz: string,
) {
  return client.put<unknown>(
    'marketplace',
    `/api/v3/orders/${orderExternalId}/meta/sgtin`,
    { sgtins: [normalizedKiz] },
  )
}

export function setFbsOrderSupplierStatus(
  client: WbApiClient,
  orderExternalId: string,
  status: 'confirm' | 'complete' | 'cancel',
) {
  return client.patch<unknown>(
    'marketplace',
    `/api/v3/orders/${orderExternalId}/${status}`,
    {},
  )
}

export function moveFbsOrderToSupply(
  client: WbApiClient,
  supplyExternalId: string,
  orderExternalId: string,
) {
  return client.patch<unknown>(
    'marketplace',
    `/api/v3/supplies/${encodeURIComponent(supplyExternalId)}/orders/${orderExternalId}`,
    {},
  )
}

export function closeFbsSupply(client: WbApiClient, supplyExternalId: string) {
  return client.patch<unknown>(
    'marketplace',
    `/api/v3/supplies/${encodeURIComponent(supplyExternalId)}/deliver`,
    {},
  )
}

export function publishFbsStocks(
  client: WbApiClient,
  warehouseExternalId: string,
  stocks: WbFbsStock[],
) {
  return client.put<unknown>(
    'marketplace',
    `/api/v3/stocks/${warehouseExternalId}`,
    { stocks },
  )
}

export async function fetchFbsOrderStickers(
  client: WbApiClient,
  orderIds: number[],
  type: 'png' | 'svg' | 'zplv' | 'zplh' = 'png',
) {
  const response = await client.post<{ stickers?: WbFbsSticker[] } | WbFbsSticker[]>(
    'marketplace',
    `/api/v3/orders/stickers?type=${type}&width=58&height=40`,
    { orders: orderIds },
  )
  return Array.isArray(response) ? response : response?.stickers ?? []
}
