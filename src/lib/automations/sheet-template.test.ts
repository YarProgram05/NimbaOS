import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FBS_DEFAULT_SHEET_TABS,
  FBS_SHEET_ROLE_DEFINITIONS,
  FBS_SHEET_ROLES,
  getRequiredSheetTab,
  normalizeFbsSheetTabs,
  normalizeSheetTabs,
  validateSheetTabs,
} from './sheet-template'

test('sheet tab settings are stored by stable role instead of individual config fields', () => {
  assert.deepEqual(FBS_DEFAULT_SHEET_TABS, {
    [FBS_SHEET_ROLES.OPERATIONS]: 'Операции',
    [FBS_SHEET_ROLES.CONTROL]: 'Контроль загрузки',
    [FBS_SHEET_ROLES.SUMMARY]: 'Сводка',
    [FBS_SHEET_ROLES.REFERENCE]: 'Справочники',
    [FBS_SHEET_ROLES.WB_STOCK]: 'Остатки WB',
  })
})

test('configured sheet names override defaults and are trimmed', () => {
  const tabs = normalizeSheetTabs({
    [FBS_SHEET_ROLES.OPERATIONS]: ' Заказы и возвраты ',
  }, FBS_DEFAULT_SHEET_TABS)
  assert.equal(tabs[FBS_SHEET_ROLES.OPERATIONS], 'Заказы и возвраты')
  assert.equal(tabs[FBS_SHEET_ROLES.SUMMARY], 'Сводка')
})

test('legacy individual FBS fields are adapted without overriding new role mappings', () => {
  const tabs = normalizeFbsSheetTabs({
    operationsSheetName: 'Старые операции',
    summarySheetName: 'Старая сводка',
    sheetTabs: { [FBS_SHEET_ROLES.SUMMARY]: 'Новая сводка' },
  }, { withDefaults: false })
  assert.equal(tabs[FBS_SHEET_ROLES.OPERATIONS], 'Старые операции')
  assert.equal(tabs[FBS_SHEET_ROLES.SUMMARY], 'Новая сводка')
})

test('required role mappings reject missing and duplicate tabs', () => {
  assert.throws(
    () => validateSheetTabs({ ...FBS_DEFAULT_SHEET_TABS, [FBS_SHEET_ROLES.SUMMARY]: '' }, FBS_SHEET_ROLE_DEFINITIONS),
    /Итоговая сводка/,
  )
  assert.throws(
    () => validateSheetTabs({
      ...FBS_DEFAULT_SHEET_TABS,
      [FBS_SHEET_ROLES.SUMMARY]: 'Операции',
    }, FBS_SHEET_ROLE_DEFINITIONS),
    /назначена нескольким ролям/,
  )
})

test('runtime resolves a configured tab by semantic role', () => {
  assert.equal(
    getRequiredSheetTab({ sheetTabs: { [FBS_SHEET_ROLES.OPERATIONS]: 'Заказы 2026' } }, FBS_SHEET_ROLES.OPERATIONS),
    'Заказы 2026',
  )
  assert.throws(() => getRequiredSheetTab({ sheetTabs: {} }, FBS_SHEET_ROLES.OPERATIONS), /Не настроена вкладка/)
})
