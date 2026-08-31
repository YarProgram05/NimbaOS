import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFbsDesiredEvents,
  buildFbsProductNameMap,
  buildFbsWbStockSnapshots,
  fbsProductTupleKey,
  isCanceledBeforeFbsHandoff,
  planFbsSheetUpsert,
  planFbsWbStockUpsert,
  reconcileFbsDay,
  sheetSerialDate,
  sheetSerialDateTime,
  type FbsSheetExistingRow,
} from './fbs-sheet'

const account = {
  wbAccountId: 'account-1',
  accountName: 'WB Nimba',
  technicalKey: 'nimba',
  cabinetLabel: 'Гребнев / WB Nimba',
}

const mappingRow: FbsSheetExistingRow = {
  rowNumber: 6,
  values: [46231, 'парео синий', 'Заказ ФБС — Гребнев', 1, '', account.cabinetLabel, '1', 100, 200, 'NimbaOS', 'fbs-order:nimba:1', 'complete / sold', 46240],
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-2',
    externalOrderId: '2',
    nmId: 100,
    chrtId: 200,
    vendorCode: 'vendor',
    createdAtWb: new Date('2026-08-10T04:00:00Z'),
    supplierStatus: 'complete',
    wbStatus: 'sold',
    shipmentApplied: true,
    ...overrides,
  }
}

test('post-handoff status does not create a cancellation offset', () => {
  assert.equal(isCanceledBeforeFbsHandoff(order({ wbStatus: 'canceled_by_client' })), false)
  assert.equal(isCanceledBeforeFbsHandoff(order({ wbStatus: 'defect' })), false)
})

test('pre-handoff decline creates order and cancellation events', () => {
  const productNames = buildFbsProductNameMap([mappingRow])
  const events = buildFbsDesiredEvents({
    account,
    productNames,
    orders: [order({ supplierStatus: 'new', wbStatus: 'declined_by_client', shipmentApplied: false })],
    acceptedReturns: [],
  })
  assert.deepEqual(events.map((event) => event.key), ['fbs-order:nimba:2', 'fbs-cancel:nimba:2'])
})

test('accepted return is created only from an explicit movement', () => {
  const productNames = buildFbsProductNameMap([mappingRow])
  const withoutMovement = buildFbsDesiredEvents({
    account,
    productNames,
    orders: [order({ wbStatus: 'defect' })],
    acceptedReturns: [],
  })
  assert.deepEqual(withoutMovement.map((event) => event.kind), ['order'])

  const withMovement = buildFbsDesiredEvents({
    account,
    productNames,
    orders: [order({ wbStatus: 'defect' })],
    acceptedReturns: [{
      id: 'movement-1', externalOrderId: '2', nmId: 100, chrtId: 200,
      occurredAt: new Date('2026-08-12T09:00:00Z'), supplierStatus: 'complete', wbStatus: 'defect',
    }],
  })
  assert.deepEqual(withMovement.map((event) => event.kind), ['order', 'accepted-return'])
  assert.equal(withMovement[1].key, 'fbs-return-accepted:nimba:movement-1')
})

test('retry is idempotent and status changes update the same row', () => {
  const productNames = buildFbsProductNameMap([mappingRow])
  const events = buildFbsDesiredEvents({ account, productNames, orders: [order()], acceptedReturns: [] })
  const first = planFbsSheetUpsert({ existingRows: [mappingRow], desiredEvents: events, loadedAt: new Date() })
  assert.equal(first.inserted, 1)
  const allRows = Array.from(first.resultingRowsByKey.values())
  const retry = planFbsSheetUpsert({ existingRows: allRows, desiredEvents: events, loadedAt: new Date() })
  assert.deepEqual({ inserted: retry.inserted, updated: retry.updated, unchanged: retry.unchanged }, { inserted: 0, updated: 0, unchanged: 1 })

  const changed = buildFbsDesiredEvents({
    account, productNames, orders: [order({ wbStatus: 'canceled_by_client' })], acceptedReturns: [],
  })
  const update = planFbsSheetUpsert({ existingRows: allRows, desiredEvents: changed, loadedAt: new Date() })
  assert.equal(update.updated, 1)
  assert.equal(update.inserted, 0)
})

test('duplicate sheet keys and unknown product mapping fail fast', () => {
  assert.throws(() => planFbsSheetUpsert({
    existingRows: [mappingRow, { ...mappingRow, rowNumber: 7 }], desiredEvents: [], loadedAt: new Date(),
  }), /дублирующийся ключ/)
  assert.throws(() => buildFbsDesiredEvents({
    account, productNames: new Map(), orders: [order()], acceptedReturns: [],
  }), /Нет названия товара/)
})

test('a new tuple may use only one unambiguous product from the reference list', () => {
  const events = buildFbsDesiredEvents({
    account,
    productNames: new Map(),
    allowedProductNames: ['парео желтый шиф', 'парео синий шиф'],
    orders: [order({ vendorCode: 'парео желтый' })],
    acceptedReturns: [],
  })
  assert.equal(events[0].productName, 'парео желтый шиф')
})

test('duplicate WB listing is mapped to the canonical physical product', () => {
  const productNames = new Map([
    [fbsProductTupleKey('nimba', 297175085, 452136209), 'туника леопард/пятна'],
  ])
  const events = buildFbsDesiredEvents({
    account,
    productNames,
    allowedProductNames: ['туника леопард/пятна'],
    orders: [order({ nmId: 297175085, chrtId: 452136209, vendorCode: 'парео леопард/пятна' })],
    acceptedReturns: [],
  })
  assert.equal(events[0].productName, 'туника леопард/пятна')
})

test('duplicate blue-stripe listing is mapped to the canonical blue-waves tunic', () => {
  const productNames = new Map([
    [fbsProductTupleKey('nimba', 232092449, 366203604), 'туника синие волны'],
  ])
  const events = buildFbsDesiredEvents({
    account,
    productNames,
    allowedProductNames: ['туника синие волны'],
    orders: [order({ nmId: 232092449, chrtId: 366203604, vendorCode: 'парео синяя полоска' })],
    acceptedReturns: [],
  })
  assert.equal(events[0].productName, 'туника синие волны')
})

test('load timestamp is written as Moscow wall time for a Moscow-timezone sheet', () => {
  const serial = sheetSerialDateTime(new Date('2026-08-31T22:32:15.000Z'))
  const expected = sheetSerialDate('2026-09-01') + ((1 * 60 * 60) + (32 * 60) + 15) / 86_400
  assert.ok(Math.abs(serial - expected) < 1e-10)
})

test('WB stock snapshots aggregate duplicate listings under one physical product and retry safely', () => {
  const productNames = new Map([
    [fbsProductTupleKey('nimba', 100, 200), 'туника леопард/пятна'],
    [fbsProductTupleKey('nimba', 101, 201), 'туника леопард/пятна'],
  ])
  const syncedAt = new Date('2026-09-01T07:00:00Z')
  const snapshots = buildFbsWbStockSnapshots({
    account,
    productNames,
    stocks: [
      { nmId: 100, chrtId: 200, barcode: 'a', vendorCode: 'туника леопард', wbStock: 8, wbStockSyncedAt: syncedAt },
      { nmId: 101, chrtId: 201, barcode: 'b', vendorCode: 'парео леопард', wbStock: 7, wbStockSyncedAt: syncedAt },
    ],
  })
  assert.equal(snapshots.reduce((sum, snapshot) => sum + snapshot.wbStock, 0), 15)
  assert.deepEqual(new Set(snapshots.map((snapshot) => snapshot.productName)), new Set(['туника леопард/пятна']))

  const first = planFbsWbStockUpsert({ existingRows: [], desiredSnapshots: snapshots, activeAccountKeys: ['nimba'] })
  assert.equal(first.inserted, 2)
  const retry = planFbsWbStockUpsert({
    existingRows: Array.from(first.resultingRowsByKey.values()),
    desiredSnapshots: snapshots,
    activeAccountKeys: ['nimba'],
  })
  assert.deepEqual({ inserted: retry.inserted, updated: retry.updated, unchanged: retry.unchanged }, { inserted: 0, updated: 0, unchanged: 2 })
})

test('a disappeared WB stock tuple is retained with zero instead of a stale positive balance', () => {
  const existingRows: FbsSheetExistingRow[] = [{
    rowNumber: 2,
    values: ['товар', account.cabinetLabel, 9, 1, 100, 200, 'a', 'nimba', 'fbs-wb-stock:nimba:100:200'],
  }]
  const plan = planFbsWbStockUpsert({ existingRows, desiredSnapshots: [], activeAccountKeys: ['nimba'] })
  assert.equal(plan.updated, 1)
  assert.equal(plan.writes[0].values[2], 0)
})

test('daily reconciliation checks orders, cancellations and accepted returns', () => {
  assert.equal(reconcileFbsDay(
    { order: 3, cancellation: 1, 'accepted-return': 1 },
    { order: 3, cancellation: 1, 'accepted-return': 1 },
  ).exact, true)
  const mismatch = reconcileFbsDay(
    { order: 3, cancellation: 1, 'accepted-return': 1 },
    { order: 2, cancellation: 1, 'accepted-return': 0 },
  )
  assert.equal(mismatch.exact, false)
  assert.equal(mismatch.skippedOrders, 1)
})
