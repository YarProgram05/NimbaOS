import assert from 'node:assert/strict'
import test from 'node:test'
import type { WbApiClient } from '@/lib/wb-api/client'
import {
  fetchFbsMarkingReport,
  fetchFbsOrdersPeriod,
  fetchFbsStocks,
  fetchFbsWarehouses,
} from '@/lib/wb-api/fbs'
import { fetchCardsList } from '@/lib/wb-api/products'

test('does not treat malformed cards or stock responses as a fresh empty catalog or zero stock', async () => {
  const client = { post: async () => ({}) } as unknown as WbApiClient
  await assert.rejects(() => fetchCardsList(client), /invalid product cards response/)
  await assert.rejects(() => fetchFbsStocks(client, 'warehouse', [101]), /invalid FBS stocks response/)
})

test('accepts a valid empty stock response and batches stock reads by size ID', async () => {
  const calls: number[][] = []
  const client = { post: async (_domain: string, _path: string, body: { chrtIds: number[] }) => {
    calls.push(body.chrtIds)
    return { stocks: [] }
  } } as unknown as WbApiClient
  assert.deepEqual(await fetchFbsStocks(client, 'warehouse', Array.from({ length: 1001 }, (_, index) => index + 1)), [])
  assert.equal(calls[0].length, 1000)
  assert.deepEqual(calls[1], [1001])
})

test('normalizes numeric WB warehouse classifiers before Prisma persistence', async () => {
  const client = {
    get: async () => [{
      id: 1787556,
      name: 'Мой склад',
      officeId: 3052800,
      deliveryType: 1,
      cargoType: 1,
    }],
  } as unknown as WbApiClient

  assert.deepEqual(await fetchFbsWarehouses(client), [{
    id: 1787556,
    name: 'Мой склад',
    officeId: 3052800,
    deliveryType: '1',
    cargoType: '1',
  }])
})

test('requests the mandatory-labeling report with POST and date query parameters', async () => {
  const calls: Array<{ domain: string; path: string; body: unknown }> = []
  const client = {
    post: async (domain: string, path: string, body: unknown) => {
      calls.push({ domain, path, body })
      return { details: [] }
    },
  } as unknown as WbApiClient

  await fetchFbsMarkingReport(client, '2026-07-29', '2026-07-30')

  assert.deepEqual(calls, [{
    domain: 'analytics',
    path: '/api/v1/analytics/excise-report?dateFrom=2026-07-29&dateTo=2026-07-30',
    body: {},
  }])
})

test('converts an FBS order period to Moscow Unix timestamps', async () => {
  const calls: Array<Record<string, string> | undefined> = []
  const client = {
    get: async (_domain: string, _path: string, params?: Record<string, string>) => {
      calls.push(params)
      return { orders: [], next: 0 }
    },
  } as unknown as WbApiClient

  await fetchFbsOrdersPeriod(client, '2026-07-29', '2026-07-30')

  assert.equal(calls[0]?.dateFrom, String(Date.parse('2026-07-29T00:00:00+03:00') / 1_000))
  assert.equal(calls[0]?.dateTo, String(Date.parse('2026-07-30T23:59:59+03:00') / 1_000))
})
