import assert from 'node:assert/strict'
import test from 'node:test'
import { assertFbsSummaryProductCoverage, planFbsReferenceExpansion } from './fbs-reference'

const summary = () => [
  ['Товар'],
  ...Array.from({ length: 150 }, (_, index) => [
    `=IF('Справочники'!A${index + 4}="";"";'Справочники'!A${index + 4})`,
    ...Array.from({ length: 19 }, () => '=SUMIFS(Операции!D:D;Операции!B:B;A8)'),
  ]),
]
const plan = (referenceValues: unknown[][], desiredNames: string[], summaryValues = summary()) => planFbsReferenceExpansion({
  referenceValues, desiredNames, summaryValues, referenceSheetId: 42, referenceSheetName: 'Справочники',
})

test('registers approved names in first empty slots without touching formulas, footer, or quantities', () => {
  const reference = Array.from({ length: 152 }, (_, i) => i < 47 ? [`Старый товар ${i}`] : [])
  reference[151] = ['Как пользоваться: новый товар добавьте…']
  const result = plan(reference, ['Новое название', '=literal WB name'])
  assert.equal(result.requests.length, 2)
  assert.deepEqual(result.requests.map((request) => request.updateCells?.start), [
    { sheetId: 42, rowIndex: 50, columnIndex: 0 },
    { sheetId: 42, rowIndex: 51, columnIndex: 0 },
  ])
  assert.deepEqual(result.requests[0].updateCells?.rows?.[0].values?.[0], {
    userEnteredValue: { stringValue: '=literal WB name' },
  })
  for (const request of result.requests) assert.deepEqual(Object.keys(request), ['updateCells'])
  assert.equal(reference[47].length, 0)
})

test('fills gaps, deduplicates shared physical names and retries after reference-only completion', () => {
  const result = plan([['A'], [], ['B']], ['C', 'C', 'A'])
  assert.equal(result.requests[0].updateCells?.start?.rowIndex, 4)
  assert.deepEqual(plan([['A'], ['C'], ['B']], ['C', 'A']).requests, [])
})

test('stops before writing if capacity is exhausted or the matching summary row is damaged', () => {
  assert.throws(() => plan(Array.from({ length: 150 }, (_, i) => [`P${i}`]), ['New']), /заполнен/)
  const damaged = summary()
  damaged[2] = ['Ручная заметка', '17']
  assert.throws(() => plan([['A']], ['New'], damaged), /не соответствует шаблону/)
  const brokenFormula = summary()
  brokenFormula[2][1] = '10'
  assert.throws(() => plan([['A']], ['New'], brokenFormula), /не соответствует шаблону/)
})

test('summary verification detects omitted products including zero-stock or order-only products', () => {
  assert.throws(() => assertFbsSummaryProductCoverage([['Товар'], ['A']], ['A', 'New']), /отсутствуют товары: New/)
  assert.throws(() => assertFbsSummaryProductCoverage([['Товар'], ['A'], ['A']], ['A']), /повторяется/)
  assertFbsSummaryProductCoverage([['Товар'], ['A'], ['New']], ['A', 'New'])
})
