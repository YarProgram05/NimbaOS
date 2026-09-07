import assert from 'node:assert/strict'
import test from 'node:test'
import { suggestFbsProductGroups } from './fbs-mapping-suggestions'

test('category, belt phrasing and seller abbreviations rank a confirmed motif as a suggestion', () => {
  const result = suggestFbsProductGroups({
    vendorCode: '  ПАРЕО пояс черн. развод  ',
    groups: ['с поясом черные разводы', 'с поясом синие разводы'],
    confirmedExamples: [
      { productName: 'с поясом черные разводы', vendorCode: 'туника с поясом черные разводы' },
      { productName: 'с поясом синие разводы', vendorCode: 'пояс синие разводы' },
    ],
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].productName, 'с поясом черные разводы')
  assert.equal(result[0].matchedVendorCode, 'туника с поясом черные разводы')
  assert.match(result[0].reason, /Требуется подтверждение/)
})

test('a belt listing does not suggest an existing non-belt leopard group', () => {
  const result = suggestFbsProductGroups({
    vendorCode: 'туника с поясом леопард пятна',
    groups: ['туника леопард/пятна', 'с поясом леопард'],
    confirmedExamples: [
      { productName: 'туника леопард/пятна', vendorCode: 'парео леопард пятна' },
      { productName: 'с поясом леопард', vendorCode: 'парео пояс леопард пятна' },
    ],
  })
  assert.deepEqual(result.map((value) => value.productName), ['с поясом леопард'])
})

test('shortened leopard motif remains a review candidate behind an exact description', () => {
  const result = suggestFbsProductGroups({
    vendorCode: 'парео пояс леопард',
    groups: ['леопард пояс', 'леопард пятна пояс'],
    confirmedExamples: [
      { productName: 'леопард пояс', vendorCode: 'туника с поясом леопард' },
      { productName: 'леопард пятна пояс', vendorCode: 'туника с поясом леопард пятна' },
    ],
  })
  assert.deepEqual(result.map((value) => value.productName), ['леопард пояс', 'леопард пятна пояс'])
  assert.match(result[1].reason, /общие признаки: леопард/)
})

test('light green abbreviations normalize without replacing unrelated motifs', () => {
  const result = suggestFbsProductGroups({
    vendorCode: 'туника с поясом св.зеленая',
    groups: ['пояс светло-зеленая', 'пояс зеленый лист змея', 'пояс зеленая волна'],
    confirmedExamples: [
      { productName: 'пояс светло-зеленая', vendorCode: 'парео пояс светлозеленое' },
      { productName: 'пояс зеленый лист змея', vendorCode: 'парео пояс зелен. лист змея' },
      { productName: 'пояс зеленая волна', vendorCode: 'туника пояс зеленая волна' },
    ],
  })
  assert.deepEqual(result.map((value) => value.productName), ['пояс светло-зеленая'])
})

test('matching physical size ranks above unknown size and conflicting sizes are excluded', () => {
  const groups = ['леопард пояс 42-48', 'леопард пояс 50-56', 'леопард пояс размер неизвестен']
  const result = suggestFbsProductGroups({
    vendorCode: 'туника пояс леопард пятна', wbSize: '42–48',
    groups,
    confirmedExamples: groups.map((productName, index) => ({
      productName, vendorCode: 'парео пояс леопард пятна',
      wbSize: ['42-48', '50-56', null][index],
    })),
  })
  assert.deepEqual(result.map((value) => value.productName), [groups[0], groups[2]])
  assert.match(result[0].reason, /размер 42-48/)
})

test('internal tech size values do not claim a matching physical size', () => {
  const result = suggestFbsProductGroups({
    vendorCode: 'парео пояс леопард', techSize: '0',
    groups: ['леопард пояс'],
    confirmedExamples: [{ productName: 'леопард пояс', vendorCode: 'туника пояс леопард', techSize: '1' }],
  })
  assert.equal(result.length, 1)
  assert.doesNotMatch(result[0].reason, /; размер/)
})

test('suggestions are stable, unique, limited to three, and do not change inputs', () => {
  const groups = ['пояс леопард г', 'пояс леопард а', 'пояс леопард в', 'пояс леопард б', 'пояс леопард а']
  const examples = groups.map((productName) => ({ productName, vendorCode: 'парео пояс леопард' }))
  const original = JSON.stringify({ groups, examples })
  const first = suggestFbsProductGroups({ vendorCode: 'туника пояс леопард', groups, confirmedExamples: examples })
  const second = suggestFbsProductGroups({ vendorCode: 'туника пояс леопард', groups: [...groups].reverse(), confirmedExamples: [...examples].reverse() })
  assert.deepEqual(first, second)
  assert.equal(first.length, 3)
  assert.equal(new Set(first.map((value) => value.productName)).size, 3)
  assert.equal(JSON.stringify({ groups, examples }), original)
})

test('generic categories, unmatched descriptions and explicit no-belt articles yield no false suggestion', () => {
  assert.deepEqual(suggestFbsProductGroups({ vendorCode: 'парео', groups: ['туника синие волны'] }), [])
  assert.deepEqual(suggestFbsProductGroups({ vendorCode: null, groups: ['пояс синие разводы'] }), [])
  assert.deepEqual(suggestFbsProductGroups({ vendorCode: 'туника без пояса леопард', groups: ['пояс леопард'] }), [])
  assert.deepEqual(suggestFbsProductGroups({
    vendorCode: 'туника пояс леопард', groups: ['пояс леопард'],
    confirmedExamples: [{ productName: 'пояс леопард', vendorCode: 'туника без пояса леопард' }],
  }), [])
})

test('a reference-name fallback explicitly describes its evidence as a group name', () => {
  const result = suggestFbsProductGroups({ vendorCode: 'парео пояс синие разводы', groups: ['туника пояс синие разводы'] })
  assert.equal(result.length, 1)
  assert.equal(result[0].matchedVendorCode, '')
  assert.match(result[0].reason, /^Название группы:/)
})
