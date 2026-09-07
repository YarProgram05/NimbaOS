import assert from 'node:assert/strict'
import test from 'node:test'
import { FbsNomenclatureMappingError, planFbsNomenclature, type FbsNomenclatureCandidate } from './fbs-nomenclature'
import {
  FbsProductNameMissingError,
  buildFbsDesiredEvents,
  buildFbsWbStockSnapshots,
  planFbsSheetUpsert,
  planFbsWbStockUpsert,
  resolveFbsProductName,
  type FbsSheetExistingRow,
} from './fbs-sheet'
import { FBS_CONFIRMED_PRODUCT_ALIASES, FBS_CONFIRMED_PRODUCT_GROUPS } from './fbs-product-aliases'
import { planFbsReferenceExpansion } from './fbs-reference'

function candidate(overrides: Partial<FbsNomenclatureCandidate> = {}): FbsNomenclatureCandidate {
  return { accountKey: 'nimba', nmId: 100, chrtId: 200, vendorCode: 'название WB', ...overrides }
}

test('all nine unknown FBS tuples are reported together without creating names or quantities', () => {
  const candidates = Array.from({ length: 9 }, (_, index) => candidate({ chrtId: 200 + index }))
  const productNames = new Map<string, string>()
  const allowedProductNames = ['название WB']
  assert.throws(() => planFbsNomenclature({ candidates, productNames, allowedProductNames }), (error) => {
    assert.ok(error instanceof FbsNomenclatureMappingError)
    assert.equal(error.products.length, 9)
    assert.deepEqual(error.products.map((product) => product.chrtId), candidates.map((item) => item.chrtId))
    assert.match(error.message, /Нужно подтвердить складское название/)
    return true
  })
  assert.equal(productNames.size, 0)
  assert.deepEqual(allowedProductNames, ['название WB'])
})

test('only explicit aliases can introduce new reference names', () => {
  const plan = planFbsNomenclature({
    candidates: [candidate()],
    productNames: new Map(),
    productAliases: new Map([['nimba:100:200', 'согласованный складской товар']]),
    allowedProductNames: [],
  })
  assert.deepEqual(plan.newReferenceNames, ['согласованный складской товар'])
  assert.deepEqual(Object.keys(plan), ['productNames', 'newReferenceNames'])
  assert.equal(plan.productNames.get('nimba:100:200'), 'согласованный складской товар')
})

test('tuple identity deduplicates barcodes while unapproved sizes and cabinets remain unresolved', () => {
  assert.throws(() => planFbsNomenclature({
    candidates: [
      candidate({ barcode: '00001' }),
      candidate({ accountKey: ' NIMBA ', barcode: '00002' }),
      candidate({ chrtId: 201, barcode: '00003' }),
      candidate({ accountKey: 'galioni', barcode: '00001' }),
    ],
    productNames: new Map(),
    productAliases: new Map([['nimba:100:200', 'согласованный товар']]),
    allowedProductNames: [],
  }), (error) => {
    assert.ok(error instanceof FbsNomenclatureMappingError)
    assert.deepEqual(error.products.map((product) => `${product.accountKey}:${product.nmId}:${product.chrtId}`), [
      'galioni:100:200', 'nimba:100:201',
    ])
    return true
  })
})

test('multiple explicitly approved tuples can share a single canonical product', () => {
  const plan = planFbsNomenclature({
    candidates: [candidate(), candidate({ chrtId: 201 }), candidate({ barcode: 'other' })],
    productNames: new Map(),
    productAliases: new Map([['nimba:100:200', 'один физический товар'], ['nimba:100:201', 'один физический товар']]),
    allowedProductNames: [],
  })
  assert.equal(plan.productNames.size, 2)
  assert.deepEqual(plan.newReferenceNames, ['один физический товар'])
})

test('the nine owner-confirmed production listings register exactly five physical products', () => {
  const candidates = FBS_CONFIRMED_PRODUCT_GROUPS.flatMap((group) => [...group.listings])
  const productAliases = new Map(Object.entries(FBS_CONFIRMED_PRODUCT_ALIASES))
  assert.equal(candidates.length, 9)
  const first = planFbsNomenclature({ candidates, productNames: new Map(), productAliases, allowedProductNames: [] })
  assert.equal(first.productNames.size, 9)
  assert.equal(first.newReferenceNames.length, 5)
  assert.deepEqual(new Set(first.newReferenceNames), new Set(FBS_CONFIRMED_PRODUCT_GROUPS.map((group) => group.name)))
  for (const group of FBS_CONFIRMED_PRODUCT_GROUPS) {
    for (const listing of group.listings) {
      assert.equal(first.productNames.get(`${listing.accountKey}:${listing.nmId}:${listing.chrtId}`), group.name)
    }
  }
  const retry = planFbsNomenclature({ candidates, productNames: first.productNames, productAliases, allowedProductNames: first.newReferenceNames })
  assert.deepEqual(retry.newReferenceNames, [])
})

test('retry after main writes but before control creates no duplicate reference, stock, or synthetic order rows', () => {
  const candidates = FBS_CONFIRMED_PRODUCT_GROUPS.flatMap((group) => [...group.listings])
  const productAliases = new Map(Object.entries(FBS_CONFIRMED_PRODUCT_ALIASES))
  const summaryValues = [
    ['Товар'],
    ...Array.from({ length: 150 }, (_, index) => [
      `=IF('Справочники'!A${index + 4}="";"";'Справочники'!A${index + 4})`,
      ...Array.from({ length: 19 }, () => '=SUMIFS(Операции!D:D;Операции!B:B;A8)'),
    ]),
  ]
  const existingManualRows: FbsSheetExistingRow[] = [{
    rowNumber: 6, values: [46270, 'существующий товар', 'Приход', 17, 'ручной приход'],
  }]
  const originalManualRows = structuredClone(existingManualRows)
  const stockSyncedAt = new Date('2026-09-07T09:00:00Z')
  const activeAccountKeys = ['nimba', 'galioni']
  const prepare = (referenceValues: unknown[][], existingStockRows: FbsSheetExistingRow[], loadedAt: Date) => {
    const allowedProductNames = referenceValues.map((row) => String(row[0] ?? '')).filter(Boolean)
    const nomenclature = planFbsNomenclature({ candidates, productNames: new Map(), productAliases, allowedProductNames })
    const accounts = activeAccountKeys.map((accountKey) => ({
      wbAccountId: accountKey, accountName: accountKey, technicalKey: accountKey, cabinetLabel: accountKey,
    }))
    const desiredEvents = accounts.flatMap((account) => buildFbsDesiredEvents({
      account, productNames: nomenclature.productNames, productAliases, allowedProductNames,
      orders: [], acceptedReturns: [],
    }))
    const desiredSnapshots = accounts.flatMap((account) => buildFbsWbStockSnapshots({
      account, productNames: nomenclature.productNames, productAliases, allowedProductNames,
      stocks: candidates.filter((item) => item.accountKey === account.technicalKey).map((item) => ({
        ...item, barcode: `000${item.chrtId}`, wbStock: 2, wbStockSyncedAt: stockSyncedAt,
      })),
    }))
    return {
      desiredEvents,
      desiredSnapshots,
      reference: planFbsReferenceExpansion({
        referenceValues, summaryValues, desiredNames: desiredSnapshots.map((snapshot) => snapshot.productName),
        referenceSheetId: 42, referenceSheetName: 'Справочники',
      }),
      operations: planFbsSheetUpsert({ existingRows: existingManualRows, desiredEvents, loadedAt }),
      stocks: planFbsWbStockUpsert({ existingRows: existingStockRows, desiredSnapshots, activeAccountKeys }),
    }
  }

  const referenceValues: unknown[][] = [['существующий товар']]
  const first = prepare(referenceValues, [], new Date('2026-09-07T09:01:00Z'))
  assert.equal(first.reference.requests.length, 5)
  assert.equal(first.stocks.inserted, 9)
  assert.equal(new Set(first.desiredSnapshots.map((snapshot) => snapshot.key)).size, 9)
  assert.equal(new Set(first.desiredSnapshots.map((snapshot) => snapshot.productName)).size, 5)
  assert.deepEqual(first.desiredEvents, [])
  assert.deepEqual(first.operations.writes, [])

  // These are the persisted main writes when the process stops before writing control rows.
  const persistedReference = structuredClone(referenceValues)
  for (const request of first.reference.requests) {
    const rowIndex = request.updateCells?.start?.rowIndex
    const name = request.updateCells?.rows?.[0].values?.[0].userEnteredValue?.stringValue
    assert.equal(typeof rowIndex, 'number')
    assert.equal(typeof name, 'string')
    persistedReference[(rowIndex as number) - 3] = [name]
  }
  const persistedStocks = Array.from(first.stocks.resultingRowsByKey.values())
  const retry = prepare(persistedReference, persistedStocks, new Date('2026-09-07T09:10:00Z'))
  assert.deepEqual(retry.reference.requests, [])
  assert.deepEqual(retry.reference.addedNames, [])
  assert.deepEqual(retry.stocks.writes, [])
  assert.equal(retry.stocks.unchanged, 9)
  assert.deepEqual(retry.operations.writes, [])
  assert.deepEqual(retry.desiredEvents, [])
  assert.deepEqual(existingManualRows, originalManualRows)
})

test('retry after the reference write is idempotent and survives vendor or barcode changes', () => {
  const productAliases = new Map([['nimba:100:200', 'согласованный товар']])
  const first = planFbsNomenclature({ candidates: [candidate()], productNames: new Map(), productAliases, allowedProductNames: [] })
  const retry = planFbsNomenclature({
    candidates: [candidate({ vendorCode: 'новое название WB', barcode: 'changed' })],
    productNames: new Map(),
    productAliases,
    allowedProductNames: first.newReferenceNames,
  })
  assert.deepEqual(retry.newReferenceNames, [])
  assert.deepEqual(retry.productNames, first.productNames)
})

test('explicit aliases override prior tuples, which remain stable against conflicting vendor labels', () => {
  const productNames = new Map([
    ['nimba:100:200', 'старое сопоставление'],
    ['nimba:100:201', 'подтвержденный товар'],
  ])
  const productAliases = new Map([['nimba:100:200', 'канонический товар']])
  const plan = planFbsNomenclature({
    candidates: [candidate(), candidate({ chrtId: 201 })],
    productNames,
    productAliases,
    allowedProductNames: ['название WB', 'канонический товар', 'подтвержденный товар'],
  })
  assert.equal(plan.productNames.get('nimba:100:200'), 'канонический товар')
  assert.equal(plan.productNames.get('nimba:100:201'), 'подтвержденный товар')
  assert.deepEqual(plan.newReferenceNames, [])
  assert.equal(productNames.get('nimba:100:200'), 'старое сопоставление')
  assert.equal(resolveFbsProductName({ ...candidate(), productNames, allowedProductNames: ['название WB'] }), 'старое сопоставление')
})

test('WB vendor names never infer an exact or ambiguous physical product in the nomenclature planner', () => {
  for (const allowedProductNames of [['парео желтый'], ['парео желтый шиф', 'парео желтый хлопок']]) {
    assert.throws(() => planFbsNomenclature({
      candidates: [candidate({ vendorCode: 'парео желтый' })], productNames: new Map(), allowedProductNames,
    }), FbsNomenclatureMappingError)
  }
})

test('a prior tuple whose reference name was removed requires an explicit alias before registering again', () => {
  assert.throws(() => planFbsNomenclature({
    candidates: [candidate()], productNames: new Map([['nimba:100:200', 'удалённый товар']]), allowedProductNames: [],
  }), (error) => {
    assert.ok(error instanceof FbsNomenclatureMappingError)
    assert.equal(error.products[0].reason, 'missing-reference')
    return true
  })
})

test('planning is deterministic and does not mutate source mappings or aliases', () => {
  const candidates = [candidate({ vendorCode: '' }), candidate({ chrtId: 201 }), candidate({ vendorCode: 'A' })]
  const productNames = new Map<string, string>()
  const productAliases = new Map([['nimba:100:200', 'товар 1'], ['nimba:100:201', 'товар 2']])
  const allowedProductNames: string[] = []
  const plan = planFbsNomenclature({ candidates, productNames, productAliases, allowedProductNames })
  assert.deepEqual(plan, planFbsNomenclature({ candidates: [...candidates].reverse(), productNames, productAliases, allowedProductNames }))
  assert.deepEqual(plan.newReferenceNames, ['товар 1', 'товар 2'])
  assert.equal(productNames.size, 0)
  assert.equal(productAliases.size, 2)
  assert.deepEqual(allowedProductNames, [])
})

test('invalid product identities fail rather than creating an untraceable reference', () => {
  for (const item of [candidate({ nmId: 0 }), candidate({ chrtId: -1 }), candidate({ chrtId: 1.5 }), candidate({ accountKey: '' })]) {
    assert.throws(() => planFbsNomenclature({ candidates: [item], productNames: new Map(), allowedProductNames: [] }))
  }
})

test('missing resolution is distinguishable from a business mapping conflict', () => {
  assert.throws(() => resolveFbsProductName({
    productNames: new Map(), accountKey: 'nimba', nmId: 100, chrtId: 200,
  }), FbsProductNameMissingError)
})
