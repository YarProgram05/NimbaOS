import assert from 'node:assert/strict'
import test from 'node:test'
import { google, type sheets_v4 } from 'googleapis'
import { prisma } from '@/lib/db'
import { runFbsMovementSheetWorkflow } from '@/lib/services/fbs-movement-sheet-workflow'
import { FBS_CONFIRMED_PRODUCT_GROUPS } from './fbs-product-aliases'
import { FBS_DEFAULT_SHEET_TABS, FBS_SHEET_ROLES } from './sheet-template'
import { FBS_FULFILLMENT_SUMMARY_TITLES } from './fbs-fulfillment-summary'
import { FBS_CONTROL_HEADERS, FBS_OPERATIONS_HEADERS, FBS_WB_STOCK_HEADERS, sheetSerialDate } from './fbs-sheet'

// Keep one client/harness: the production Sheets adapter caches its first client.
// Every database method and Google call used by this workflow is replaced here.
test('FBS workflow registers approved stock and cumulative metrics safely through retries', async (t) => {
  const stub = (target: unknown, method: string, replacement: unknown) => {
    const object = target as Record<string, unknown>
    const original = object[method]
    object[method] = replacement
    t.after(() => { object[method] = original })
  }
  const targetDate = '2026-09-06'
  const snapshotAt = new Date()
  const accountRows = ['nimba', 'galioni'].map((key) => ({
    sheetName: key === 'nimba' ? 'Гребнев / WB Nimba' : 'Галлиев / WB Galioni',
    wbAccount: { id: key, name: key, isActive: true },
  }))
  const config = {
    spreadsheetId: 'test-sheet', startDate: targetDate,
    sheetTabs: FBS_DEFAULT_SHEET_TABS, accountKeys: { nimba: 'nimba', galioni: 'galioni' },
    // Simulate a saved config predating the confirmed aliases, without migration.
    productAliases: {},
  }
  const workflow = { id: 'workflow', config, timeOfDay: '10:30', accounts: accountRows }
  stub(prisma.automationWorkflowSetting, 'upsert', async () => workflow)
  stub(prisma.automationWorkflowSetting, 'findUniqueOrThrow', async () => workflow)
  stub(prisma.wbAccount, 'findMany', async () => [])
  stub(prisma.fbsInventoryMovement, 'findMany', async () => [])
  stub(prisma.syncJobRun, 'findFirst', async () => ({ finishedAt: snapshotAt, result: { period: { dateTo: targetDate } } }))
  const oldSupply = {
    wbAccountId: 'nimba', externalId: 'july-supply', done: true, closedAt: new Date('2026-07-29T10:00:00Z'),
  }
  let cumulativeReads = 0
  stub(prisma.fbsOrder, 'findMany', async (query: {
    where: { wbAccountId: string | { in: string[] }; createdAtWb: { lt: Date; gte?: Date } }
    select: { events?: { where?: unknown } }
  }) => {
    if (typeof query.where.wbAccountId === 'string') {
      assert.equal(query.where.createdAtWb.gte?.toISOString(), '2026-09-05T21:00:00.000Z')
      return [] // All nine new stock listings have no orders or movements.
    }
    cumulativeReads++
    assert.deepEqual(query.where.wbAccountId.in, ['nimba', 'galioni'])
    assert.equal(query.where.createdAtWb.gte, undefined, 'incremental start must not truncate the metrics')
    assert.equal(query.where.createdAtWb.lt.toISOString(), '2026-09-06T21:00:00.000Z')
    assert.equal(query.select.events?.where, undefined, 'retain acceptance history before a later cancellation')
    return [{
      wbAccountId: 'nimba', externalOrderId: BigInt(123), createdAtWb: new Date('2026-07-28T10:00:00Z'),
      fetchedAt: new Date('2026-09-07T10:00:00Z'), supplierStatus: 'cancel', wbStatus: 'canceled',
      shipmentApplied: true, supply: oldSupply,
      events: [{ supplierStatus: 'complete', wbStatus: 'sorted', supplyExternalId: oldSupply.externalId,
        observedAt: new Date('2026-07-29T12:00:00Z') }],
    }]
  })
  stub(prisma.fbsSupply, 'findMany', async () => assert.fail('the current supply already covers this history'))
  let includeUnapproved = false
  stub(prisma.fbsAssortmentItem, 'findMany', async ({ where }: { where: { wbAccountId: string } }) => [
    ...FBS_CONFIRMED_PRODUCT_GROUPS.flatMap((group) => group.listings.filter((row) => row.accountKey === where.wbAccountId)
      .map((row) => ({ ...row, barcode: `0${row.chrtId}`, wbStock: [326715987, 1667899910].includes(row.chrtId) ? 8 : 10,
        wbStockSyncedAt: snapshotAt }))),
    ...(includeUnapproved && where.wbAccountId === 'galioni' ? [{
      nmId: 999, chrtId: 998, vendorCode: 'парео пояс леопард пятна', barcode: 'future', wbStock: 1, wbStockSyncedAt: snapshotAt,
    }] : []),
  ])

  const names = {
    operations: FBS_DEFAULT_SHEET_TABS[FBS_SHEET_ROLES.OPERATIONS],
    stock: FBS_DEFAULT_SHEET_TABS[FBS_SHEET_ROLES.WB_STOCK],
    control: FBS_DEFAULT_SHEET_TABS[FBS_SHEET_ROLES.CONTROL],
    reference: FBS_DEFAULT_SHEET_TABS[FBS_SHEET_ROLES.REFERENCE],
    summary: FBS_DEFAULT_SHEET_TABS[FBS_SHEET_ROLES.SUMMARY],
  }
  const titles = Object.values(FBS_DEFAULT_SHEET_TABS)
  const sheetId = (title: string) => titles.indexOf(title)
  const grid = new Map<string, Map<string, unknown>>()
  const key = (row: number, column: number) => `${row}:${column}`
  const cell = (title: string, row: number, column: number) => grid.get(title)?.get(key(row, column)) ?? ''
  const setCell = (title: string, row: number, column: number, value: unknown) => grid.get(title)!.set(key(row, column), value)
  const setRow = (title: string, row: number, values: readonly unknown[], column = 0) => values.forEach((value, index) => setCell(title, row, column + index, value))
  const manualRow = [sheetSerialDate('2026-07-28'), 'Существующий товар', 'Приход', 17, 'Ручное поступление']
  const historicalOrderRow = [sheetSerialDate('2026-07-28'), 'Существующий товар', 'Заказ', 1, '', accountRows[0].sheetName,
    '123', 11, 22, 'NimbaOS', 'fbs-order:nimba:123', 'complete / sorted', sheetSerialDate('2026-07-29')]
  const totalOrdersFormula = '=SUMIF(Операции!C:C;"Заказ";Операции!D:D)'
  const summaryHeader = Array.from({ length: 20 }, () => 'Столбец')
  summaryHeader[8] = 'Остаток WB Гребнев'
  summaryHeader[9] = 'Остаток WB Галлиев'
  summaryHeader[10] = 'Физический остаток'
  const resetGrid = () => {
    for (const title of titles) grid.set(title, new Map())
    setRow(names.operations, 5, FBS_OPERATIONS_HEADERS)
    setRow(names.operations, 6, manualRow)
    setRow(names.operations, 7, historicalOrderRow)
    setRow(names.control, 4, FBS_CONTROL_HEADERS)
    setRow(names.stock, 1, FBS_WB_STOCK_HEADERS)
    setCell(names.reference, 4, 0, 'Существующий товар')
    setCell(names.summary, 4, 6, 'Всего заказов, шт.')
    setCell(names.summary, 5, 6, totalOrdersFormula)
    setRow(names.summary, 7, summaryHeader)
    for (let row = 8; row <= 157; row++) {
      setRow(names.summary, row, [
        `=IF('Справочники'!A${row - 4}="";"";'Справочники'!A${row - 4})`,
        ...Array.from({ length: 19 }, (_, column) => column === 7 ? '=SUMIFS(\'Остатки WB\'!C:C;H:H;"nimba")'
          : column === 8 ? '=SUMIFS(\'Остатки WB\'!C:C;H:H;"galioni")' : '=SUM(Операции!D:D)'),
      ])
    }
    setCell(names.summary, 14, 2, '=SUMIFS(Операции!D:D;Операции!C:C;"Приход")')
  }
  resetGrid()
  const columnNumber = (letters: string) => Array.from(letters).reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1
  const parseRange = (range: string) => {
    const match = range.match(/^'([^']+)'!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/)
    assert.ok(match, `Unsupported mock range: ${range}`)
    const title = match[1]
    assert.ok(grid.has(title), `Unknown mock sheet: ${title}`)
    return { title, row: Number(match[3]), column: columnNumber(match[2]),
      endRow: match[4] ? Number(match[5]) || Math.max(...Array.from(grid.get(title)!.keys(), (value) => Number(value.split(':')[0]))) : Number(match[3]),
      endColumn: columnNumber(match[4] ?? match[2]) }
  }
  // Model only the template's reference projection and stock SUMIFS; formulas
  // themselves stay stored and are returned intact for every FORMULA read.
  const computedCell = (title: string, row: number, column: number) => {
    if (title !== names.summary || row < 8 || row > 157) return cell(title, row, column)
    const productName = cell(names.reference, row - 4, 0)
    if (!productName) return ''
    if (column === 0) return productName
    if (column === 8 || column === 9) {
      const account = column === 8 ? 'nimba' : 'galioni'
      return Array.from({ length: 30 }, (_, index) => index + 2).reduce((total, stockRow) => total + (
        cell(names.stock, stockRow, 0) === productName && cell(names.stock, stockRow, 7) === account
          ? Number(cell(names.stock, stockRow, 2)) : 0
      ), 0)
    }
    return column === 10 && productName === manualRow[1] ? 16 : 0
  }
  const readRange = (range: string, formula = false) => {
    const area = parseRange(range)
    const result = Array.from({ length: Math.max(0, area.endRow - area.row + 1) }, (_, offset) => {
      const row = Array.from({ length: area.endColumn - area.column + 1 }, (_, column) => (
        formula ? cell(area.title, area.row + offset, area.column + column) : computedCell(area.title, area.row + offset, area.column + column)
      ))
      while (row.at(-1) === '') row.pop()
      return row
    })
    while (result.at(-1)?.length === 0) result.pop()
    return result
  }
  const valueWrites: Array<{ range: string; values: unknown[][] }> = []
  const gridWrites: sheets_v4.Schema$Request[] = []
  let writesAllowed = false
  let failBeforeControl = false
  const clearWrites = () => { valueWrites.length = 0; gridWrites.length = 0 }
  const assertNoWrites = () => { assert.equal(valueWrites.length, 0); assert.equal(gridWrites.length, 0) }
  const fakeSheets = { spreadsheets: {
    get: async () => ({ data: { properties: { timeZone: 'Europe/Moscow' }, sheets: titles.map((title, id) => ({
      properties: { title, sheetId: id },
      // The existing total-orders block is merged; the adjacent K:L area is not.
      merges: title === names.summary ? [
        { sheetId: id, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 6, endColumnIndex: 10 },
        { sheetId: id, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 6, endColumnIndex: 10 },
      ] : [],
    })) } }),
    batchUpdate: async ({ requestBody }: { requestBody: { requests: sheets_v4.Schema$Request[] } }) => {
      assert.ok(writesAllowed, 'dryRun must never write a spreadsheet')
      for (const request of requestBody.requests) {
        gridWrites.push(structuredClone(request))
        if (request.updateDimensionProperties) {
          assert.deepEqual(request.updateDimensionProperties.range,
            { sheetId: sheetId(names.summary), dimension: 'ROWS', startIndex: 3, endIndex: 4 })
          continue
        }
        const update = request.updateCells
        assert.ok(update?.start && update.rows, 'unexpected request outside the bounded reference/metric write contract')
        const title = titles[update.start.sheetId!]
        for (const [rowIndex, row] of Array.from(update.rows.entries())) {
          for (const [columnIndex, value] of Array.from((row.values ?? []).entries())) {
            const rowNumber = update.start.rowIndex! + rowIndex + 1
            const column = update.start.columnIndex! + columnIndex
            assert.ok((title === names.reference && column === 0 && rowNumber >= 4 && rowNumber <= 153)
              || (title === names.summary && rowNumber >= 4 && rowNumber <= 6 && column >= 10 && column <= 11),
            'cell updates must never touch manual movements, totals, or Summary product formulas')
            assert.equal(value.userEnteredValue?.formulaValue, undefined)
            setCell(title, rowNumber, column, value.userEnteredValue?.stringValue ?? value.userEnteredValue?.numberValue ?? '')
          }
        }
      }
      return { data: {} }
    },
    values: {
      batchUpdate: async ({ requestBody }: { requestBody: { valueInputOption: string; data: Array<{ range: string; values: unknown[][] }> } }) => {
        assert.ok(writesAllowed, 'dryRun must never write values')
        assert.equal(requestBody.valueInputOption, 'RAW', 'preserve literal product names and zero-prefixed barcodes')
        for (const write of requestBody.data) {
          const area = parseRange(write.range)
          if (area.title === names.control && failBeforeControl) throw new Error('simulated crash before control write')
          assert.ok(area.title === names.stock || area.title === names.control
            || (area.title === names.reference && area.row === 12 && area.column === 4),
          'stock-only registration must not create operation rows')
          valueWrites.push(structuredClone(write))
          write.values.forEach((row, index) => setRow(area.title, area.row + index, row, area.column))
        }
        return { data: {} }
      },
      get: async ({ range, valueRenderOption }: { range: string; valueRenderOption: string }) => ({
        data: { values: readRange(range, valueRenderOption === 'FORMULA') },
      }),
    },
  } }
  const previousCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from('{}').toString('base64')
  t.after(() => {
    if (previousCredentials === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = previousCredentials
  })
  stub(google, 'sheets', () => fakeSheets)

  const run = (dryRun = false) => runFbsMovementSheetWorkflow({ targetDate, dryRun })
  const assertCumulativeMetric = (result: Awaited<ReturnType<typeof run>>) => {
    assert.equal(result.dateFrom, targetDate)
    assert.deepEqual(result.fulfillment, {
      dateFrom: '2026-07-28', dateTo: targetDate, asOf: '2026-09-06T20:59:59.999Z',
      status: 'EXACT', units: 1, lowerBound: 1, confirmedAcceptanceLowerBound: 1,
      unknownAcceptance: 0, sourceStatus: 'COMPLETE_LOCAL_HISTORY',
      unknown: 0, diagnostics: [], sourceDiagnostics: [],
    })
  }
  const assertPreserved = () => {
    assert.deepEqual(readRange(`'${names.operations}'!A6:M6`), [manualRow])
    assert.deepEqual(readRange(`'${names.operations}'!A7:M7`), [historicalOrderRow])
    assert.equal(cell(names.summary, 5, 6), totalOrdersFormula)
    assert.equal(cell(names.summary, 4, 6), 'Всего заказов, шт.')
    assert.equal(cell(names.summary, 8, 0), '=IF(\'Справочники\'!A4="";"";\'Справочники\'!A4)')
    assert.equal(cell(names.summary, 14, 2), '=SUMIFS(Операции!D:D;Операции!C:C;"Приход")')
  }

  await t.test('dry-run keeps all nine stocks and the full history without writes', async () => {
    const result = await run(true)
    assert.equal(result.productsRegistered.length, 5)
    assert.equal(result.stockRowsInserted, 9)
    assert.equal(result.rowsInserted, 0)
    assert.equal(result.wbStockUnits, 86)
    assert.equal(result.accountsFailed, 0)
    assertCumulativeMetric(result)
    assertNoWrites()
    assertPreserved()
  })

  writesAllowed = true
  await t.test('an unapproved future size fails before any write even outside dry-run', async () => {
    includeUnapproved = true
    try {
      await assert.rejects(() => run(), /Нужно подтвердить складское название товара.*999.*998/)
      assertNoWrites()
    } finally { includeUnapproved = false }
  })

  await t.test('occupied metric cells stop all reference, stock, control and metric writes', async () => {
    setCell(names.summary, 4, 10, '=1+1')
    try {
      await assert.rejects(() => run(), /K4:L6.*содержит неизвестные данные или формулы/)
      assertNoWrites()
    } finally { setCell(names.summary, 4, 10, '') }
  })

  await t.test('write run registers five names, nine keyed stocks and only the two separate metrics', async () => {
    const result = await run()
    assertCumulativeMetric(result)
    assert.equal(result.productsRegistered.length, 5)
    assert.equal(result.stockRowsInserted, 9)
    assert.equal(result.rowsInserted, 0)
    assert.equal(result.wbStockUnits, 86)
    const stocks = readRange(`'${names.stock}'!A2:I`)
    assert.equal(stocks.length, 9)
    assert.equal(new Set(stocks.map((row) => row[8])).size, 9)
    assert.equal(new Set(stocks.map((row) => row[0])).size, 5)
    assert.ok(stocks.every((row) => typeof row[6] === 'string' && row[6].startsWith('0')))
    assert.equal(readRange(`'${names.reference}'!A4:A153`).length, 6)
    assert.deepEqual(readRange(`'${names.summary}'!K4:L6`), [
      [...FBS_FULFILLMENT_SUMMARY_TITLES], [1, 'не менее 1'], ['Период, МСК', '28.07.2026–06.09.2026'],
    ])
    assert.equal(readRange(`'${names.control}'!A5:H`).length, 2)
    assert.equal(cell(names.reference, 12, 4), sheetSerialDate(targetDate))
    assert.equal(gridWrites.filter((request) => request.updateCells?.start?.sheetId === sheetId(names.reference)).length, 5)
    assert.equal(gridWrites.filter((request) => request.updateCells?.start?.sheetId === sheetId(names.summary)).length, 3)
    assertPreserved()
  })

  await t.test('successful retry writes no additional references, stocks or events', async () => {
    clearWrites()
    const result = await run()
    assertCumulativeMetric(result)
    assert.deepEqual(result.productsRegistered, [])
    assert.equal(result.stockRowsInserted, 0)
    assert.equal(result.stockRowsUpdated, 0)
    assert.equal(result.stockRowsUnchanged, 9)
    assert.equal(result.rowsInserted, 0)
    assert.equal(result.rowsUpdated, 0)
    assert.ok(valueWrites.every((write) => !write.range.startsWith(`'${names.stock}'!`)))
    assert.ok(gridWrites.every((request) => request.updateCells?.start?.sheetId !== sheetId(names.reference)))
    assert.equal(readRange(`'${names.stock}'!A2:I`).length, 9)
    assertPreserved()
  })

  await t.test('retry after a crash before control retains the completed names/stocks without duplicates', async () => {
    resetGrid()
    clearWrites()
    failBeforeControl = true
    try { await assert.rejects(() => run(), /simulated crash before control write/) }
    finally { failBeforeControl = false }
    assert.equal(readRange(`'${names.stock}'!A2:I`).length, 9)
    assert.equal(readRange(`'${names.reference}'!A4:A153`).length, 6)
    assert.deepEqual(readRange(`'${names.summary}'!K4:L6`), [])
    assert.equal(cell(names.reference, 12, 4), '', 'no success marker before all verification completes')
    clearWrites()
    const retry = await run()
    assertCumulativeMetric(retry)
    assert.deepEqual(retry.productsRegistered, [])
    assert.equal(retry.stockRowsInserted, 0)
    assert.equal(retry.stockRowsUpdated, 0)
    assert.equal(retry.stockRowsUnchanged, 9)
    assert.equal(retry.rowsInserted, 0)
    assert.ok(valueWrites.every((write) => !write.range.startsWith(`'${names.stock}'!`)))
    assert.ok(gridWrites.every((request) => request.updateCells?.start?.sheetId !== sheetId(names.reference)))
    assert.equal(cell(names.summary, 5, 10), 1)
    assert.equal(cell(names.summary, 5, 11), 'не менее 1')
    assertPreserved()
  })
  assert.ok(cumulativeReads >= 6)
})
