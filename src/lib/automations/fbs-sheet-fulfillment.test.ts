import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { prisma } from '@/lib/db'
import { loadFbsSheetFulfillment } from '@/lib/services/fbs-sheet-fulfillment'
import { sheetSerialDate, type FbsSheetExistingRow } from './fbs-sheet'

const targetDate = '2026-09-07'
const accounts = [{ wbAccountId: 'account-a', technicalKey: 'cabinet-a' }]
const date = (value: string) => new Date(value)
const defaultOrder = () => ({
  wbAccountId: 'account-a', externalOrderId: BigInt(1), createdAtWb: date('2026-03-01T09:00:00Z'),
  fetchedAt: date('2026-09-07T12:00:00Z'), supplierStatus: 'complete', wbStatus: 'waiting', shipmentApplied: true,
  supply: { wbAccountId: 'account-a', externalId: 'current', done: true, closedAt: date('2026-09-06T10:00:00Z') },
  events: [{ supplierStatus: 'complete', wbStatus: 'sorted', supplyExternalId: 'old', observedAt: date('2026-03-02T12:00:00Z') }],
})
const sheetOrder = (externalOrderId: string, value: string, key = 'cabinet-a'): FbsSheetExistingRow => ({
  rowNumber: 6,
  values: [sheetSerialDate(value), 'Товар', 'Заказ', 1, '', 'Кабинет', externalOrderId, 10, 101, 'NimbaOS', `fbs-order:${key}:${externalOrderId}`],
})
function stub(t: TestContext, target: unknown, method: string, replacement: unknown) {
  const object = target as Record<string, unknown>
  const original = object[method]
  object[method] = replacement
  t.after(() => { object[method] = original })
}
function healthyCoverage(t: TestContext) {
  stub(t, prisma.syncJobRun, 'findFirst', async () => ({ finishedAt: date('2026-09-08T01:00:00Z'), result: { period: { dateTo: targetDate } } }))
}

test('cumulative fulfillment starts at earliest local order, reads historical supplies, and retains full events', async (t) => {
  healthyCoverage(t)
  const order = defaultOrder()
  order.events.push({ supplierStatus: 'complete', wbStatus: 'sold', supplyExternalId: 'current', observedAt: date('2026-09-08T12:00:00Z') })
  stub(t, prisma.fbsOrder, 'findMany', async (query: {
    where: { wbAccountId: { in: string[] }; createdAtWb: { lt: Date; gte?: Date } }
    take: number; select: { events: { where?: unknown } }
  }) => {
    assert.deepEqual(query.where.wbAccountId.in, ['account-a'])
    assert.equal(query.where.createdAtWb.lt.toISOString(), '2026-09-07T21:00:00.000Z')
    assert.equal(query.where.createdAtWb.gte, undefined, 'config.startDate must never bound cumulative orders')
    assert.equal(query.take, 50_001)
    assert.equal(query.select.events.where, undefined, 'earlier and later handoff evidence stays available to the helper')
    return [order]
  })
  const supplyQueries: unknown[] = []
  stub(t, prisma.fbsSupply, 'findMany', async (query: unknown) => {
    supplyQueries.push(query)
    return [{ wbAccountId: 'account-a', externalId: 'old', done: true, closedAt: date('2026-03-02T10:00:00Z') }]
  })
  const result = await loadFbsSheetFulfillment({ accounts, targetDate, existingRows: [sheetOrder('1', '2026-03-01')] })
  assert.equal(result.dateFrom, '2026-03-01')
  assert.equal(result.dateTo, targetDate)
  assert.equal(result.asOf, '2026-09-07T20:59:59.999Z')
  assert.equal(result.units, 1, 'a later reshipment never counts the order a second time')
  assert.equal(result.confirmedAcceptance, 1)
  assert.equal(result.confirmedAcceptanceLowerBound, 1)
  assert.equal(result.status, 'EXACT')
  assert.equal(result.sourceStatus, 'COMPLETE_LOCAL_HISTORY')
  assert.deepEqual(supplyQueries, [{
    where: { wbAccountId: 'account-a', externalId: { in: ['old'] } },
    select: { wbAccountId: true, externalId: true, done: true, closedAt: true },
  }])
})

test('an older Sheet order missing locally extends period and prevents false exact totals', async (t) => {
  healthyCoverage(t)
  stub(t, prisma.fbsOrder, 'findMany', async () => [{ ...defaultOrder(), events: [] }])
  stub(t, prisma.fbsSupply, 'findMany', async () => assert.fail('current supplies must not be fetched again'))
  const result = await loadFbsSheetFulfillment({ accounts, targetDate, existingRows: [
    sheetOrder('1', '2026-03-01'), sheetOrder('2', '2026-02-01'),
    sheetOrder('3', '2026-01-01', 'other-cabinet'), sheetOrder('4', '2026-09-08'),
  ] })
  assert.equal(result.dateFrom, '2026-02-01')
  assert.equal(result.units, null)
  assert.equal(result.lowerBound, 1)
  assert.equal(result.confirmedAcceptance, null)
  assert.equal(result.unknownAcceptance, null)
  assert.equal(result.status, 'INCOMPLETE')
  assert.deepEqual(result.missingLocalOrderKeys, ['fbs-order:cabinet-a:2'])
  assert.ok(result.sourceDiagnostics.some((row) => row.reason === 'MISSING_LOCAL_ORDER'))
})

test('uncovered target or corrupt Sheet dates yield explicit incomplete source diagnostics', async (t) => {
  stub(t, prisma.syncJobRun, 'findFirst', async () => ({ finishedAt: date('2026-09-06T09:00:00Z'), result: { period: { dateTo: '2026-09-06' } } }))
  stub(t, prisma.fbsOrder, 'findMany', async () => [{ ...defaultOrder(), events: [] }])
  const invalid = sheetOrder('1', '2026-03-01')
  invalid.values[0] = '2026-02-30'
  const result = await loadFbsSheetFulfillment({ accounts, targetDate, existingRows: [invalid] })
  assert.equal(result.units, null)
  assert.ok(result.sourceDiagnostics.some((row) => row.reason === 'INVALID_SHEET_ORDER_DATE'))
  assert.ok(result.sourceDiagnostics.some((row) => row.reason === 'MISSING_TARGET_COVERAGE'))
})

test('same external order and historical supply IDs remain separate between cabinets', async (t) => {
  healthyCoverage(t)
  const first = defaultOrder()
  const second = { ...defaultOrder(), wbAccountId: 'account-b', supply: null,
    supplierStatus: 'cancel', wbStatus: 'canceled', shipmentApplied: false }
  stub(t, prisma.fbsOrder, 'findMany', async () => [first, second])
  const queriedAccounts: string[] = []
  stub(t, prisma.fbsSupply, 'findMany', async ({ where }: { where: { wbAccountId: string } }) => {
    queriedAccounts.push(where.wbAccountId)
    return [{ wbAccountId: where.wbAccountId, externalId: 'old', done: true, closedAt: date('2026-03-02T10:00:00Z') }]
  })
  const result = await loadFbsSheetFulfillment({ accounts: [...accounts, { wbAccountId: 'account-b', technicalKey: 'cabinet-b' }],
    targetDate, existingRows: [sheetOrder('1', '2026-03-01'), sheetOrder('1', '2026-03-01', 'cabinet-b')] })
  assert.equal(result.units, 2)
  assert.deepEqual(queriedAccounts, ['account-a', 'account-b'])
  assert.deepEqual(result.missingLocalOrderKeys, [])
})

test('an acceptance observed after the Moscow report cutoff cannot become an earlier exact acceptance', async (t) => {
  healthyCoverage(t)
  stub(t, prisma.fbsOrder, 'findMany', async () => [{ ...defaultOrder(),
    fetchedAt: date('2026-09-07T21:00:00Z'), wbStatus: 'sold', events: [],
  }])
  const result = await loadFbsSheetFulfillment({ accounts, targetDate, existingRows: [] })
  assert.equal(result.units, 1)
  assert.equal(result.confirmedAcceptance, 0)
  assert.equal(result.unknownAcceptance, 1)
})

test('guard rejects incomplete order pages and invalid account identities before returning a number', async (t) => {
  healthyCoverage(t)
  stub(t, prisma.fbsOrder, 'findMany', async () => Array.from({ length: 50_001 }, defaultOrder))
  await assert.rejects(() => loadFbsSheetFulfillment({ accounts, targetDate, existingRows: [] }), /более 50000/)
  await assert.rejects(() => loadFbsSheetFulfillment({ accounts: [...accounts, ...accounts], targetDate, existingRows: [] }), /повторяется/)
  await assert.rejects(() => loadFbsSheetFulfillment({ accounts, targetDate: '2026-02-30', existingRows: [] }), /Некорректная дата/)
})
