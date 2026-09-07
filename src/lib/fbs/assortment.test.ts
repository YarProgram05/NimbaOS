import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFbsStockUpserts, groupFbsCatalogSizes, selectFbsCatalogSize, type FbsCatalogSize } from './assortment'

const syncedAt = new Date('2026-09-07T09:00:00Z')
const size = (chrtId: number, barcode: string, nmId = 10): FbsCatalogSize => ({
  id: `size-${chrtId}-${barcode}`, productId: `product-${nmId}`, chrtId, barcode,
  product: { nmId, vendorCode: `article-${nmId}` },
})
const base = { wbAccountId: 'account', warehouseId: 'warehouse', syncedAt }

test('discovers only stocked FBS sizes and creates zero local balances', () => {
  const plan = buildFbsStockUpserts({ ...base, existing: [],
    catalog: groupFbsCatalogSizes([size(101, 'z'), size(101, 'a'), size(102, 'b'), size(103, 'c')]),
    stocks: [{ chrtId: 101, amount: 5 }, { chrtId: 102, amount: 0 }],
  })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].args.create.chrtId, 101)
  assert.equal(plan[0].args.create.barcode, 'a')
  assert.equal(plan[0].args.create.wbStock, 5)
  assert.equal(plan[0].args.create.onHand, 0)
  assert.equal(plan[0].args.create.reserved, 0)
  assert.deepEqual(plan[0].args.update, { wbStock: 5, wbStockSyncedAt: syncedAt })
})

test('repeat discovery preserves balance, disabled and marking settings and a valid barcode', () => {
  const existing = { chrtId: 101, nmId: 10, barcode: 'z', productSizeId: 'size-101-z',
    onHand: 17, reserved: 3, isEnabled: false, requiresKiz: true, markingGtin: 'gtin' }
  const input = { ...base, existing: [existing],
    catalog: groupFbsCatalogSizes([size(101, 'z'), size(101, 'a')]),
    stocks: [{ chrtId: 101, amount: 8 }],
  }
  const first = buildFbsStockUpserts(input)
  const second = buildFbsStockUpserts({ ...input, catalog: groupFbsCatalogSizes([size(101, 'a'), size(101, 'z')]) })
  assert.deepEqual(first, second)
  assert.equal(first[0].discovered, false)
  assert.equal(first[0].args.update.barcode, 'z')
  assert.deepEqual({ ...existing, ...first[0].args.update }, {
    ...existing, productId: 'product-10', productSizeId: 'size-101-z', vendorCode: 'article-10',
    wbStock: 8, wbStockSyncedAt: syncedAt,
  })
  assert.equal('onHand' in first[0].args.update, false)
  assert.equal('reserved' in first[0].args.update, false)
  assert.equal('isEnabled' in first[0].args.update, false)
})

test('keeps existing order-discovered sizes when no longer in the catalog and refreshes WB zero', () => {
  const plan = buildFbsStockUpserts({ ...base, catalog: new Map(), stocks: [],
    existing: [{ chrtId: 101, nmId: 10, barcode: 'legacy', productSizeId: null }],
  })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].args.update.wbStock, 0)
  assert.equal(plan[0].args.update.barcode, 'legacy')
  assert.equal(plan[0].args.update.nmId, undefined)
})

test('same article in different warehouses and different sizes has separate unique keys', () => {
  const input = { ...base, existing: [], catalog: groupFbsCatalogSizes([size(101, 'a'), size(102, 'b')]),
    stocks: [{ chrtId: 101, amount: 1 }, { chrtId: 102, amount: 2 }],
  }
  const first = buildFbsStockUpserts(input)
  const other = buildFbsStockUpserts({ ...input, warehouseId: 'second' })
  assert.equal(new Set([...first, ...other].map((item) => JSON.stringify(item.args.where))).size, 4)
})

test('exact nmId association rejects a barcode belonging to another product', () => {
  assert.equal(selectFbsCatalogSize([size(101, 'shared', 20)], { nmId: 10, barcode: 'shared' }), null)
  assert.throws(() => groupFbsCatalogSizes([size(101, 'a', 10), size(101, 'b', 20)]), /multiple nmIds/)
  assert.throws(() => buildFbsStockUpserts({ ...base,
    catalog: groupFbsCatalogSizes([size(101, 'a', 20)]), stocks: [{ chrtId: 101, amount: 5 }],
    existing: [{ chrtId: 101, nmId: 10, barcode: 'a', productSizeId: null }],
  }), /conflicts/)
})

test('invalid or conflicting WB stock rows fail before preparing writes', () => {
  const input = { ...base, existing: [], catalog: groupFbsCatalogSizes([size(101, 'a')]) }
  assert.throws(() => buildFbsStockUpserts({ ...input, stocks: [{ chrtId: 101, amount: -1 }] }), /invalid/)
  assert.throws(() => buildFbsStockUpserts({ ...input, stocks: [{ chrtId: 101, amount: 0.5 }] }), /invalid/)
  assert.throws(() => buildFbsStockUpserts({ ...input,
    stocks: [{ chrtId: 101, amount: 1 }, { chrtId: 101, amount: 2 }],
  }), /conflicting/)
})
