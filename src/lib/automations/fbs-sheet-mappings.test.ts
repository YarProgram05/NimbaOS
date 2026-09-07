import assert from 'node:assert/strict'
import test from 'node:test'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { confirmFbsSheetMapping, getFbsSheetMappingReview } from '@/lib/services/fbs-sheet-mappings'
import { FBS_OPERATIONS_HEADERS, FBS_WB_STOCK_HEADERS } from './fbs-sheet'
import { FBS_DEFAULT_SHEET_TABS } from './sheet-template'

test('mapping review and confirmation preserve existing identities and save only explicit aliases', async (t) => {
  const stub = (target: unknown, method: string, replacement: unknown) => {
    const object = target as Record<string, unknown>
    const original = object[method]
    object[method] = replacement
    t.after(() => { object[method] = original })
  }
  let config = {
    spreadsheetId: 'test-sheet', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet/edit',
    startDate: '2026-09-01', accountKeys: { account: 'test-account' }, sheetTabs: FBS_DEFAULT_SHEET_TABS,
    productAliases: {} as Record<string, string>,
  }
  const workflow = () => ({ id: 'workflow', kind: 'FBS_MOVEMENT_SHEET', config, enabled: false,
    timeOfDay: '10:30', timezone: 'Europe/Moscow', lastAppliedAt: null, updatedAt: new Date('2026-09-07T00:00:00Z') })
  const accounts = [{ id: 'account', name: 'Test cabinet', isActive: true, sellerName: null }]
  const mappings = [{ id: 'mapping', workflowId: 'workflow', wbAccountId: 'account', enabled: true, sheetName: 'Test' }]
  stub(prisma.automationWorkflowSetting, 'upsert', async () => workflow())
  let switchSpreadsheetOnFinalRead = false
  stub(prisma.automationWorkflowSetting, 'findUniqueOrThrow', async () => {
    if (switchSpreadsheetOnFinalRead) {
      config = { ...config, spreadsheetId: 'different-sheet' }
      switchSpreadsheetOnFinalRead = false
    }
    return workflow()
  })
  stub(prisma.wbAccount, 'findMany', async () => accounts)
  stub(prisma.automationWorkflowAccount, 'upsert', async () => mappings[0])
  stub(prisma.automationWorkflowAccount, 'findMany', async () => mappings)
  stub(prisma.automationWorkflowAccount, 'findFirst', async () => mappings[0])
  const items = [
    { wbAccountId: 'account', nmId: 10, chrtId: 101, vendorCode: 'леопард старый', barcode: 'legacy', wbStock: 3,
      product: { title: 'Леопард' }, productSize: { wbSize: '42-48', techSize: '1' } },
    { wbAccountId: 'account', nmId: 20, chrtId: 201, vendorCode: 'туника с поясом леопард', barcode: 'new', wbStock: 4,
      product: { title: 'Леопард' }, productSize: { wbSize: '42-48', techSize: '1' } },
  ]
  stub(prisma.fbsAssortmentItem, 'findMany', async () => items)
  stub(prisma.fbsAssortmentItem, 'findFirst', async ({ where }: { where: { nmId: number; chrtId: number } }) =>
    items.find((item) => item.nmId === where.nmId && item.chrtId === where.chrtId) ?? null)
  let writes = 0
  let conflictOnce = false
  stub(prisma.automationWorkflowSetting, 'updateMany', async ({ where, data }: {
    where: { config: { equals: unknown }; updatedAt: Date }; data: { config: typeof config }
  }) => {
    assert.deepEqual(where.config.equals, config)
    assert.ok(where.updatedAt)
    if (conflictOnce) {
      config = { ...config, productAliases: { ...config.productAliases, 'test-account:90:901': 'Другой подтверждённый товар' } }
      conflictOnce = false
      return { count: 0 }
    }
    config = data.config
    writes++
    return { count: 1 }
  })
  let sheetUnavailable = false
  const fakeSheets = { spreadsheets: {
    get: async () => {
      if (sheetUnavailable) throw new Error('offline')
      return { data: { sheets: Object.values(FBS_DEFAULT_SHEET_TABS).map((title) => ({ properties: { title, gridProperties: { rowCount: 1000 } } })) } }
    },
    batchUpdate: async () => assert.fail('confirmation must not change Google Sheets'),
    values: {
      batchUpdate: async () => assert.fail('confirmation must not write spreadsheet values'),
      get: async ({ range }: { range: string }) => {
        assert.ok(!range.includes('5000'), 'all ranges must fit the actual 1000-row grid')
        if (range.includes('!A5:M1000')) return { data: { values: [FBS_OPERATIONS_HEADERS] } }
        if (range.includes('!A1:I1000')) return { data: { values: [FBS_WB_STOCK_HEADERS,
          ['Существующий леопард', 'Test', 3, 0, 10, 101, 'legacy', 'test-account', 'fbs-wb-stock:test-account:10:101'],
        ] } }
        if (range.includes('!A4:A153')) return { data: { values: [['Существующий леопард'], ['туника с поясом леопард/пятна']] } }
        throw new Error(`Unexpected read ${range}`)
      },
    },
  } }
  const previousCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from('{}').toString('base64')
  t.after(() => {
    if (previousCredentials === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = previousCredentials
  })
  stub(google, 'sheets', () => fakeSheets)

  const review = await getFbsSheetMappingReview()
  assert.equal(review.warning, null)
  assert.equal(review.pending.length, 1, 'legacy tuple already mapped in the Sheet must not require reconfirmation')
  assert.equal(review.pending[0].nmId, 20)
  assert.equal(review.pending[0].size, '42-48')
  assert.ok(review.groups.includes('Существующий леопард'))
  assert.equal(writes, 0, 'suggestions never save aliases')

  const choice = { wbAccountId: 'account', nmId: 20, chrtId: 201, productName: 'туника с поясом леопард/пятна', mode: 'existing' as const }
  await assert.rejects(() => confirmFbsSheetMapping({ ...choice, nmId: 10, chrtId: 101 }), /уже подтверждено другое/)
  await assert.rejects(() => confirmFbsSheetMapping({ ...choice, productName: 'Несуществующий товар' }), /существующую группу/)
  await assert.rejects(() => confirmFbsSheetMapping({ ...choice, wbAccountId: 'other' }), /Кабинет не подключён/)
  assert.equal(writes, 0)

  switchSpreadsheetOnFinalRead = true
  await assert.rejects(() => confirmFbsSheetMapping(choice), /Таблица или вкладки изменились/)
  assert.equal(writes, 0, 'a mapping reviewed in the old Sheet cannot be saved after a target change')
  config = { ...config, spreadsheetId: 'test-sheet' }

  conflictOnce = true
  await confirmFbsSheetMapping(choice)
  assert.equal(writes, 1)
  assert.equal(config.productAliases['test-account:20:201'], choice.productName)
  assert.equal(config.productAliases['test-account:90:901'], 'Другой подтверждённый товар', 'concurrent alias must survive retry')
  assert.equal(config.startDate, '2026-09-01')
  await confirmFbsSheetMapping(choice)
  assert.equal(writes, 1, 'same confirmation is idempotent')
  await assert.rejects(() => confirmFbsSheetMapping({ ...choice, productName: 'Другая группа', mode: 'new' }), /уже подтверждено другое/)
  assert.equal(writes, 1)

  sheetUnavailable = true
  const unavailable = await getFbsSheetMappingReview()
  assert.ok(unavailable.warning)
  assert.deepEqual(unavailable.pending, [])
  await assert.rejects(() => confirmFbsSheetMapping(choice), /offline/)
  assert.equal(writes, 1)
})
