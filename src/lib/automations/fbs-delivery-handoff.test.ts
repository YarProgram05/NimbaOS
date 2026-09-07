import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeFbsDeliveryHandoffs, type FbsHandoffOrder, type FbsHandoffSupply } from './fbs-delivery-handoff'

const day = '2026-09-07'
const date = (value: string) => new Date(value)
const supply = (overrides: Partial<FbsHandoffSupply> = {}): FbsHandoffSupply => ({
  wbAccountId: 'nimba', externalId: 'WB-GI-1', done: true, closedAt: date('2026-09-07T09:00:00Z'), ...overrides,
})
const order = (overrides: Partial<FbsHandoffOrder> = {}): FbsHandoffOrder => ({
  wbAccountId: 'nimba', externalOrderId: '1', supplierStatus: 'complete', wbStatus: 'waiting',
  supplyExternalId: 'WB-GI-1', createdAtWb: date('2026-09-01T09:00:00Z'), ...overrides,
})
const summarize = (orders: FbsHandoffOrder[], supplies = [supply()]) => summarizeFbsDeliveryHandoffs({
  orders, supplies, dateFrom: day, dateTo: day, asOf: date('2026-09-20T21:00:00Z'),
})

test('counts one piece per assembly order, not barcode count, basket, or marking codes', () => {
  const records = [
    { ...order(), orderUid: 'one-basket', skus: ['barcode-a', 'barcode-b'], markingCodes: ['one', 'two'] },
    { ...order({ externalOrderId: '2' }), orderUid: 'one-basket', skus: ['barcode-a'], markingCodes: [] },
  ]
  const result = summarize(records)
  assert.equal(result.units, 2)
  assert.equal(result.status, 'EXACT')
  assert.equal(result.metricKind, 'WB_SYSTEM_DELIVERY')
  assert.equal(result.dateBasis, 'WB_SUPPLY_CLOSED_AT')
})

test('period uses WB closure and Moscow boundaries instead of order creation or local observation dates', () => {
  const supplies = [
    supply({ externalId: 'before', closedAt: date('2026-09-06T20:59:59Z') }),
    supply({ externalId: 'start', closedAt: date('2026-09-06T21:00:00Z') }),
    supply({ externalId: 'end', closedAt: date('2026-09-07T20:59:59Z') }),
    supply({ externalId: 'after', closedAt: date('2026-09-07T21:00:00Z') }),
  ]
  const records = supplies.map((item, index) => ({
    ...order({ externalOrderId: String(index + 1), supplyExternalId: item.externalId }),
    observedAt: date('2026-09-20T09:00:00Z'), shippedAt: date('2026-09-20T09:00:00Z'),
  }))
  assert.equal(summarize(records, supplies).units, 2)
})

test('late seller cancellation cannot erase an earlier complete event with a WB closure', () => {
  const result = summarize([order({
    supplierStatus: 'cancel', wbStatus: 'canceled', supplyExternalId: null,
    events: [{ supplierStatus: 'complete', wbStatus: 'waiting', supplyExternalId: 'WB-GI-1' }],
  })])
  assert.equal(result.units, 1)
})

test('client return, defect and sale preserve the delivery transition', () => {
  const records = ['canceled_by_client', 'defect', 'sold'].map((wbStatus, index) => order({
    externalOrderId: String(index + 1), supplierStatus: 'complete', wbStatus,
  }))
  assert.equal(summarize(records).units, 3)
})

test('complete paired only with a pre-handoff cancellation is not delivery evidence', () => {
  const records = ['canceled', 'declined_by_client'].map((wbStatus, index) => order({
    externalOrderId: String(index + 1), wbStatus, shipmentApplied: false,
  }))
  assert.equal(summarize(records).units, 0)
})

test('generic membership in a later-closed supply does not prove that the order was handed over', () => {
  const result = summarize([order({
    supplierStatus: 'confirm', wbStatus: 'waiting',
    events: [{ supplierStatus: 'new', wbStatus: 'waiting', supplyExternalId: 'WB-GI-1' }],
  })])
  assert.equal(result.units, 0)
  assert.deepEqual(result.firstHandoffs, [])
})

test('duplicate rows and repeated complete events count once while account-scoped identities stay separate', () => {
  const nimba = order({ events: [
    { supplierStatus: 'complete', wbStatus: 'waiting', supplyExternalId: 'WB-GI-1' },
    { supplierStatus: 'complete', wbStatus: 'sold', supplyExternalId: 'WB-GI-1' },
  ] })
  const result = summarize([nimba, nimba, order({ wbAccountId: 'galioni' })], [
    supply(), supply({ wbAccountId: 'galioni' }),
  ])
  assert.equal(result.units, 2)
  assert.deepEqual(result.reshipmentOrderKeys, [])
})

test('missing or invalid official dates produce unknown diagnostics and no publishable numeric total', () => {
  const result = summarize([
    order(),
    order({ externalOrderId: '2', supplyExternalId: null }),
    order({ externalOrderId: '3', supplyExternalId: 'no-date' }),
    order({ externalOrderId: '4', supplyExternalId: 'invalid-date' }),
  ], [supply(), supply({ externalId: 'no-date', closedAt: null }), supply({ externalId: 'invalid-date', closedAt: date('invalid') })])
  assert.equal(result.units, null)
  assert.equal(result.status, 'INCOMPLETE')
  assert.equal(result.lowerBound, 1)
  assert.equal(result.unknown, 3)
  assert.deepEqual(result.diagnostics.map((item) => item.reason), ['MISSING_SUPPLY', 'MISSING_CLOSED_AT', 'INVALID_CLOSED_AT'])
})

test('a persisted shipment flag cannot supply a date or tie an earlier handoff to the current supply', () => {
  const result = summarize([order({ supplierStatus: 'confirm', wbStatus: 'waiting', shipmentApplied: true })])
  assert.equal(result.units, null)
  assert.equal(result.unknown, 1)
  assert.equal(result.diagnostics[0].reason, 'HANDOFF_WITHOUT_SUPPLY_EVIDENCE')
})

test('moving an order to another open supply preserves the earlier confirmed supply date', () => {
  const result = summarize([order({
    supplierStatus: 'confirm', wbStatus: 'waiting', shipmentApplied: true, supplyExternalId: 'reshipment',
    events: [{ supplierStatus: 'complete', wbStatus: 'waiting', supplyExternalId: 'WB-GI-1' }],
  })], [supply(), supply({ externalId: 'reshipment', done: false, closedAt: null })])
  assert.equal(result.units, 1)
  assert.equal(result.firstHandoffs[0].supplyExternalId, 'WB-GI-1')
})

test('two confirmed deliveries count an assembly order once by the earliest known closure', () => {
  const result = summarize([order({
    events: [{ supplierStatus: 'complete', wbStatus: 'waiting', supplyExternalId: 'first' }],
  })], [supply(), supply({ externalId: 'first', closedAt: date('2026-09-06T09:00:00Z') })])
  assert.equal(result.units, 0)
  assert.equal(result.firstHandoffs[0].supplyExternalId, 'first')
  assert.deepEqual(result.reshipmentOrderKeys, ['nimba:1'])
})

test('an undated earlier handoff cannot be replaced by a later reshipment date', () => {
  const result = summarize([order({
    events: [{ supplierStatus: 'complete', wbStatus: 'waiting', supplyExternalId: 'first' }],
  })], [supply(), supply({ externalId: 'first', closedAt: null })])
  assert.equal(result.units, null)
  assert.equal(result.lowerBound, 0)
  assert.equal(result.unknown, 1)
  assert.deepEqual(result.firstHandoffs, [])
  assert.deepEqual(result.reshipmentOrderKeys, ['nimba:1'])
})

test('a supply must be closed and its closure cannot precede the order or follow the observed completed state', () => {
  const result = summarize([
    order({ externalOrderId: '1', supplyExternalId: 'open' }),
    order({ externalOrderId: '2', createdAtWb: date('2026-09-07T10:00:00Z') }),
    order({ externalOrderId: '3', observedAt: date('2026-09-07T08:00:00Z') }),
  ], [supply(), supply({ externalId: 'open', done: false })])
  assert.equal(result.units, null)
  assert.deepEqual(result.diagnostics.map((item) => item.reason), [
    'SUPPLY_NOT_CLOSED', 'CLOSED_BEFORE_ORDER', 'CLOSED_AFTER_OBSERVATION',
  ])
})

test('conflicting copies of a supply and invalid reporting dates fail without a count', () => {
  assert.throws(() => summarize([order()], [supply(), supply({ closedAt: null })]), /Противоречивые/)
  assert.throws(() => summarizeFbsDeliveryHandoffs({ orders: [], supplies: [], dateFrom: '2026-02-30', dateTo: day, asOf: date(day) }), /Некорректная дата/)
  assert.throws(() => summarizeFbsDeliveryHandoffs({ orders: [], supplies: [], dateFrom: '2026-09-08', dateTo: day, asOf: date(day) }), /позже окончания/)
})

test('acceptance proof uses only individual sorted, pickup, or sold statuses within the same handoff cohort', () => {
  const records = ['sorted', 'ready_for_pickup', 'sold', 'accepted_by_carrier', 'defect', 'canceled_by_client', 'waiting']
    .map((wbStatus, index) => order({ externalOrderId: String(index + 1), wbStatus, observedAt: date('2026-09-08T09:00:00Z') }))
  const result = summarize(records)
  assert.equal(result.units, 7)
  assert.equal(result.confirmedAcceptance, 3)
  assert.equal(result.unknownAcceptance, 4)
  assert.equal(result.confirmedAcceptance! + result.unknownAcceptance!, result.units)
})

test('acceptance known after the handoff period but before the report cutoff counts without inventing its physical date', () => {
  const result = summarizeFbsDeliveryHandoffs({
    orders: [order({ wbStatus: 'sold', observedAt: date('2026-09-09T09:00:00Z') })], supplies: [supply()],
    dateFrom: day, dateTo: day, asOf: date('2026-09-10T09:00:00Z'),
  })
  assert.equal(result.confirmedAcceptance, 1)
  assert.equal(result.unknownAcceptance, 0)
  assert.equal('acceptedAt' in result, false)
  assert.equal('acceptedAt' in result.firstHandoffs[0], false)
})

test('acceptance observed after cutoff is ignored, including at the next millisecond', () => {
  const asOf = date('2026-09-08T09:00:00Z')
  const result = summarizeFbsDeliveryHandoffs({
    orders: [
      order({ externalOrderId: '1', wbStatus: 'sorted', observedAt: asOf }),
      order({ externalOrderId: '2', wbStatus: 'sold', observedAt: new Date(asOf.getTime() + 1) }),
    ],
    supplies: [supply()], dateFrom: day, dateTo: day, asOf,
  })
  assert.equal(result.units, 2)
  assert.equal(result.confirmedAcceptance, 1)
  assert.equal(result.unknownAcceptance, 1)
  assert.equal(result.acceptanceDiagnostics[0].reason, 'OBSERVED_AFTER_CUTOFF')
})

test('earlier per-order acceptance remains confirmed after a late cancellation or return', () => {
  const result = summarize(['canceled', 'defect', 'canceled_by_client'].map((wbStatus, index) => order({
    externalOrderId: String(index + 1), wbStatus, shipmentApplied: true,
    events: [{ supplierStatus: 'complete', wbStatus: 'sorted', supplyExternalId: 'WB-GI-1', observedAt: date('2026-09-08T09:00:00Z') }],
  })))
  assert.equal(result.units, 3)
  assert.equal(result.confirmedAcceptance, 3)
  assert.equal(result.unknownAcceptance, 0)
})

test('missing or invalid acceptance observation timestamps are unconfirmed, not assigned artificial dates', () => {
  const result = summarize([
    order({ wbStatus: 'sold', observedAt: null }),
    order({ externalOrderId: '2', wbStatus: 'sorted', observedAt: date('invalid') }),
  ])
  assert.equal(result.units, 2)
  assert.equal(result.confirmedAcceptance, 0)
  assert.equal(result.unknownAcceptance, 2)
  assert.deepEqual(result.acceptanceDiagnostics.map((item) => item.reason), ['MISSING_OBSERVED_AT', 'INVALID_OBSERVED_AT'])
})

test('accepted orders from another handoff period do not inflate the cohort acceptance count', () => {
  const result = summarize([
    order({ externalOrderId: '1', wbStatus: 'waiting' }),
    order({ externalOrderId: '2', supplyExternalId: 'older', wbStatus: 'sold', observedAt: date('2026-09-08T09:00:00Z') }),
  ], [supply(), supply({ externalId: 'older', closedAt: date('2026-09-06T09:00:00Z') })])
  assert.equal(result.units, 1)
  assert.equal(result.confirmedAcceptance, 0)
  assert.equal(result.unknownAcceptance, 1)
})

test('unknown handoff dates make both cohort acceptance metrics unavailable even with a sold status', () => {
  const result = summarize([order({ wbStatus: 'sold', observedAt: date('2026-09-08T09:00:00Z') })], [supply({ closedAt: null })])
  assert.equal(result.units, null)
  assert.equal(result.confirmedAcceptance, null)
  assert.equal(result.unknownAcceptance, null)
})

test('a system handoff after snapshot cutoff is not counted yet', () => {
  const result = summarizeFbsDeliveryHandoffs({ orders: [order()], supplies: [supply()], dateFrom: day, dateTo: day, asOf: date('2026-09-07T08:00:00Z') })
  assert.equal(result.units, 0)
  assert.equal(result.confirmedAcceptance, 0)
  assert.equal(result.unknownAcceptance, 0)
})
