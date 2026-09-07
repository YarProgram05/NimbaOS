import { prisma } from '../src/lib/db'
import { getSheetValues } from '../src/lib/google/sheets'
import {
  buildFbsProductNameMap,
  fbsProductTupleKey,
  resolveFbsProductName,
  type FbsSheetExistingRow,
} from '../src/lib/automations/fbs-sheet'
import { getFbsMovementSheetWorkflow } from '../src/lib/automations/workflows'
import { FBS_SHEET_ROLES } from '../src/lib/automations/sheet-template'
import { FBS_REFERENCE_FIRST_ROW, FBS_REFERENCE_LAST_ROW } from '../src/lib/automations/fbs-reference'

function quoteSheetName(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function rowsFromValues(values: unknown[][], firstRow: number): FbsSheetExistingRow[] {
  return values.map((row, index) => ({ rowNumber: firstRow + index, values: row }))
}

function moscowBounds(dateFrom: string, dateTo: string) {
  return {
    gte: new Date(`${dateFrom}T00:00:00+03:00`),
    lt: new Date(new Date(`${dateTo}T00:00:00+03:00`).getTime() + 86_400_000),
  }
}

async function main() {
  const workflow = await getFbsMovementSheetWorkflow()
  const operationsSheet = workflow.config.sheetTabs[FBS_SHEET_ROLES.OPERATIONS]
  const referenceSheet = workflow.config.sheetTabs[FBS_SHEET_ROLES.REFERENCE]
  const wbStockSheet = workflow.config.sheetTabs[FBS_SHEET_ROLES.WB_STOCK]
  if (!operationsSheet || !referenceSheet || !wbStockSheet) {
    throw new Error('Не настроены обязательные вкладки FBS-таблицы')
  }

  const targetDate = process.argv[2] ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const [operationValues, referenceValues, stockValues] = await Promise.all([
    getSheetValues(
      workflow.config.spreadsheetId,
      `${quoteSheetName(operationsSheet)}!A5:M`,
      'UNFORMATTED_VALUE',
    ),
    getSheetValues(
      workflow.config.spreadsheetId,
      `${quoteSheetName(referenceSheet)}!A${FBS_REFERENCE_FIRST_ROW}:A${FBS_REFERENCE_LAST_ROW}`,
      'UNFORMATTED_VALUE',
    ),
    getSheetValues(
      workflow.config.spreadsheetId,
      `${quoteSheetName(wbStockSheet)}!A1:I`,
      'UNFORMATTED_VALUE',
    ),
  ])

  const productNames = buildFbsProductNameMap(rowsFromValues(operationValues.slice(1), 6))
  const stockRows = rowsFromValues(stockValues.slice(1), 2)
  for (const row of stockRows) {
    const productName = String(row.values[0] ?? '').trim()
    const accountKey = String(row.values[7] ?? '').trim()
    const nmId = Number(row.values[4])
    const chrtId = Number(row.values[5])
    if (!productName || !accountKey || !Number.isInteger(nmId) || !Number.isInteger(chrtId)) continue
    const tuple = fbsProductTupleKey(accountKey, nmId, chrtId)
    const existing = productNames.get(tuple)
    if (existing && existing !== productName) {
      throw new Error(`Разные названия в операциях и остатках WB для ${tuple}: ${existing} / ${productName}`)
    }
    productNames.set(tuple, productName)
  }

  const allowedProductNames = referenceValues.map((row) => String(row[0] ?? '').trim()).filter(Boolean)
  const productAliases = new Map(Object.entries(workflow.config.productAliases ?? {}))
  const accountById = new Map(workflow.accounts.map((account) => [account.wbAccountId, account]))
  const enabledAccountIds = workflow.accounts.filter((account) => account.enabled).map((account) => account.wbAccountId)
  const [orders, stockItems] = await Promise.all([
    prisma.fbsOrder.findMany({
      where: {
        wbAccountId: { in: enabledAccountIds },
        createdAtWb: moscowBounds(workflow.config.startDate, targetDate),
      },
      select: { wbAccountId: true, nmId: true, chrtId: true, vendorCode: true },
    }),
    prisma.fbsAssortmentItem.findMany({
      where: { wbAccountId: { in: enabledAccountIds }, warehouse: { isEnabled: true } },
      select: { wbAccountId: true, nmId: true, chrtId: true, vendorCode: true },
    }),
  ])

  const checked = new Set<string>()
  const resolvedByTuple = new Map<string, string>()
  const vendorCodesByTuple = new Map<string, Set<string>>()
  const mismatches: Array<Record<string, unknown>> = []
  const errors: Array<Record<string, unknown>> = []
  for (const record of [...orders, ...stockItems]) {
    const account = accountById.get(record.wbAccountId)
    if (!account) continue
    const accountKey = account.technicalKey
    if (!accountKey) {
      errors.push({ wbAccountId: record.wbAccountId, error: 'Не задан технический ключ кабинета' })
      continue
    }
    const tuple = fbsProductTupleKey(accountKey, record.nmId, record.chrtId)
    const vendorCodes = vendorCodesByTuple.get(tuple) ?? new Set<string>()
    if (record.vendorCode?.trim()) vendorCodes.add(record.vendorCode.trim())
    vendorCodesByTuple.set(tuple, vendorCodes)
    if (checked.has(tuple)) continue
    checked.add(tuple)
    try {
      const resolved = resolveFbsProductName({
        productNames,
        productAliases,
        accountKey,
        nmId: record.nmId,
        chrtId: record.chrtId,
        vendorCode: record.vendorCode,
        allowedProductNames,
      })
      const sheetName = productNames.get(tuple)
      resolvedByTuple.set(tuple, resolved)
      if (sheetName !== resolved) {
        mismatches.push({ tuple, vendorCode: record.vendorCode, sheetName, resolved })
      }
    } catch (error) {
      errors.push({
        tuple,
        vendorCode: record.vendorCode,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const groupsByProduct = new Map<string, Array<{ tuple: string; vendorCodes: string[] }>>()
  for (const [tuple, resolved] of Array.from(resolvedByTuple.entries())) {
    const rows = groupsByProduct.get(resolved) ?? []
    rows.push({ tuple, vendorCodes: Array.from(vendorCodesByTuple.get(tuple) ?? []).sort() })
    groupsByProduct.set(resolved, rows)
  }
  const multiTupleGroups = Array.from(groupsByProduct.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([productName, rows]) => ({ productName, rows: rows.sort((a, b) => a.tuple.localeCompare(b.tuple)) }))
    .sort((a, b) => a.productName.localeCompare(b.productName, 'ru'))

  const result = {
    spreadsheetId: workflow.config.spreadsheetId,
    period: { dateFrom: workflow.config.startDate, dateTo: targetDate },
    checkedTuples: checked.size,
    multiTupleGroups,
    mismatches,
    errors,
  }
  console.log(JSON.stringify(result, null, 2))
  if (mismatches.length || errors.length) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
