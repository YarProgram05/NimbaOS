import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { syncProductCatalog } from '@/lib/services/sync-products'
import type { WbApiClient } from '@/lib/wb-api/client'
import type { WbCard } from '@/types/products'

const card = {
  nmID: 10, vendorCode: 'new-article', updatedAt: '2026-09-07T09:00:00Z', characteristics: [],
  sizes: [{ chrtID: 101, techSize: 'M', wbSize: 'M', skus: ['b', 'a', 'a'], price: 0 }],
} as unknown as WbCard

test('cards-only refresh retains referenced size IDs, deduplicates barcodes, and does not request prices', async (t) => {
  type Size = { id: string; productId: string; chrtId: number; barcode: string; techSize: string; wbSize: string;
    price: string | null; discount: number | null; spp: string | null }
  let sizes: Size[] = [{ id: 'stable-a', productId: 'product', chrtId: 101, barcode: 'a',
    techSize: 'M', wbSize: 'M', price: '250', discount: 10, spp: '225' }]
  let creations = 0
  const tx = {
    product: { findUnique: async () => ({ id: 'product' }), update: async () => ({ id: 'product' }) },
    productSize: {
      findMany: async () => sizes.map((size) => ({ ...size })),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Size> }) => {
        sizes = sizes.map((size) => size.id === where.id ? { ...size, ...data } : size)
        return { id: where.id }
      },
      create: async ({ data }: { data: Omit<Size, 'id'> }) => {
        const created = { ...data, id: `created-${++creations}` }
        sizes.push(created)
        return { id: created.id }
      },
      deleteMany: async ({ where }: { where: { id: { notIn: string[] } } }) => {
        sizes = sizes.filter((size) => where.id.notIn.includes(size.id))
      },
    },
    productMaterial: { deleteMany: async () => assert.fail('FBS catalog refresh must preserve local material translations') },
  }
  const originalTransaction = prisma.$transaction
  prisma.$transaction = (async (work: unknown) =>
    (work as (client: Prisma.TransactionClient) => Promise<unknown>)(tx as unknown as Prisma.TransactionClient)
  ) as typeof prisma.$transaction
  t.after(() => { prisma.$transaction = originalTransaction })
  const client = { post: async (domain: string, path: string) => {
    assert.equal(domain, 'content')
    assert.equal(path, '/content/v2/get/cards/list')
    return { cards: [{ ...card, sizes: card.sizes.map((size) => ({ ...size, price: 99_900 })) }] }
  } } as unknown as WbApiClient

  const first = await syncProductCatalog('account', client)
  const second = await syncProductCatalog('account', client)
  assert.equal(first.errors + second.errors, 0)
  assert.equal(first.priceRows + second.priceRows, 0)
  assert.equal(sizes.length, 2)
  assert.equal(creations, 1)
  assert.equal(sizes.find((size) => size.barcode === 'a')?.id, 'stable-a')
  assert.equal(sizes.find((size) => size.barcode === 'a')?.price, '250', 'stale nonzero Content price must not overwrite the saved Prices API value')
})

test('cards-only refresh propagates API and per-card persistence failures to block FBS freshness', async (t) => {
  const originalTransaction = prisma.$transaction
  prisma.$transaction = (async () => { throw new Error('card persistence failed') }) as typeof prisma.$transaction
  t.after(() => { prisma.$transaction = originalTransaction })
  const goodResponse = { post: async () => ({ cards: [card] }) } as unknown as WbApiClient
  await assert.rejects(() => syncProductCatalog('account', goodResponse), /card persistence failed/)
  const apiFailure = { post: async () => { throw new Error('catalog unavailable') } } as unknown as WbApiClient
  await assert.rejects(() => syncProductCatalog('account', apiFailure), /catalog unavailable/)
})
