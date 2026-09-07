import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getFbsMovementSheetWorkflow } from '@/lib/automations/workflows'
import { FBS_CONFIRMED_PRODUCT_ALIASES } from '@/lib/automations/fbs-product-aliases'
import { suggestFbsProductGroups } from '@/lib/automations/fbs-mapping-suggestions'
import { buildFbsProductNameMap, fbsProductTupleKey, FBS_OPERATIONS_HEADERS, FBS_WB_STOCK_HEADERS } from '@/lib/automations/fbs-sheet'
import { FBS_SHEET_ROLES, normalizeFbsSheetTabs } from '@/lib/automations/sheet-template'
import { getSheetValues, getSpreadsheetMetadata } from '@/lib/google/sheets'
import type { FbsMovementSheetWorkflowRow } from '@/types/automations'
import type { ConfirmFbsSheetMappingInput, FbsSheetMappingReview, FbsSheetPendingMapping } from '@/types/fbs-sheet-mappings'

const text = (value: unknown) => String(value ?? '').trim()
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`
const MAX_MAPPING_ROWS = 50_000

async function readSheetIdentities(workflow: FbsMovementSheetWorkflowRow) {
  const metadata = await getSpreadsheetMetadata(workflow.config.spreadsheetId)
  const range = (role: string, firstRow: number, lastColumn: string, lastRow?: number) => {
    const name = workflow.config.sheetTabs[role]
    if (!name) throw new Error('Сначала настройте вкладки таблицы FBS')
    const rowCount = metadata.sheets?.find((sheet) => sheet.properties?.title === name)?.properties?.gridProperties?.rowCount
    if (!rowCount || rowCount < firstRow) throw new Error('Не найдена нужная вкладка таблицы FBS')
    if (!lastRow && rowCount > MAX_MAPPING_ROWS + firstRow) throw new Error('Таблица превышает диапазон проверки соответствий')
    return `${quote(name)}!A${firstRow}:${lastColumn}${Math.min(rowCount, lastRow ?? MAX_MAPPING_ROWS + firstRow)}`
  }
  const [operations, stocks, reference] = await Promise.all([
    getSheetValues(workflow.config.spreadsheetId, range(FBS_SHEET_ROLES.OPERATIONS, 5, 'M'), 'UNFORMATTED_VALUE'),
    getSheetValues(workflow.config.spreadsheetId, range(FBS_SHEET_ROLES.WB_STOCK, 1, 'I'), 'UNFORMATTED_VALUE'),
    getSheetValues(workflow.config.spreadsheetId, range(FBS_SHEET_ROLES.REFERENCE, 4, 'A', 153), 'UNFORMATTED_VALUE'),
  ])
  if (operations.length > MAX_MAPPING_ROWS || stocks.length > MAX_MAPPING_ROWS) {
    throw new Error('Слишком много строк для проверки соответствий; требуется расширить диапазон чтения')
  }
  for (const [values, headers] of [[operations, FBS_OPERATIONS_HEADERS], [stocks, FBS_WB_STOCK_HEADERS]] as const) {
    if (headers.some((header, index) => text(values[0]?.[index]) !== header)) {
      throw new Error('Заголовки таблицы FBS изменились; проверьте настройки вкладок')
    }
  }
  const names = buildFbsProductNameMap(operations.slice(1).map((values, index) => ({ rowNumber: index + 6, values })))
  for (const row of stocks.slice(1)) {
    const [name, accountKey, nmId, chrtId] = [text(row[0]), text(row[7]), Number(row[4]), Number(row[5])]
    if (!name || !accountKey || !Number.isSafeInteger(nmId) || !Number.isSafeInteger(chrtId)) continue
    const key = fbsProductTupleKey(String(accountKey), Number(nmId), Number(chrtId))
    const previous = names.get(key)
    if (previous && previous !== name) throw new Error(`В таблице разные названия для ${key}`)
    names.set(key, String(name))
  }
  const groups = Array.from(new Set([
    ...reference.map((row) => text(row[0])).filter(Boolean),
    ...Object.values(workflow.config.productAliases).map(text).filter(Boolean),
  ])).sort((left, right) => left.localeCompare(right, 'ru'))
  return { names, groups }
}

function relevantAssortmentWhere(accountIds: string[], now = new Date()) {
  return {
    wbAccountId: { in: accountIds },
    warehouse: { isEnabled: true },
    OR: [
      { wbStock: { gt: 0 } },
      { orders: { some: { createdAtWb: { gte: new Date(now.getTime() - 30 * 86_400_000) } } } },
    ],
  } satisfies Prisma.FbsAssortmentItemWhereInput
}

export async function getFbsSheetMappingReview(
  workflow?: FbsMovementSheetWorkflowRow,
): Promise<FbsSheetMappingReview> {
  const current = workflow ?? await getFbsMovementSheetWorkflow()
  const accounts = current.accounts.filter((account) => account.enabled)
  if (!accounts.length) return { pending: [], groups: [], warning: null }
  try {
    const [sheet, items] = await Promise.all([
      readSheetIdentities(current),
      prisma.fbsAssortmentItem.findMany({
        where: relevantAssortmentWhere(accounts.map((account) => account.wbAccountId)),
        select: {
          wbAccountId: true, nmId: true, chrtId: true, vendorCode: true, barcode: true, wbStock: true,
          product: { select: { title: true } }, productSize: { select: { techSize: true, wbSize: true } },
        },
        orderBy: [{ nmId: 'asc' }, { chrtId: 'asc' }],
      }),
    ])
    const accountMap = new Map(accounts.map((account) => [account.wbAccountId, account]))
    const known = new Map([...Array.from(sheet.names), ...Object.entries(current.config.productAliases)])
    const confirmedExamples = items.flatMap((item) => {
      const account = accountMap.get(item.wbAccountId)!
      const productName = known.get(fbsProductTupleKey(account.technicalKey ?? '', item.nmId, item.chrtId))
      return productName ? [{ productName, vendorCode: item.vendorCode,
        techSize: item.productSize?.techSize, wbSize: item.productSize?.wbSize }] : []
    })
    const pending = new Map<string, FbsSheetPendingMapping>()
    for (const item of items) {
      const account = accountMap.get(item.wbAccountId)!
      const key = fbsProductTupleKey(account.technicalKey ?? '', item.nmId, item.chrtId)
      if (known.has(key)) continue
      const previous = pending.get(key)
      if (previous) { previous.wbStock += item.wbStock; continue }
      pending.set(key, {
        key, wbAccountId: item.wbAccountId, accountName: account.wbAccountName,
        nmId: item.nmId, chrtId: item.chrtId, vendorCode: item.vendorCode,
        barcode: item.barcode, size: [item.productSize?.wbSize, item.productSize?.techSize]
          .find((value) => value && !['0', '1'].includes(value.trim())) ?? null, wbStock: item.wbStock,
        suggestions: suggestFbsProductGroups({ vendorCode: item.vendorCode, productTitle: item.product?.title,
          techSize: item.productSize?.techSize, wbSize: item.productSize?.wbSize, groups: sheet.groups,
          confirmedExamples }).map(({ productName, reason }) => ({ productName, reason })),
      })
    }
    return { pending: Array.from(pending.values()), groups: sheet.groups, warning: null }
  } catch {
    return { pending: [], groups: [], warning: 'Не удалось проверить новые товары по таблице. Проверьте доступ к Google Sheet и названия вкладок, затем обновите список. Существующие соответствия сохранены.' }
  }
}

export async function confirmFbsSheetMapping(input: ConfirmFbsSheetMappingInput) {
  const name = typeof input.productName === 'string' ? input.productName.trim() : ''
  if (!name || name.length > 160 || /^[=+\-@]/.test(name) || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Введите название товара длиной до 160 символов без формул и переносов строк')
  }
  if (!Number.isSafeInteger(input.nmId) || input.nmId <= 0 || !Number.isSafeInteger(input.chrtId) || input.chrtId <= 0
    || !['existing', 'new'].includes(input.mode)) throw new Error('Некорректный товар для сопоставления')
  const workflow = await getFbsMovementSheetWorkflow()
  const account = workflow.accounts.find((row) => row.enabled && row.wbAccountId === input.wbAccountId)
  if (!workflow.id || !account?.technicalKey) throw new Error('Кабинет не подключён к автоматизации FBS')
  const key = fbsProductTupleKey(account.technicalKey, input.nmId, input.chrtId)
  const item = await prisma.fbsAssortmentItem.findFirst({
    where: { ...relevantAssortmentWhere([input.wbAccountId]), nmId: input.nmId, chrtId: input.chrtId },
    select: { id: true },
  })
  if (!item) throw new Error('Товар не найден среди актуального ассортимента этого кабинета')
  const sheet = await readSheetIdentities(workflow)
  const knownName = workflow.config.productAliases[key] ?? sheet.names.get(key)
  if (knownName && knownName !== name) throw new Error('У товара уже подтверждено другое соответствие. Изменение существующего учёта требует отдельной проверки.')
  if (input.mode === 'existing' && !sheet.groups.includes(name)) throw new Error('Выберите существующую группу из списка')
  if (input.mode === 'new' && sheet.groups.includes(name) && knownName !== name) {
    throw new Error('Такое название уже существует. Выберите его как существующий товар.')
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await prisma.automationWorkflowSetting.findUniqueOrThrow({
      where: { id: workflow.id }, select: { config: true, updatedAt: true },
    })
    const config = latest.config as Prisma.JsonObject
    const latestTabs = normalizeFbsSheetTabs(config)
    if (text(config.spreadsheetId) !== workflow.config.spreadsheetId
      || Object.values(FBS_SHEET_ROLES).some((role) => latestTabs[role] !== workflow.config.sheetTabs[role])) {
      throw new Error('Таблица или вкладки изменились во время проверки. Обновите список товаров и повторите подтверждение.')
    }
    const keys = config.accountKeys as Prisma.JsonObject | undefined
    if (keys?.[input.wbAccountId] !== account.technicalKey) throw new Error('Настройки кабинета изменились. Обновите страницу.')
    const active = await prisma.automationWorkflowAccount.findFirst({
      where: { workflowId: workflow.id, wbAccountId: input.wbAccountId, enabled: true, wbAccount: { isActive: true } },
      select: { id: true },
    })
    if (!active) throw new Error('Кабинет отключён от автоматизации')
    const aliases = { ...FBS_CONFIRMED_PRODUCT_ALIASES, ...(config.productAliases as Record<string, string> | undefined) }
    if (aliases[key]) {
      if (aliases[key] === name) return { key, productName: name }
      throw new Error('Соответствие уже подтверждено другим пользователем. Обновите список.')
    }
    const changed = await prisma.automationWorkflowSetting.updateMany({
      where: { id: workflow.id, updatedAt: latest.updatedAt, config: { equals: config as Prisma.InputJsonValue } },
      data: { config: { ...config, productAliases: { ...aliases, [key]: name } } as Prisma.InputJsonValue },
    })
    if (changed.count) return { key, productName: name }
  }
  throw new Error('Настройки одновременно изменились. Обновите список и повторите подтверждение.')
}
