import assert from 'node:assert/strict'
import test from 'node:test'
import { assertInventoryBalance, deriveFbsTransition } from './state-machine'

test('new order reserves without changing on-hand', () => {
  assert.deepEqual(
    deriveFbsTransition(null, {
      supplierStatus: 'new',
      wbStatus: 'waiting',
      reservationApplied: false,
      shipmentApplied: false,
      hasKiz: false,
      requiresKiz: false,
    }),
    ['RESERVE'],
  )
})

test('pre-handoff cancellation releases and unassigns KIZ', () => {
  assert.deepEqual(
    deriveFbsTransition(
      {
        supplierStatus: 'confirm',
        wbStatus: 'waiting',
        reservationApplied: true,
        shipmentApplied: false,
        hasKiz: true,
        requiresKiz: true,
      },
      {
        supplierStatus: 'cancel',
        wbStatus: 'canceled',
        reservationApplied: true,
        shipmentApplied: false,
        hasKiz: true,
        requiresKiz: true,
      },
    ),
    ['RELEASE', 'UNASSIGN_KIZ'],
  )
})

test('an order first observed as canceled is never reserved', () => {
  assert.deepEqual(
    deriveFbsTransition(null, {
      supplierStatus: 'new',
      wbStatus: 'canceled_by_client',
      reservationApplied: false,
      shipmentApplied: false,
      hasKiz: false,
      requiresKiz: false,
    }),
    [],
  )
})

test('an order first observed declined before handoff never creates shipment or withdrawal', () => {
  assert.deepEqual(
    deriveFbsTransition(null, {
      supplierStatus: 'complete',
      wbStatus: 'declined_by_client',
      reservationApplied: false,
      shipmentApplied: false,
      hasKiz: true,
      requiresKiz: true,
    }, { enforceShipmentGuard: false }),
    ['UNASSIGN_KIZ'],
  )
})

test('cancellation at pickup never unassigns the KIZ even when shipment flag arrived late', () => {
  assert.deepEqual(
    deriveFbsTransition(
      {
        supplierStatus: 'complete',
        wbStatus: 'sorted',
        reservationApplied: false,
        shipmentApplied: false,
        hasKiz: true,
        requiresKiz: true,
      },
      {
        supplierStatus: 'complete',
        wbStatus: 'canceled_by_client',
        reservationApplied: false,
        shipmentApplied: false,
        hasKiz: true,
        requiresKiz: true,
      },
      { enforceShipmentGuard: false },
    ),
    ['SHIP', 'MARK_HANDED_OVER', 'CANCEL_PENDING_WITHDRAWAL'],
  )
})

test('defect after handoff keeps the assigned KIZ and marks its return expected', () => {
  assert.deepEqual(
    deriveFbsTransition(
      {
        supplierStatus: 'complete',
        wbStatus: 'sorted',
        reservationApplied: false,
        shipmentApplied: true,
        hasKiz: true,
        requiresKiz: true,
      },
      {
        supplierStatus: 'complete',
        wbStatus: 'defect',
        reservationApplied: false,
        shipmentApplied: true,
        hasKiz: true,
        requiresKiz: true,
      },
    ),
    ['CANCEL_PENDING_WITHDRAWAL', 'MARK_RETURN_EXPECTED'],
  )
})

test('an order first observed as canceled releases an attached KIZ without reserving stock', () => {
  assert.deepEqual(
    deriveFbsTransition(null, {
      supplierStatus: 'cancel',
      wbStatus: 'canceled',
      reservationApplied: false,
      shipmentApplied: false,
      hasKiz: true,
      requiresKiz: true,
    }),
    ['UNASSIGN_KIZ'],
  )
})

test('marked order cannot ship without KIZ', () => {
  assert.throws(() =>
    deriveFbsTransition(
      {
        supplierStatus: 'confirm',
        wbStatus: 'waiting',
        reservationApplied: true,
        shipmentApplied: false,
        hasKiz: false,
        requiresKiz: true,
      },
      {
        supplierStatus: 'complete',
        wbStatus: 'sorted',
        reservationApplied: true,
        shipmentApplied: false,
        hasKiz: false,
        requiresKiz: true,
      },
    ),
  )
})

test('handoff of a marked order creates the withdrawal task immediately', () => {
  assert.deepEqual(
    deriveFbsTransition(
      {
        supplierStatus: 'confirm',
        wbStatus: 'waiting',
        reservationApplied: true,
        shipmentApplied: false,
        hasKiz: true,
        requiresKiz: true,
      },
      {
        supplierStatus: 'complete',
        wbStatus: 'sorted',
        reservationApplied: true,
        shipmentApplied: false,
        hasKiz: true,
        requiresKiz: true,
      },
    ),
    ['SHIP', 'MARK_HANDED_OVER', 'CREATE_WITHDRAWAL_TASK'],
  )
})

test('a KIZ arriving after sold status still creates the withdrawal task', () => {
  assert.deepEqual(
    deriveFbsTransition(
      {
        supplierStatus: 'complete',
        wbStatus: 'sold',
        reservationApplied: false,
        shipmentApplied: true,
        hasKiz: false,
        requiresKiz: true,
      },
      {
        supplierStatus: 'complete',
        wbStatus: 'sold',
        reservationApplied: false,
        shipmentApplied: true,
        hasKiz: true,
        requiresKiz: true,
      },
    ),
    ['CREATE_WITHDRAWAL_TASK'],
  )
})

test('inventory invariant rejects reserve above on-hand', () => {
  assert.throws(() => assertInventoryBalance(2, 3))
  assert.doesNotThrow(() => assertInventoryBalance(3, 2))
})
