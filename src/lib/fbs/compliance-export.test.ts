import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getKizComplianceExportDefinition,
  KIZ_COMPLIANCE_EXPORTS,
  toCrptUnitPriceRub,
} from './compliance-export'

test('withdrawal export contains only withdrawal task types', () => {
  assert.deepEqual(KIZ_COMPLIANCE_EXPORTS.WITHDRAWAL.taskTypes, [
    'WITHDRAWAL_REMOTE_SALE',
    'WITHDRAWAL_B2B',
  ])
  assert.equal(KIZ_COMPLIANCE_EXPORTS.WITHDRAWAL.includeUnitPrice, true)
})

test('return export contains only return-to-circulation tasks', () => {
  assert.deepEqual(KIZ_COMPLIANCE_EXPORTS.RETURN_TO_CIRCULATION.taskTypes, [
    'RETURN_TO_CIRCULATION',
  ])
  assert.equal(KIZ_COMPLIANCE_EXPORTS.RETURN_TO_CIRCULATION.includeUnitPrice, false)
})

test('CRPT withdrawal price converts WB hundredths to rubles without adding VAT', () => {
  assert.equal(toCrptUnitPriceRub(199336), 1993.36)
  assert.equal(toCrptUnitPriceRub(62200), 622)
})

test('CRPT withdrawal export rejects a missing or zero price', () => {
  assert.throws(() => toCrptUnitPriceRub(null), /отсутствует корректная цена/)
  assert.throws(() => toCrptUnitPriceRub(0), /отсутствует корректная цена/)
})

test('unknown KIZ export kind is rejected', () => {
  assert.throws(() => getKizComplianceExportDefinition('ALL'))
})
