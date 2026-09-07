import assert from 'node:assert/strict'
import test from 'node:test'
import { FBS_FULFILLMENT_SUMMARY_RANGE, planFbsFulfillmentSummary, type FbsFulfillmentSummaryMetric } from './fbs-fulfillment-summary'

const fulfillment: FbsFulfillmentSummaryMetric = {
  dateFrom: '2026-07-20', dateTo: '2026-09-06', asOf: '2026-09-06T20:59:59.999Z',
  status: 'EXACT', units: 147, lowerBound: 147, confirmedAcceptanceLowerBound: 63, ordersInSource: 201,
}
const plan = (overrides: Partial<Parameters<typeof planFbsFulfillmentSummary>[0]> = {}) => planFbsFulfillmentSummary({
  summarySheetId: 17, currentValues: [], merges: [], fulfillment, ...overrides,
})

test('exact handoffs are numeric and acceptance remains a lower bound for the same explicit period', () => {
  const result = plan()
  assert.equal(FBS_FULFILLMENT_SUMMARY_RANGE, 'K4:L6')
  assert.deepEqual(result.values, [
    ['Передано в доставку по WB, шт.', 'Приёмка WB подтверждена, шт.'],
    [147, 'не менее 63'],
    ['Период, МСК', '20.07.2026–06.09.2026'],
  ])
  assert.match(result.requests[0].updateCells!.rows![0].values![0].note!, /не подтверждает физическую приёмку/)
  assert.match(result.requests[0].updateCells!.rows![0].values![1].note!, /отсутствие подтверждения не означает/)
  assert.match(result.requests[0].updateCells!.rows![0].values![1].note!, /06.09.2026 23:59:59 МСК/)
  assert.match(result.requests[2].updateCells!.rows![0].values![1].note!, /Поздние отмены и возвраты не вычитаются/)
})

test('incomplete handoffs never become an exact zero and absent source data stays unavailable', () => {
  assert.deepEqual(plan({ fulfillment: { ...fulfillment, status: 'INCOMPLETE', units: null } }).values[1], ['не менее 147', 'не менее 63'])
  assert.deepEqual(plan({ fulfillment: { ...fulfillment, lowerBound: 0, units: 0, confirmedAcceptanceLowerBound: 0, ordersInSource: 0 } }).values[1], ['Нет данных', 'Нет данных'])
  assert.deepEqual(plan({ fulfillment: { ...fulfillment, lowerBound: 0, units: 0, confirmedAcceptanceLowerBound: 0 } }).values[1], [0, 'не менее 0'])
})

test('retries own exactly the complete layout and can update a prior valid period', () => {
  const initial = plan()
  const snapshot = JSON.stringify(initial.values)
  assert.deepEqual(plan({ currentValues: initial.values }), initial)
  assert.equal(JSON.stringify(initial.values), snapshot)
  const incomplete = plan({ currentValues: initial.values, fulfillment: { ...fulfillment, status: 'INCOMPLETE', units: null, dateTo: '2026-09-07' } })
  assert.deepEqual(plan({ currentValues: incomplete.values }).values, initial.values)
  const unavailable = plan({ fulfillment: { ...fulfillment, lowerBound: 0, units: 0, confirmedAcceptanceLowerBound: 0, ordersInSource: 0 } })
  assert.deepEqual(plan({ currentValues: unavailable.values }).values, initial.values)
})

test('unknown values, formulas, partial layouts and malformed prior counts or periods fail before writes', () => {
  const owned = plan().values
  for (const currentValues of [
    [['Заметка сотрудника']], [[' ']], [[0]], [['=SUM(A1:A3)']],
    [owned[0]], [owned[0], ['=147', 'не менее 63'], owned[2]],
    [owned[0], [-1, 'не менее 63'], owned[2]],
    [owned[0], ['147', 'не менее 63'], owned[2]],
    [owned[0], owned[1], ['Период, МСК', '31.02.2026–06.09.2026']],
    [owned[0], owned[1], ['Период, МСК', '07.09.2026–06.09.2026']],
  ]) assert.throws(() => plan({ currentValues }), /неизвестные данные или формулы/)
})

test('any overlapping merge blocks writes, but another sheet and adjacent cells do not', () => {
  assert.throws(() => plan({ merges: [{ sheetId: 17, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 10, endColumnIndex: 12 }] }), /объединена/)
  assert.throws(() => plan({ merges: [{ sheetId: 17, startRowIndex: 0, endRowIndex: 5, startColumnIndex: 9, endColumnIndex: 11 }] }), /объединена/)
  assert.throws(() => plan({ merges: [{ startRowIndex: 5, startColumnIndex: 11 }] }), /объединена/)
  assert.doesNotThrow(() => plan({ merges: [
    { sheetId: 18, startRowIndex: 3, endRowIndex: 6, startColumnIndex: 10, endColumnIndex: 12 },
    { sheetId: 17, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 10, endColumnIndex: 12 },
    { sheetId: 17, startRowIndex: 3, endRowIndex: 6, startColumnIndex: 12, endColumnIndex: 13 },
  ] }))
})

test('requests touch six target cells and only row 4 height, preserving existing row 6 borders', () => {
  const { requests } = plan()
  assert.equal(requests.length, 4)
  for (const [index, request] of Array.from(requests.slice(0, 3).entries())) {
    assert.deepEqual(Object.keys(request), ['updateCells'])
    assert.deepEqual(request.updateCells!.start, { sheetId: 17, rowIndex: 3 + index, columnIndex: 10 })
    assert.equal(request.updateCells!.rows!.length, 1)
    assert.equal(request.updateCells!.rows![0].values!.length, 2)
    assert.doesNotMatch(request.updateCells!.fields!, /borders|\*|numberFormat/)
    assert.ok(!request.updateCells!.fields!.split(',').includes('userEnteredFormat'))
    for (const cell of request.updateCells!.rows![0].values!) {
      assert.ok(!cell.userEnteredValue?.formulaValue)
      assert.ok(!cell.userEnteredFormat?.borders)
    }
  }
  assert.deepEqual(requests[3], { updateDimensionProperties: {
    range: { sheetId: 17, dimension: 'ROWS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 60 }, fields: 'pixelSize',
  } })
  assert.equal(requests[1].updateCells!.rows![0].values![0].userEnteredFormat!.textFormat!.fontSize, 16)
  assert.equal(requests[0].updateCells!.rows![0].values![0].userEnteredFormat!.wrapStrategy, 'WRAP')
})

test('invalid source metrics cannot be presented as verified counts', () => {
  for (const invalid of [
    { ...fulfillment, units: null },
    { ...fulfillment, status: 'INCOMPLETE' as const },
    { ...fulfillment, confirmedAcceptanceLowerBound: 148 },
    { ...fulfillment, ordersInSource: 146 },
    { ...fulfillment, lowerBound: -1, units: -1 },
    { ...fulfillment, dateFrom: '2026-09-07' },
    { ...fulfillment, asOf: '2026-09-06T23:59:59' },
  ]) assert.throws(() => plan({ fulfillment: invalid }))
})
