import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  batchUpdateSheetValues,
  copySheetRowPresentation,
  getSheetValues,
  getSpreadsheetMetadata,
} from '@/lib/google/sheets'
import { ensureFbsMovementSheetWorkflow } from '@/lib/automations/workflows'
import {
  FBS_CONTROL_HEADERS,
  FBS_OPERATIONS_FIRST_DATA_ROW,
  FBS_OPERATIONS_HEADERS,
  FBS_OPERATIONS_HEADER_ROW,
  FBS_SHEET_SOURCE,
  FBS_WB_STOCK_HEADERS,
  buildFbsDesiredEvents,
  buildFbsProductNameMap,
  buildFbsWbStockSnapshots,
  eventKindFromKey,
  fbsProductTupleKey,
  fbsWbStockSnapshotKey,
  moscowDateString,
  parseSheetDate,
  planFbsSheetUpsert,
  planFbsWbStockUpsert,
  reconcileFbsDay,
  sheetSerialDate,
  sheetSerialDateTime,
  validateFbsAccountTechnicalKey,
  validateHeaderRow,
  type FbsSheetDesiredEvent,
  type FbsSheetAccountIdentity,
  type FbsSheetExistingRow,
  type FbsWbStockSnapshot,
} from '@/lib/automations/fbs-sheet'
import { AUTOMATION_WORKFLOW_KINDS, type FbsMovementSheetConfig } from '@/types/automations'

const MOSCOW_TIMEZONE = 'Europe/Moscow'
const CONTROL_HEADER_ROW = 4
const CONTROL_FIRST_DATA_ROW = 5
const PRESENTATION_TEMPLATE_ROW = 1000
const WB_STOCK_MAX_AGE_MINUTES = 75
const WB_STOCK_MAX_AGE_MS = WB_STOCK_MAX_AGE_MINUTES * 60 * 1000

interface AccountLoadResult {
  wbAccountId: string
  accountName: string
  sheetName: string
  status: 'SUCCEEDED' | 'FAILED'
  orders: number
  cancellations: number
  acceptedReturns: number
  wbStockUnits: number
  rowsInserted: number
  rowsUpdated: number
  rowsUnchanged: number
  stockRowsInserted: number
  stockRowsUpdated: number
  stockRowsUnchanged: number
  error?: string
}

export interface FbsLocalStockWarning {
  productName: string
  physicalStock: number
  wbStock: number
  difference: number
  action: string
}

export interface FbsMovementSheetWorkflowResult {
  spreadsheetId: string
  targetDate: string
  dateFrom: string
  dateTo: string
  accountsProcessed: number
  accountsFailed: number
  rowsInserted: number
  rowsUpdated: number
  rowsUnchanged: number
  stockRowsInserted: number
  stockRowsUpdated: number
  stockRowsUnchanged: number
  wbStockUnits: number
  warningsCount: number
  warnings: FbsLocalStockWarning[]
  accounts: AccountLoadResult[]
  dryRun: boolean
}

interface PreparedAccount {
  wbAccountId: string
  accountName: string
  cabinetLabel: string
  technicalKey: string
  events: FbsSheetDesiredEvent[]
  stockSnapshots: FbsWbStockSnapshot[]
  ordersByDate: Map<string, number>
}

class FbsAccountPreparationError extends Error {
  ordersByDate: Map<string, number>

  constructor(message: string, ordersByDate: Map<string, number>) {
    super(message)
    this.name = 'FbsAccountPreparationError'
    this.ordersByDate = ordersByDate
  }
}

function quoteSheetName(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function normalize(value: unknown) {
  return String(value ?? '').trim()
}

function parseIsoDate(value: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name}: ожидается дата ГГГГ-ММ-ДД`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name}: некорректная дата`)
  }
  return date
}

function addDays(value: string, days: number) {
  const date = parseIsoDate(value, 'Дата')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function dateRange(startDate: string, endDate: string) {
  const values: string[] = []
  for (let value = startDate; value <= endDate; value = addDays(value, 1)) values.push(value)
  return values
}

function moscowBounds(startDate: string, endDate: string) {
  return {
    gte: new Date(`${startDate}T00:00:00+03:00`),
    lt: new Date(`${addDays(endDate, 1)}T00:00:00+03:00`),
  }
}

function previousMoscowDate(now = new Date()) {
  return addDays(moscowDateString(now), -1)
}

function configFromWorkflow(value: Prisma.JsonValue): FbsMovementSheetConfig {
  const config = value as unknown as Partial<FbsMovementSheetConfig>
  if (!config.spreadsheetId || !config.operationsSheetName || !config.controlSheetName || !config.wbStockSheetName || !config.startDate) {
    throw new Error('Настройки FBS-автоматизации заполнены не полностью')
  }
  return config as FbsMovementSheetConfig
}

function validateFormulaSentinel(values: unknown[][], config: FbsMovementSheetConfig) {
  const formula = normalize(values[0]?.[0])
  if (!formula.startsWith('=') || !formula.includes(config.operationsSheetName) || !formula.includes('Приход')) {
    throw new Error(`${config.summarySheetName}!C14 должна содержать формулу прихода; загрузка остановлена`)
  }
}

function validateSpreadsheetContract(params: {
  metadata: Awaited<ReturnType<typeof getSpreadsheetMetadata>>
  config: FbsMovementSheetConfig
}) {
  if (params.metadata.properties?.timeZone !== MOSCOW_TIMEZONE) {
    throw new Error(`Часовой пояс таблицы должен быть ${MOSCOW_TIMEZONE}`)
  }
  const titles = new Set(params.metadata.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean))
  for (const title of [
    params.config.operationsSheetName,
    params.config.controlSheetName,
    params.config.summarySheetName,
    params.config.referenceSheetName,
    params.config.wbStockSheetName,
  ]) {
    if (!titles.has(title)) throw new Error(`В Google Sheet нет вкладки «${title}»`)
  }
}

function sheetIdByTitle(
  metadata: Awaited<ReturnType<typeof getSpreadsheetMetadata>>,
  title: string,
) {
  const sheetId = metadata.sheets?.find((sheet) => sheet.properties?.title === title)?.properties?.sheetId
  if (sheetId == null) throw new Error(`Не найден sheetId вкладки «${title}»`)
  return sheetId
}

function rowsFromValues(values: unknown[][], firstRowNumber: number): FbsSheetExistingRow[] {
  return values.map((row, index) => ({ rowNumber: firstRowNumber + index, values: row }))
}

function accountKeyMap(config: FbsMovementSheetConfig) {
  return new Map(Object.entries(config.accountKeys ?? {}))
}

function syncPeriodDateTo(result: Prisma.JsonValue | null): string | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null
  const period = (result as { period?: unknown }).period
  if (!period || typeof period !== 'object' || Array.isArray(period)) return null
  const value = (period as { dateTo?: unknown }).dateTo
  return typeof value === 'string' ? value : null
}

async function assertFbsDataFreshness(wbAccountId: string, targetDate: string) {
  const latest = await prisma.syncJobRun.findFirst({
    where: { wbAccountId, kind: 'FBS_OPERATIONAL', status: 'SUCCEEDED' },
    select: { result: true, finishedAt: true },
    orderBy: { finishedAt: 'desc' },
  })
  const coveredTo = syncPeriodDateTo(latest?.result ?? null)
  if (!latest?.finishedAt || !coveredTo || coveredTo < targetDate) {
    throw new Error(`Нет успешной локальной FBS-синхронизации, покрывающей ${targetDate}`)
  }
}

async function loadAccountWbStock(params: {
  account: FbsSheetAccountIdentity
  productNames: Map<string, string>
  allowedProductNames: string[]
  existingStockKeys: Set<string>
  now: Date
}) {
  const items = await prisma.fbsAssortmentItem.findMany({
    where: {
      wbAccountId: params.account.wbAccountId,
      warehouse: { isEnabled: true },
    },
    select: {
      nmId: true,
      chrtId: true,
      barcode: true,
      vendorCode: true,
      wbStock: true,
      wbStockSyncedAt: true,
    },
    orderBy: [{ nmId: 'asc' }, { chrtId: 'asc' }],
  })
  const relevant = items.filter((item) => item.wbStock > 0 || params.existingStockKeys.has(
    fbsWbStockSnapshotKey(params.account.technicalKey, item.nmId, item.chrtId),
  ))
  const missingTimestamp = relevant.find((item) => !item.wbStockSyncedAt)
  if (missingTimestamp) {
    throw new Error(`Нет времени сверки остатка WB для nmId ${missingTimestamp.nmId}, chrtId ${missingTimestamp.chrtId}`)
  }
  const stale = relevant.find((item) => (
    item.wbStockSyncedAt
    && params.now.getTime() - item.wbStockSyncedAt.getTime() > WB_STOCK_MAX_AGE_MS
  ))
  if (stale) {
    throw new Error(`Остаток WB устарел: перед загрузкой нужна успешная сверка FBS-остатков не старше ${WB_STOCK_MAX_AGE_MINUTES} минут`)
  }
  return buildFbsWbStockSnapshots({
    account: params.account,
    productNames: params.productNames,
    allowedProductNames: params.allowedProductNames,
    stocks: relevant.map((item) => ({
      ...item,
      wbStockSyncedAt: item.wbStockSyncedAt as Date,
    })),
  })
}

async function loadAccountData(params: {
  wbAccountId: string
  accountName: string
  cabinetLabel: string
  technicalKey: string
  startDate: string
  targetDate: string
  productNames: Map<string, string>
  allowedProductNames: string[]
  existingStockKeys: Set<string>
  now: Date
}): Promise<PreparedAccount> {
  const bounds = moscowBounds(params.startDate, params.targetDate)
  const [orders, returns] = await Promise.all([
    prisma.fbsOrder.findMany({
      where: { wbAccountId: params.wbAccountId, createdAtWb: bounds },
      select: {
        id: true, externalOrderId: true, nmId: true, chrtId: true, vendorCode: true,
        createdAtWb: true, supplierStatus: true, wbStatus: true, shipmentApplied: true,
      },
      orderBy: [{ createdAtWb: 'asc' }, { externalOrderId: 'asc' }],
    }),
    prisma.fbsInventoryMovement.findMany({
      where: {
        type: 'RETURN_RECEIVED', occurredAt: { lt: bounds.lt },
        order: { wbAccountId: params.wbAccountId },
      },
      select: {
        id: true, occurredAt: true,
        order: { select: { externalOrderId: true, nmId: true, chrtId: true, vendorCode: true, supplierStatus: true, wbStatus: true } },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    }),
  ])
  const ordersByDate = new Map<string, number>()
  for (const order of orders) {
    const date = moscowDateString(order.createdAtWb)
    ordersByDate.set(date, (ordersByDate.get(date) ?? 0) + 1)
  }

  let events: FbsSheetDesiredEvent[]
  let stockSnapshots: FbsWbStockSnapshot[]
  try {
    await assertFbsDataFreshness(params.wbAccountId, params.targetDate)
    const account = {
      wbAccountId: params.wbAccountId,
      accountName: params.accountName,
      cabinetLabel: params.cabinetLabel,
      technicalKey: params.technicalKey,
    }
    events = buildFbsDesiredEvents({
      account,
      productNames: params.productNames,
      allowedProductNames: params.allowedProductNames,
      orders: orders.map((order) => ({
        ...order,
        externalOrderId: order.externalOrderId.toString(),
      })),
      acceptedReturns: returns.flatMap((movement) => movement.order ? [{
        id: movement.id,
        occurredAt: movement.occurredAt,
        externalOrderId: movement.order.externalOrderId.toString(),
        nmId: movement.order.nmId,
        chrtId: movement.order.chrtId,
        vendorCode: movement.order.vendorCode,
        supplierStatus: movement.order.supplierStatus,
        wbStatus: movement.order.wbStatus,
      }] : []),
    })
    stockSnapshots = await loadAccountWbStock({
      account,
      productNames: params.productNames,
      allowedProductNames: params.allowedProductNames,
      existingStockKeys: params.existingStockKeys,
      now: params.now,
    })
  } catch (error) {
    throw new FbsAccountPreparationError(
      error instanceof Error ? error.message : 'Неизвестная ошибка подготовки данных',
      ordersByDate,
    )
  }

  return {
    wbAccountId: params.wbAccountId,
    accountName: params.accountName,
    cabinetLabel: params.cabinetLabel,
    technicalKey: params.technicalKey,
    events,
    stockSnapshots,
    ordersByDate,
  }
}

function writeRanges(sheetName: string, writes: Array<{ rowNumber: number; values: unknown[] }>) {
  const prefix = quoteSheetName(sheetName)
  return writes.map((write) => ({
    range: `${prefix}!A${write.rowNumber}:M${write.rowNumber}`,
    values: [write.values],
  }))
}

function wbStockWriteRanges(sheetName: string, writes: Array<{ rowNumber: number; values: unknown[] }>) {
  const prefix = quoteSheetName(sheetName)
  return writes.map((write) => ({
    range: `${prefix}!A${write.rowNumber}:I${write.rowNumber}`,
    values: [write.values],
  }))
}

function mergeWbStockProductNames(
  productNames: Map<string, string>,
  rows: FbsSheetExistingRow[],
) {
  for (const row of rows) {
    const productName = normalize(row.values[0])
    const accountKey = normalize(row.values[7])
    const nmId = Number(row.values[4])
    const chrtId = Number(row.values[5])
    if (!productName || !accountKey || !Number.isInteger(nmId) || !Number.isInteger(chrtId)) continue
    const key = fbsProductTupleKey(accountKey, nmId, chrtId)
    const existing = productNames.get(key)
    if (existing && existing !== productName) {
      throw new Error(`Разные названия товара для ${accountKey}, nmId ${nmId}, chrtId ${chrtId}`)
    }
    productNames.set(key, productName)
  }
}

function summaryStockColumnIndex(header: unknown[], cabinetLabel: string) {
  const owner = cabinetLabel.split('/')[0]?.trim().toLowerCase() ?? ''
  const index = header.findIndex((value) => {
    const text = normalize(value).toLowerCase().replace(/\s+/g, ' ')
    return text.includes('остаток wb') && text.includes(owner)
  })
  if (index < 0) throw new Error(`В сводке нет столбца «Остаток WB» для ${cabinetLabel}`)
  return index
}

function validateSummaryStockFormulas(params: {
  values: unknown[][]
  config: FbsMovementSheetConfig
  accounts: Array<{ cabinetLabel: string; technicalKey: string }>
}) {
  const header = params.values[0] ?? []
  const firstDataRow = params.values[1] ?? []
  for (const account of params.accounts) {
    const column = summaryStockColumnIndex(header, account.cabinetLabel)
    const formula = normalize(firstDataRow[column])
    if (!formula.startsWith('=') || !formula.includes(params.config.wbStockSheetName) || !formula.includes(account.technicalKey)) {
      throw new Error(`Формула остатка WB для ${account.cabinetLabel} должна ссылаться на вкладку «${params.config.wbStockSheetName}» и ключ ${account.technicalKey}`)
    }
  }
}

function verifySummaryWbStock(params: {
  values: unknown[][]
  accounts: PreparedAccount[]
}) {
  const header = params.values[0] ?? []
  const summaryRows = params.values.slice(1).filter((row) => normalize(row[0]))
  const mismatches: string[] = []
  const expectedTotalByProduct = new Map<string, number>()
  let wbStockUnits = 0
  for (const account of params.accounts) {
    const column = summaryStockColumnIndex(header, account.cabinetLabel)
    const expectedByProduct = new Map<string, number>()
    for (const snapshot of account.stockSnapshots) {
      expectedByProduct.set(snapshot.productName, (expectedByProduct.get(snapshot.productName) ?? 0) + snapshot.wbStock)
      expectedTotalByProduct.set(snapshot.productName, (expectedTotalByProduct.get(snapshot.productName) ?? 0) + snapshot.wbStock)
      wbStockUnits += snapshot.wbStock
    }
    for (const row of summaryRows) {
      const productName = normalize(row[0])
      const expected = expectedByProduct.get(productName) ?? 0
      const actual = Number(row[column] ?? 0)
      if (!Number.isFinite(actual) || actual !== expected) {
        mismatches.push(`${account.cabinetLabel}: ${productName} ${actual}/${expected}`)
      }
    }
  }
  if (mismatches.length) {
    throw new Error(`Остаток WB в сводке не совпал с NimbaOS: ${mismatches.slice(0, 8).join('; ')}`)
  }
  const physicalColumn = header.findIndex((value) => normalize(value).toLowerCase().replace(/\s+/g, ' ').includes('физический остаток'))
  if (physicalColumn < 0) throw new Error('В сводке нет столбца «Физический остаток»')
  const warnings: FbsLocalStockWarning[] = []
  for (const row of summaryRows) {
    const productName = normalize(row[0])
    const physicalStock = Number(row[physicalColumn] ?? 0)
    const wbStock = expectedTotalByProduct.get(productName) ?? 0
    if (!Number.isFinite(physicalStock)) {
      throw new Error(`Некорректный физический остаток в сводке: ${productName}`)
    }
    const difference = physicalStock - wbStock
    if (difference >= 0) continue
    warnings.push({
      productName,
      physicalStock,
      wbStock,
      difference,
      action: `Внести локальное пополнение +${Math.abs(difference)}`,
    })
  }
  return { wbStockUnits, warnings }
}

function countSheetEvents(params: {
  rows: FbsSheetExistingRow[]
  accountKey: string
  eventDate: string
}) {
  const counts = { order: 0, cancellation: 0, 'accepted-return': 0 }
  for (const row of params.rows) {
    if (normalize(row.values[9]) !== FBS_SHEET_SOURCE) continue
    const key = normalize(row.values[10])
    if (!key.includes(`:${params.accountKey}:`)) continue
    if (parseSheetDate(row.values[0]) !== params.eventDate) continue
    const kind = eventKindFromKey(key)
    if (kind) counts[kind] += 1
  }
  return counts
}

function planControlWrites(params: {
  existingValues: unknown[][]
  preparedAccounts: PreparedAccount[]
  failedAccounts: Map<string, string>
  startDate: string
  targetDate: string
  operationRows: FbsSheetExistingRow[]
  loadedAt: Date
  reconciliationWarnings: FbsLocalStockWarning[]
}) {
  validateHeaderRow(params.existingValues[0] ?? [], FBS_CONTROL_HEADERS, 'Контроль загрузки')
  const rows = rowsFromValues(params.existingValues.slice(1), CONTROL_FIRST_DATA_ROW)
  const existing = new Map<string, FbsSheetExistingRow>()
  let lastUsed = CONTROL_HEADER_ROW
  for (const row of rows) {
    if (row.values.some((value) => normalize(value))) lastUsed = Math.max(lastUsed, row.rowNumber)
    const date = parseSheetDate(row.values[0])
    const cabinet = normalize(row.values[1])
    if (!date || !cabinet) continue
    const key = `${date}\u0000${cabinet}`
    if (existing.has(key)) throw new Error(`Контроль загрузки: дубль для ${date}, ${cabinet}`)
    existing.set(key, row)
  }

  const writes: Array<{ rowNumber: number; values: unknown[] }> = []
  for (const account of params.preparedAccounts) {
    for (const date of dateRange(params.startDate, params.targetDate)) {
      const expected = account.ordersByDate.get(date) ?? 0
      const actual = countSheetEvents({ rows: params.operationRows, accountKey: account.technicalKey, eventDate: date })
      const desiredForDate = account.events.filter((event) => event.eventDate === date)
      const expectedCancellations = desiredForDate.filter((event) => event.kind === 'cancellation').length
      const expectedReturns = desiredForDate.filter((event) => event.kind === 'accepted-return').length
      const error = params.failedAccounts.get(account.wbAccountId)
      const reconciliation = reconcileFbsDay({
        order: expected,
        cancellation: expectedCancellations,
        'accepted-return': expectedReturns,
      }, actual)
      const status = !error && reconciliation.exact ? 'Успешно' : 'Ошибка'
      const skipped = reconciliation.skippedOrders
      const stockComment = date === params.targetDate
        ? `; Остаток WB: ${account.stockSnapshots.reduce((sum, snapshot) => sum + snapshot.wbStock, 0)} ед., сверено с NimbaOS; предупреждений локального учета: ${params.reconciliationWarnings.length}`
        : ''
      const comment = error
        ? error
        : `${reconciliation.comment}${stockComment}`
      const values = [
        sheetSerialDate(date), account.cabinetLabel, expected, actual.order, skipped,
        status, sheetSerialDateTime(params.loadedAt), comment,
      ]
      const key = `${date}\u0000${account.cabinetLabel}`
      const current = existing.get(key)
      if (current) writes.push({ rowNumber: current.rowNumber, values })
      else {
        lastUsed += 1
        writes.push({ rowNumber: lastUsed, values })
      }
    }
  }
  return writes
}

async function verifyControlRows(params: {
  spreadsheetId: string
  controlSheetName: string
  expectedWrites: Array<{ rowNumber: number; values: unknown[] }>
}) {
  if (!params.expectedWrites.length) return
  const maxRow = Math.max(...params.expectedWrites.map((row) => row.rowNumber))
  const values = await getSheetValues(
    params.spreadsheetId,
    `${quoteSheetName(params.controlSheetName)}!A${CONTROL_FIRST_DATA_ROW}:H${maxRow}`,
    'UNFORMATTED_VALUE',
  )
  const byRow = new Map(rowsFromValues(values, CONTROL_FIRST_DATA_ROW).map((row) => [row.rowNumber, row.values]))
  for (const expected of params.expectedWrites) {
    const actual = byRow.get(expected.rowNumber) ?? []
    for (let index = 0; index < 6; index++) {
      if (normalize(actual[index]) !== normalize(expected.values[index])) {
        throw new Error(`Контроль загрузки: проверка записи не пройдена, строка ${expected.rowNumber}`)
      }
    }
  }
}

export async function runFbsMovementSheetWorkflow(
  options: { targetDate?: string; dryRun?: boolean } = {},
): Promise<FbsMovementSheetWorkflowResult> {
  const ensured = await ensureFbsMovementSheetWorkflow()
  const workflow = await prisma.automationWorkflowSetting.findUniqueOrThrow({
    where: { id: ensured.id },
    include: {
      accounts: {
        where: { enabled: true },
        include: { wbAccount: { select: { id: true, name: true, isActive: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  const config = configFromWorkflow(workflow.config)
  const targetDate = options.targetDate ?? previousMoscowDate()
  parseIsoDate(targetDate, 'Дата загрузки')
  parseIsoDate(config.startDate, 'Дата начала')
  if (targetDate < config.startDate) throw new Error(`Дата загрузки раньше ${config.startDate}`)
  if (targetDate > previousMoscowDate()) throw new Error('Можно загружать только завершившиеся московские дни')
  const loadedAt = new Date()

  const metadata = await getSpreadsheetMetadata(config.spreadsheetId)
  validateSpreadsheetContract({ metadata, config })
  const operationsPrefix = quoteSheetName(config.operationsSheetName)
  const wbStockPrefix = quoteSheetName(config.wbStockSheetName)
  const [operationValues, controlValues, formulaValues, referenceProductValues, wbStockValues, summaryFormulaValues] = await Promise.all([
    getSheetValues(config.spreadsheetId, `${operationsPrefix}!A${FBS_OPERATIONS_HEADER_ROW}:M`, 'UNFORMATTED_VALUE'),
    getSheetValues(config.spreadsheetId, `${quoteSheetName(config.controlSheetName)}!A${CONTROL_HEADER_ROW}:H`, 'UNFORMATTED_VALUE'),
    getSheetValues(config.spreadsheetId, `${quoteSheetName(config.summarySheetName)}!C14`, 'FORMULA'),
    getSheetValues(config.spreadsheetId, `${quoteSheetName(config.referenceSheetName)}!A4:A`, 'UNFORMATTED_VALUE'),
    getSheetValues(config.spreadsheetId, `${wbStockPrefix}!A1:I`, 'UNFORMATTED_VALUE'),
    getSheetValues(config.spreadsheetId, `${quoteSheetName(config.summarySheetName)}!A7:Z8`, 'FORMULA'),
  ])
  validateHeaderRow(operationValues[0] ?? [], FBS_OPERATIONS_HEADERS, 'Операции')
  validateHeaderRow(wbStockValues[0] ?? [], FBS_WB_STOCK_HEADERS, 'Остатки WB')
  validateFormulaSentinel(formulaValues, config)
  const existingRows = rowsFromValues(operationValues.slice(1), FBS_OPERATIONS_FIRST_DATA_ROW)
  const existingWbStockRows = rowsFromValues(wbStockValues.slice(1), 2)
  const productNames = buildFbsProductNameMap(existingRows)
  mergeWbStockProductNames(productNames, existingWbStockRows)
  const allowedProductNames = referenceProductValues.map((row) => normalize(row[0])).filter(Boolean)
  for (const [tuple, productName] of Object.entries(config.productAliases ?? {})) {
    if (!allowedProductNames.includes(productName)) {
      throw new Error(`Сопоставление ${tuple} указывает на отсутствующий товар «${productName}»`)
    }
    const parts = tuple.split(':')
    if (parts.length !== 3 || !Number.isInteger(Number(parts[1])) || !Number.isInteger(Number(parts[2]))) {
      throw new Error(`Некорректный ключ сопоставления товара: ${tuple}`)
    }
    productNames.set(fbsProductTupleKey(parts[0], Number(parts[1]), Number(parts[2])), productName)
  }
  const keys = accountKeyMap(config)
  const existingStockKeys = new Set(existingWbStockRows.map((row) => normalize(row.values[8])).filter(Boolean))
  const prepared: PreparedAccount[] = []
  const failedAccounts = new Map<string, string>()
  const formulaAccounts: Array<{ cabinetLabel: string; technicalKey: string }> = []

  for (const mapping of workflow.accounts) {
    if (!mapping.wbAccount.isActive) continue
    const technicalKey = validateFbsAccountTechnicalKey(keys.get(mapping.wbAccount.id) ?? '')
    formulaAccounts.push({ cabinetLabel: mapping.sheetName, technicalKey })
    try {
      prepared.push(await loadAccountData({
        wbAccountId: mapping.wbAccount.id,
        accountName: mapping.wbAccount.name,
        cabinetLabel: mapping.sheetName,
        technicalKey,
        startDate: config.startDate,
        targetDate,
        productNames,
        allowedProductNames,
        existingStockKeys,
        now: loadedAt,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка подготовки данных'
      failedAccounts.set(
        mapping.wbAccount.id,
        message,
      )
      prepared.push({
        wbAccountId: mapping.wbAccount.id,
        accountName: mapping.wbAccount.name,
        cabinetLabel: mapping.sheetName,
        technicalKey,
        events: [],
        stockSnapshots: [],
        ordersByDate: error instanceof FbsAccountPreparationError ? error.ordersByDate : new Map(),
      })
    }
  }
  validateSummaryStockFormulas({ values: summaryFormulaValues, config, accounts: formulaAccounts })

  if (failedAccounts.size) {
    const details = prepared
      .filter((account) => failedAccounts.has(account.wbAccountId))
      .map((account) => `${account.accountName}: ${failedAccounts.get(account.wbAccountId)}`)
    throw new Error(`FBS-автоматизация остановлена до записи: ${details.join('; ')}`)
  }

  const desiredEvents = prepared.flatMap((account) => account.events)
  const desiredStockSnapshots = prepared.flatMap((account) => account.stockSnapshots)
  const plan = planFbsSheetUpsert({ existingRows, desiredEvents, loadedAt })
  const stockPlan = planFbsWbStockUpsert({
    existingRows: existingWbStockRows,
    desiredSnapshots: desiredStockSnapshots,
    activeAccountKeys: prepared
      .filter((account) => !failedAccounts.has(account.wbAccountId))
      .map((account) => account.technicalKey),
  })
  const insertedRows = plan.writes.filter((write) => write.mode === 'insert').map((write) => write.rowNumber)
  const firstBeyondTemplate = insertedRows.filter((row) => row > PRESENTATION_TEMPLATE_ROW)
  if (!options.dryRun && firstBeyondTemplate.length) {
    await copySheetRowPresentation({
      spreadsheetId: config.spreadsheetId,
      sheetId: sheetIdByTitle(metadata, config.operationsSheetName),
      sourceRowNumber: PRESENTATION_TEMPLATE_ROW,
      startRowNumber: Math.min(...firstBeyondTemplate),
      endRowNumber: Math.max(...firstBeyondTemplate),
    })
  }
  if (!options.dryRun) {
    await batchUpdateSheetValues(config.spreadsheetId, [
      ...writeRanges(config.operationsSheetName, plan.writes),
      ...wbStockWriteRanges(config.wbStockSheetName, stockPlan.writes),
    ])
  }

  const readbackRows = options.dryRun
    ? [
        ...existingRows.filter((row) => !normalize(row.values[10])),
        ...Array.from(plan.resultingRowsByKey.values()),
      ].sort((left, right) => left.rowNumber - right.rowNumber)
    : rowsFromValues(await getSheetValues(
        config.spreadsheetId,
        `${operationsPrefix}!A${FBS_OPERATIONS_FIRST_DATA_ROW}:M`,
        'UNFORMATTED_VALUE',
      ), FBS_OPERATIONS_FIRST_DATA_ROW)
  const verification = planFbsSheetUpsert({ existingRows: readbackRows, desiredEvents, loadedAt })
  if (verification.inserted || verification.updated) {
    throw new Error(`Проверка Google Sheet не пройдена: осталось записать ${verification.inserted + verification.updated} строк`)
  }

  const readbackWbStockRows = options.dryRun
    ? Array.from(stockPlan.resultingRowsByKey.values()).sort((left, right) => left.rowNumber - right.rowNumber)
    : rowsFromValues(await getSheetValues(
        config.spreadsheetId,
        `${wbStockPrefix}!A2:I`,
        'UNFORMATTED_VALUE',
      ), 2)
  const stockVerification = planFbsWbStockUpsert({
    existingRows: readbackWbStockRows,
    desiredSnapshots: desiredStockSnapshots,
    activeAccountKeys: prepared
      .filter((account) => !failedAccounts.has(account.wbAccountId))
      .map((account) => account.technicalKey),
  })
  if (stockVerification.inserted || stockVerification.updated) {
    throw new Error(`Проверка остатков WB не пройдена: осталось записать ${stockVerification.inserted + stockVerification.updated} строк`)
  }

  let wbStockUnits = desiredStockSnapshots.reduce((sum, snapshot) => sum + snapshot.wbStock, 0)
  let reconciliationWarnings: FbsLocalStockWarning[] = []
  if (!options.dryRun || stockPlan.writes.length === 0) {
    const summaryValues = await getSheetValues(
      config.spreadsheetId,
      `${quoteSheetName(config.summarySheetName)}!A7:Z`,
      'UNFORMATTED_VALUE',
    )
    const summaryVerification = verifySummaryWbStock({ values: summaryValues, accounts: prepared })
    wbStockUnits = summaryVerification.wbStockUnits
    reconciliationWarnings = summaryVerification.warnings
  }

  const controlWrites = planControlWrites({
    existingValues: controlValues,
    preparedAccounts: prepared,
    failedAccounts,
    startDate: config.startDate,
    targetDate,
    operationRows: readbackRows,
    loadedAt,
    reconciliationWarnings,
  })
  if (!options.dryRun) {
    await batchUpdateSheetValues(config.spreadsheetId, controlWrites.map((write) => ({
      range: `${quoteSheetName(config.controlSheetName)}!A${write.rowNumber}:H${write.rowNumber}`,
      values: [write.values],
    })))
    await verifyControlRows({
      spreadsheetId: config.spreadsheetId,
      controlSheetName: config.controlSheetName,
      expectedWrites: controlWrites,
    })
  }

  const results: AccountLoadResult[] = prepared.map((account) => {
    const error = failedAccounts.get(account.wbAccountId)
    const keysForAccount = new Set(account.events.map((event) => event.key))
    const stockKeysForAccount = new Set(account.stockSnapshots.map((snapshot) => snapshot.key))
    return {
      wbAccountId: account.wbAccountId,
      accountName: account.accountName,
      sheetName: config.operationsSheetName,
      status: error ? 'FAILED' : 'SUCCEEDED',
      orders: account.events.filter((event) => event.kind === 'order').length,
      cancellations: account.events.filter((event) => event.kind === 'cancellation').length,
      acceptedReturns: account.events.filter((event) => event.kind === 'accepted-return').length,
      wbStockUnits: account.stockSnapshots.reduce((sum, snapshot) => sum + snapshot.wbStock, 0),
      rowsInserted: plan.writes.filter((write) => write.mode === 'insert' && keysForAccount.has(write.key)).length,
      rowsUpdated: plan.writes.filter((write) => write.mode === 'update' && keysForAccount.has(write.key)).length,
      rowsUnchanged: account.events.filter((event) => !plan.writes.some((write) => write.key === event.key)).length,
      stockRowsInserted: stockPlan.writes.filter((write) => write.mode === 'insert' && stockKeysForAccount.has(write.key)).length,
      stockRowsUpdated: stockPlan.writes.filter((write) => write.mode === 'update' && stockKeysForAccount.has(write.key)).length,
      stockRowsUnchanged: account.stockSnapshots.filter((snapshot) => !stockPlan.writes.some((write) => write.key === snapshot.key)).length,
      ...(error ? { error } : {}),
    }
  })
  const accountsFailed = results.filter((result) => result.status === 'FAILED').length
  if (!options.dryRun && !accountsFailed) {
    await batchUpdateSheetValues(config.spreadsheetId, [{
      range: `${quoteSheetName(config.referenceSheetName)}!E12`,
      values: [[sheetSerialDate(targetDate)]],
    }])
    const lastSuccess = await getSheetValues(
      config.spreadsheetId,
      `${quoteSheetName(config.referenceSheetName)}!E12`,
      'UNFORMATTED_VALUE',
    )
    if (parseSheetDate(lastSuccess[0]?.[0]) !== targetDate) {
      throw new Error('Не удалось подтвердить дату последней успешной загрузки')
    }
  }

  return {
    spreadsheetId: config.spreadsheetId,
    targetDate,
    dateFrom: config.startDate,
    dateTo: targetDate,
    accountsProcessed: results.length,
    accountsFailed,
    rowsInserted: plan.inserted,
    rowsUpdated: plan.updated,
    rowsUnchanged: plan.unchanged,
    stockRowsInserted: stockPlan.inserted,
    stockRowsUpdated: stockPlan.updated,
    stockRowsUnchanged: stockPlan.unchanged,
    wbStockUnits,
    warningsCount: reconciliationWarnings.length,
    warnings: reconciliationWarnings,
    accounts: results,
    dryRun: Boolean(options.dryRun),
  }
}

export function previewFbsMovementSheetWorkflow(targetDate?: string) {
  return runFbsMovementSheetWorkflow({ targetDate, dryRun: true })
}

export function fbsMovementSheetPayload(targetDate?: string) {
  const target = targetDate ?? previousMoscowDate()
  return {
    kind: AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET,
    targetDate: target,
    dateTo: target,
  }
}
