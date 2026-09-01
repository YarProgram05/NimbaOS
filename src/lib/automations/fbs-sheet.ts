export const FBS_SHEET_SOURCE = 'NimbaOS'
export const FBS_OPERATIONS_HEADER_ROW = 5
export const FBS_OPERATIONS_FIRST_DATA_ROW = 6

export const FBS_OPERATIONS_HEADERS = [
  'Дата',
  'Товар',
  'Операция',
  'Количество',
  'Комментарий',
  'Кабинет',
  'ID заказа WB',
  'nmId',
  'chrtId',
  'Источник',
  'Ключ записи',
  'Статус заказа',
  'Загружено',
] as const

export const FBS_CONTROL_HEADERS = [
  'Дата данных',
  'Кабинет',
  'Заказов в NimbaOS',
  'Записано',
  'Пропущено',
  'Статус',
  'Запуск',
  'Комментарий',
] as const

export const FBS_WB_STOCK_HEADERS = [
  'Товар',
  'Кабинет',
  'Остаток WB',
  'Обновлено',
  'nmId',
  'chrtId',
  'barcode',
  'Технический кабинет',
  'Ключ записи',
] as const

export type FbsSheetEventKind = 'order' | 'cancellation' | 'accepted-return'

export interface FbsSheetAccountIdentity {
  wbAccountId: string
  accountName: string
  technicalKey: string
  cabinetLabel: string
}

export interface FbsSheetOrderRecord {
  id: string
  externalOrderId: string
  nmId: number
  chrtId: number
  vendorCode: string | null
  createdAtWb: Date
  supplierStatus: string
  wbStatus: string
  shipmentApplied: boolean
}

export interface FbsSheetAcceptedReturnRecord {
  id: string
  externalOrderId: string
  nmId: number
  chrtId: number
  occurredAt: Date
  supplierStatus: string
  wbStatus: string
  vendorCode?: string | null
}

export interface FbsWbStockRecord {
  nmId: number
  chrtId: number
  barcode: string
  vendorCode: string | null
  wbStock: number
  wbStockSyncedAt: Date
}

export interface FbsWbStockSnapshot {
  key: string
  accountKey: string
  cabinetLabel: string
  productName: string
  wbStock: number
  syncedAt: Date
  nmId: number
  chrtId: number
  barcode: string
}

export interface FbsSheetDesiredEvent {
  key: string
  kind: FbsSheetEventKind
  accountKey: string
  cabinetLabel: string
  eventDate: string
  productName: string
  operation: string
  quantity: number
  comment: string
  externalOrderId: string
  nmId: number
  chrtId: number
  status: string
}

export interface FbsSheetExistingRow {
  rowNumber: number
  values: unknown[]
}

export interface FbsSheetWrite {
  rowNumber: number
  key: string
  values: unknown[]
  mode: 'insert' | 'update'
}

export interface FbsSheetUpsertPlan {
  writes: FbsSheetWrite[]
  inserted: number
  updated: number
  unchanged: number
  resultingRowsByKey: Map<string, FbsSheetExistingRow>
}

export interface FbsWbStockUpsertPlan {
  writes: FbsSheetWrite[]
  inserted: number
  updated: number
  unchanged: number
  resultingRowsByKey: Map<string, FbsSheetExistingRow>
}

export interface FbsDayEventCounts {
  order: number
  cancellation: number
  'accepted-return': number
}

export function reconcileFbsDay(expected: FbsDayEventCounts, actual: FbsDayEventCounts) {
  const exact = expected.order === actual.order &&
    expected.cancellation === actual.cancellation &&
    expected['accepted-return'] === actual['accepted-return']
  return {
    exact,
    skippedOrders: Math.max(expected.order - actual.order, 0),
    comment: `Заказы ${actual.order}/${expected.order}; отмены ${actual.cancellation}/${expected.cancellation}; возвраты ${actual['accepted-return']}/${expected['accepted-return']}`,
  }
}

const PRE_HANDOFF_CANCELLATION_STATUSES = new Set(['canceled', 'declined_by_client'])
const POST_HANDOFF_RETURN_STATUSES = new Set(['canceled_by_client', 'defect'])

function normalize(value: unknown) {
  return String(value ?? '').trim()
}

function normalizedTechnicalKey(value: string) {
  return value.trim().toLowerCase()
}

function eventStatus(supplierStatus: string, wbStatus: string) {
  return `${supplierStatus} / ${wbStatus}`
}

function operationOwner(cabinetLabel: string) {
  return cabinetLabel.split('/')[0]?.trim() || cabinetLabel.trim()
}

export function validateFbsAccountTechnicalKey(value: string): string {
  const key = normalizedTechnicalKey(value)
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(key)) {
    throw new Error('Технический ключ кабинета: 2–41 символ, только латиница, цифры и дефис')
  }
  return key
}

export function fbsOrderEventKey(accountKey: string, externalOrderId: string) {
  return `fbs-order:${validateFbsAccountTechnicalKey(accountKey)}:${externalOrderId}`
}

export function fbsCancellationEventKey(accountKey: string, externalOrderId: string) {
  return `fbs-cancel:${validateFbsAccountTechnicalKey(accountKey)}:${externalOrderId}`
}

export function fbsAcceptedReturnEventKey(accountKey: string, movementId: string) {
  return `fbs-return-accepted:${validateFbsAccountTechnicalKey(accountKey)}:${movementId}`
}

export function fbsWbStockSnapshotKey(accountKey: string, nmId: number, chrtId: number) {
  return `fbs-wb-stock:${validateFbsAccountTechnicalKey(accountKey)}:${nmId}:${chrtId}`
}

export function isCanceledBeforeFbsHandoff(order: Pick<
  FbsSheetOrderRecord,
  'supplierStatus' | 'wbStatus' | 'shipmentApplied'
>) {
  if (POST_HANDOFF_RETURN_STATUSES.has(order.wbStatus)) return false
  return !order.shipmentApplied && (
    order.supplierStatus === 'cancel' || PRE_HANDOFF_CANCELLATION_STATUSES.has(order.wbStatus)
  )
}

export function moscowDateString(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  const year = read('year')
  const month = read('month')
  const day = read('day')
  if (!year || !month || !day) throw new Error('Не удалось определить московскую дату')
  return `${year}-${month}-${day}`
}

export function sheetSerialDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Некорректная дата: ${value}`)
  const [year, month, day] = value.split('-').map(Number)
  const epoch = Date.UTC(1899, 11, 30)
  return Math.round((Date.UTC(year, month - 1, day) - epoch) / 86_400_000)
}

export function sheetSerialDateTime(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(value)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const [year, month, day, hour, minute, second] = [
    read('year'), read('month'), read('day'), read('hour'), read('minute'), read('second'),
  ]
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    throw new Error('Не удалось определить московское время загрузки')
  }
  const epoch = Date.UTC(1899, 11, 30)
  const moscowWallTime = Date.UTC(year, month - 1, day, hour, minute, second, value.getUTCMilliseconds())
  return (moscowWallTime - epoch) / 86_400_000
}

export function parseSheetDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30)
    return new Date(epoch + Math.floor(value) * 86_400_000).toISOString().slice(0, 10)
  }
  const text = normalize(value)
  if (!text) return null
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const local = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`
  return null
}

export function fbsProductTupleKey(accountKey: string, nmId: number, chrtId: number) {
  return `${normalizedTechnicalKey(accountKey)}:${nmId}:${chrtId}`
}

function accountKeyFromEventKey(value: unknown): string | null {
  const match = normalize(value).match(/^fbs-(?:order|cancel|return-accepted):([a-z0-9-]+):/)
  return match?.[1] ?? null
}

export function buildFbsProductNameMap(rows: FbsSheetExistingRow[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const row of rows) {
    const values = row.values
    if (normalize(values[9]) !== FBS_SHEET_SOURCE) continue
    const accountKey = accountKeyFromEventKey(values[10])
    const productName = normalize(values[1])
    const nmId = Number(values[7])
    const chrtId = Number(values[8])
    if (!accountKey || !productName || !Number.isInteger(nmId) || !Number.isInteger(chrtId)) continue
    const key = fbsProductTupleKey(accountKey, nmId, chrtId)
    const existing = result.get(key)
    if (existing && existing !== productName) {
      throw new Error(`В таблице разные названия для ${accountKey}, nmId ${nmId}, chrtId ${chrtId}`)
    }
    result.set(key, productName)
  }
  return result
}

export function resolveFbsProductName(params: {
  productNames: Map<string, string>
  productAliases?: Map<string, string>
  accountKey: string
  nmId: number
  chrtId: number
  vendorCode?: string | null
  allowedProductNames?: string[]
}) {
  const tupleKey = fbsProductTupleKey(params.accountKey, params.nmId, params.chrtId)
  const alias = params.productAliases?.get(tupleKey)
  if (alias) return alias
  const value = params.productNames.get(tupleKey)

  const vendorCode = params.vendorCode?.trim() ?? ''
  const normalizedVendor = normalizeProductName(vendorCode)
  if (normalizedVendor && params.allowedProductNames?.length) {
    const exact = params.allowedProductNames.filter((name) => normalizeProductName(name) === normalizedVendor)
    if (exact.length === 1) return exact[0]
    const phrase = params.allowedProductNames.filter((name) => {
      const normalizedName = normalizeProductName(name)
      return normalizedName.startsWith(`${normalizedVendor} `) || normalizedName.includes(` ${normalizedVendor} `)
    })
    if (phrase.length === 1) return phrase[0]
    const withoutLeadingProductType = normalizedVendor.replace(/^парео /, '')
    if (withoutLeadingProductType !== normalizedVendor) {
      const shortenedExact = params.allowedProductNames.filter(
        (name) => normalizeProductName(name) === withoutLeadingProductType,
      )
      if (shortenedExact.length === 1) return shortenedExact[0]
    }
    if (value) return value
    const vendorTokens = productMatchTokens(normalizedVendor)
    const scored = params.allowedProductNames.map((name) => {
      const nameTokens = productMatchTokens(normalizeProductName(name))
      const overlap = vendorTokens.filter((token) => nameTokens.includes(token)).length
      const adjacentPairs = vendorTokens.slice(0, -1).filter((token, index) => {
        const first = nameTokens.indexOf(token)
        return first >= 0 && nameTokens[first + 1] === vendorTokens[index + 1]
      }).length
      const overlapScore = vendorTokens.length ? overlap / vendorTokens.length : 0
      const orderScore = vendorTokens.length > 1 ? adjacentPairs / (vendorTokens.length - 1) : 0
      return { name, overlapScore, score: overlapScore + orderScore * 0.25 }
    }).filter((candidate) => candidate.overlapScore >= 0.75)
    const bestScore = Math.max(0, ...scored.map((candidate) => candidate.score))
    const candidates = scored.filter((candidate) => candidate.score === bestScore).map((candidate) => candidate.name)
    if (candidates.length === 1) return candidates[0]
    if (candidates.length > 1) {
      throw new Error(
        `Неоднозначное название товара для ${params.accountKey}, nmId ${params.nmId}, chrtId ${params.chrtId}: ${candidates.join(', ')}`,
      )
    }
  }
  if (value) return value
  const vendor = vendorCode ? ` (${vendorCode})` : ''
  throw new Error(
    `Нет названия товара в таблице для ${params.accountKey}, nmId ${params.nmId}, chrtId ${params.chrtId}${vendor}`,
  )
}

function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/хлокок/g, 'хлопок')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function productMatchTokens(value: string) {
  return value.split(' ').filter(Boolean).map((token) => {
    for (const stem of ['бел', 'черн', 'желт', 'зелен', 'голуб', 'син', 'розов', 'оранж', 'малин', 'корот', 'длин']) {
      if (token.startsWith(stem)) return stem
    }
    return token.length > 4 ? token.slice(0, 4) : token
  })
}

export function buildFbsDesiredEvents(params: {
  account: FbsSheetAccountIdentity
  orders: FbsSheetOrderRecord[]
  acceptedReturns: FbsSheetAcceptedReturnRecord[]
  productNames: Map<string, string>
  productAliases?: Map<string, string>
  allowedProductNames?: string[]
}): FbsSheetDesiredEvent[] {
  const accountKey = validateFbsAccountTechnicalKey(params.account.technicalKey)
  const owner = operationOwner(params.account.cabinetLabel)
  const result: FbsSheetDesiredEvent[] = []
  const mappingErrors = new Set<string>()

  for (const order of params.orders) {
    let productName: string
    try {
      productName = resolveFbsProductName({
        productNames: params.productNames,
        productAliases: params.productAliases,
        accountKey,
        nmId: order.nmId,
        chrtId: order.chrtId,
        vendorCode: order.vendorCode,
        allowedProductNames: params.allowedProductNames,
      })
    } catch (error) {
      mappingErrors.add(error instanceof Error ? error.message : 'Не удалось определить товар')
      continue
    }
    const base = {
      accountKey,
      cabinetLabel: params.account.cabinetLabel,
      eventDate: moscowDateString(order.createdAtWb),
      productName,
      quantity: 1,
      externalOrderId: order.externalOrderId,
      nmId: order.nmId,
      chrtId: order.chrtId,
      status: eventStatus(order.supplierStatus, order.wbStatus),
    }
    result.push({
      ...base,
      key: fbsOrderEventKey(accountKey, order.externalOrderId),
      kind: 'order',
      operation: `Заказ ФБС — ${owner}`,
      comment: '',
    })
    if (isCanceledBeforeFbsHandoff(order)) {
      result.push({
        ...base,
        key: fbsCancellationEventKey(accountKey, order.externalOrderId),
        kind: 'cancellation',
        operation: `Отмена ФБС — ${owner}`,
        comment: 'Отмена до отгрузки по статусу NimbaOS',
      })
    }
  }

  for (const movement of params.acceptedReturns) {
    let productName: string
    try {
      productName = resolveFbsProductName({
        productNames: params.productNames,
        productAliases: params.productAliases,
        accountKey,
        nmId: movement.nmId,
        chrtId: movement.chrtId,
        vendorCode: movement.vendorCode,
        allowedProductNames: params.allowedProductNames,
      })
    } catch (error) {
      mappingErrors.add(error instanceof Error ? error.message : 'Не удалось определить товар возврата')
      continue
    }
    result.push({
      key: fbsAcceptedReturnEventKey(accountKey, movement.id),
      kind: 'accepted-return',
      accountKey,
      cabinetLabel: params.account.cabinetLabel,
      eventDate: moscowDateString(movement.occurredAt),
      productName,
      operation: `Возврат принят — ${owner}`,
      quantity: 1,
      comment: 'Фактический возврат принят в NimbaOS',
      externalOrderId: movement.externalOrderId,
      nmId: movement.nmId,
      chrtId: movement.chrtId,
      status: eventStatus(movement.supplierStatus, movement.wbStatus),
    })
  }

  if (mappingErrors.size) {
    throw new Error(`Не удалось сопоставить товары: ${Array.from(mappingErrors).join('; ')}`)
  }

  const seen = new Set<string>()
  for (const event of result) {
    if (seen.has(event.key)) throw new Error(`Дублирующийся ключ события из NimbaOS: ${event.key}`)
    seen.add(event.key)
  }
  return result
}

export function buildFbsWbStockSnapshots(params: {
  account: FbsSheetAccountIdentity
  stocks: FbsWbStockRecord[]
  productNames: Map<string, string>
  productAliases?: Map<string, string>
  allowedProductNames?: string[]
}): FbsWbStockSnapshot[] {
  const accountKey = validateFbsAccountTechnicalKey(params.account.technicalKey)
  const snapshots: FbsWbStockSnapshot[] = []
  const mappingErrors = new Set<string>()

  for (const stock of params.stocks) {
    if (!Number.isInteger(stock.wbStock) || stock.wbStock < 0) {
      throw new Error(`Некорректный остаток WB для ${accountKey}, nmId ${stock.nmId}, chrtId ${stock.chrtId}`)
    }
    try {
      snapshots.push({
        key: fbsWbStockSnapshotKey(accountKey, stock.nmId, stock.chrtId),
        accountKey,
        cabinetLabel: params.account.cabinetLabel,
        productName: resolveFbsProductName({
          productNames: params.productNames,
          productAliases: params.productAliases,
          accountKey,
          nmId: stock.nmId,
          chrtId: stock.chrtId,
          vendorCode: stock.vendorCode,
          allowedProductNames: params.allowedProductNames,
        }),
        wbStock: stock.wbStock,
        syncedAt: stock.wbStockSyncedAt,
        nmId: stock.nmId,
        chrtId: stock.chrtId,
        barcode: stock.barcode,
      })
    } catch (error) {
      mappingErrors.add(error instanceof Error ? error.message : 'Не удалось определить товар остатка WB')
    }
  }
  if (mappingErrors.size) {
    throw new Error(`Не удалось сопоставить остатки WB: ${Array.from(mappingErrors).join('; ')}`)
  }
  const seen = new Set<string>()
  for (const snapshot of snapshots) {
    if (seen.has(snapshot.key)) throw new Error(`Дублирующийся ключ остатка WB: ${snapshot.key}`)
    seen.add(snapshot.key)
  }
  return snapshots
}

function wbStockValues(snapshot: FbsWbStockSnapshot): unknown[] {
  return [
    snapshot.productName,
    snapshot.cabinetLabel,
    snapshot.wbStock,
    sheetSerialDateTime(snapshot.syncedAt),
    snapshot.nmId,
    snapshot.chrtId,
    snapshot.barcode,
    snapshot.accountKey,
    snapshot.key,
  ]
}

function rowsMatch(existing: unknown[], desired: unknown[], cells: number) {
  for (let index = 0; index < cells; index++) {
    if (comparableCell(existing[index]) !== comparableCell(desired[index])) return false
  }
  return true
}

export function planFbsWbStockUpsert(params: {
  existingRows: FbsSheetExistingRow[]
  desiredSnapshots: FbsWbStockSnapshot[]
  activeAccountKeys: string[]
}): FbsWbStockUpsertPlan {
  const activeAccountKeys = new Set(params.activeAccountKeys.map(normalizedTechnicalKey))
  const existingByKey = new Map<string, FbsSheetExistingRow>()
  let lastUsedRow = 1
  for (const row of params.existingRows) {
    if (row.values.some((value) => normalize(value))) lastUsedRow = Math.max(lastUsedRow, row.rowNumber)
    const key = normalize(row.values[8])
    if (!key) continue
    if (existingByKey.has(key)) throw new Error(`В снимке WB найден дублирующийся ключ: ${key}`)
    existingByKey.set(key, row)
  }

  const desiredKeys = new Set(params.desiredSnapshots.map((snapshot) => snapshot.key))
  const writes: FbsSheetWrite[] = []
  let inserted = 0
  let updated = 0
  let unchanged = 0
  for (const snapshot of params.desiredSnapshots) {
    const desired = wbStockValues(snapshot)
    const existing = existingByKey.get(snapshot.key)
    if (existing) {
      if (rowsMatch(existing.values, desired, FBS_WB_STOCK_HEADERS.length)) {
        unchanged += 1
        continue
      }
      writes.push({ rowNumber: existing.rowNumber, key: snapshot.key, values: desired, mode: 'update' })
      existingByKey.set(snapshot.key, { rowNumber: existing.rowNumber, values: desired })
      updated += 1
      continue
    }
    lastUsedRow += 1
    writes.push({ rowNumber: lastUsedRow, key: snapshot.key, values: desired, mode: 'insert' })
    existingByKey.set(snapshot.key, { rowNumber: lastUsedRow, values: desired })
    inserted += 1
  }

  for (const [key, row] of Array.from(existingByKey.entries())) {
    const match = key.match(/^fbs-wb-stock:([a-z0-9-]+):/)
    if (!match || !activeAccountKeys.has(match[1]) || desiredKeys.has(key)) continue
    const desired = [...row.values]
    desired[2] = 0
    if (rowsMatch(row.values, desired, FBS_WB_STOCK_HEADERS.length)) {
      unchanged += 1
      continue
    }
    writes.push({ rowNumber: row.rowNumber, key, values: desired, mode: 'update' })
    existingByKey.set(key, { rowNumber: row.rowNumber, values: desired })
    updated += 1
  }

  return { writes, inserted, updated, unchanged, resultingRowsByKey: existingByKey }
}

function eventValues(event: FbsSheetDesiredEvent, loadedAt: Date): unknown[] {
  return [
    sheetSerialDate(event.eventDate),
    event.productName,
    event.operation,
    event.quantity,
    event.comment,
    event.cabinetLabel,
    event.externalOrderId,
    event.nmId,
    event.chrtId,
    FBS_SHEET_SOURCE,
    event.key,
    event.status,
    sheetSerialDateTime(loadedAt),
  ]
}

function comparableCell(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  return String(value).trim()
}

function eventRowMatches(existing: unknown[], desired: unknown[]) {
  return rowsMatch(existing, desired, 12)
}

export function planFbsSheetUpsert(params: {
  existingRows: FbsSheetExistingRow[]
  desiredEvents: FbsSheetDesiredEvent[]
  loadedAt: Date
}): FbsSheetUpsertPlan {
  const existingByKey = new Map<string, FbsSheetExistingRow>()
  let lastUsedRow = FBS_OPERATIONS_HEADER_ROW
  for (const row of params.existingRows) {
    if (row.values.some((value) => normalize(value))) lastUsedRow = Math.max(lastUsedRow, row.rowNumber)
    const key = normalize(row.values[10])
    if (!key) continue
    if (existingByKey.has(key)) throw new Error(`В таблице найден дублирующийся ключ: ${key}`)
    existingByKey.set(key, row)
  }

  const writes: FbsSheetWrite[] = []
  let inserted = 0
  let updated = 0
  let unchanged = 0
  for (const event of params.desiredEvents) {
    const desired = eventValues(event, params.loadedAt)
    const existing = existingByKey.get(event.key)
    if (existing) {
      if (eventRowMatches(existing.values, desired)) {
        unchanged += 1
        continue
      }
      writes.push({ rowNumber: existing.rowNumber, key: event.key, values: desired, mode: 'update' })
      existingByKey.set(event.key, { rowNumber: existing.rowNumber, values: desired })
      updated += 1
      continue
    }
    lastUsedRow += 1
    const next = { rowNumber: lastUsedRow, values: desired }
    writes.push({ rowNumber: lastUsedRow, key: event.key, values: desired, mode: 'insert' })
    existingByKey.set(event.key, next)
    inserted += 1
  }

  return { writes, inserted, updated, unchanged, resultingRowsByKey: existingByKey }
}

export function validateHeaderRow(actual: unknown[], expected: readonly string[], context: string) {
  for (let index = 0; index < expected.length; index++) {
    if (normalize(actual[index]).toLowerCase() !== expected[index].toLowerCase()) {
      throw new Error(`${context}: в колонке ${index + 1} ожидается «${expected[index]}»`)
    }
  }
}

export function eventKindFromKey(value: unknown): FbsSheetEventKind | null {
  const key = normalize(value)
  if (key.startsWith('fbs-order:')) return 'order'
  if (key.startsWith('fbs-cancel:')) return 'cancellation'
  if (key.startsWith('fbs-return-accepted:')) return 'accepted-return'
  return null
}
