import type { sheets_v4 } from 'googleapis'

const text = (value: unknown) => String(value ?? '').trim()
export const FBS_REFERENCE_FIRST_ROW = 4
export const FBS_REFERENCE_LAST_ROW = 153
export const FBS_SUMMARY_HEADER_ROW = 7
export const FBS_SUMMARY_LAST_ROW = 157

// The accounting template links Summary row 8 to Reference row 4. All balances
// are formulas over movements; registering a name must never create an opening.
export function planFbsReferenceExpansion(params: {
  referenceValues: unknown[][]
  summaryValues: unknown[][]
  desiredNames: string[]
  referenceSheetId: number
  referenceSheetName: string
}) {
  const names = new Map<string, number>()
  const occupiedRows = new Set<number>()
  for (const [index, row] of Array.from(params.referenceValues.slice(0, 150).entries())) {
    const name = text(row[0])
    if (!name) continue
    if (names.has(name)) throw new Error(`В справочнике повторяется товар «${name}»`)
    names.set(name, index + 4)
    occupiedRows.add(index + 4)
  }
  const additions: Array<{ name: string; row: number }> = []
  const desiredNames = Array.from(new Set(params.desiredNames)).sort()
  for (const name of desiredNames) {
    if (names.has(name)) continue
    let row = FBS_REFERENCE_FIRST_ROW
    while (occupiedRows.has(row)) row++
    if (row > FBS_REFERENCE_LAST_ROW) throw new Error('Справочник FBS заполнен: требуется расширить шаблон и итоговые формулы сводки')
    occupiedRows.add(row)
    names.set(name, row)
    additions.push({ name, row })
  }

  const source = params.summaryValues[1] ?? []
  const formulaColumns = source.flatMap((value, column) => text(value).startsWith('=') ? [column] : [])
  const referencePrefix = `'${params.referenceSheetName.replace(/'/g, "''")}'!A`
  const referencesRow = (formula: unknown, row: number) => {
    const value = text(formula)
    return value.startsWith('=') && value.includes(`${referencePrefix}${row}=`)
      && value.includes(`${referencePrefix}${row})`)
  }
  if (!referencesRow(source[0], 4) || formulaColumns.length !== 20) {
    throw new Error('Шаблон сводки A8 должен ссылаться на строку 4 справочника')
  }

  const requests: sheets_v4.Schema$Request[] = []
  for (const name of desiredNames) {
    const referenceRow = names.get(name)!
    const summaryRow = referenceRow + 4
    const existing = params.summaryValues[summaryRow - 7] ?? []
    if (!referencesRow(existing[0], referenceRow) || formulaColumns.some((column) => !text(existing[column]).startsWith('='))) {
      throw new Error(`Нельзя добавить «${name}»: строка ${summaryRow} сводки не соответствует шаблону`)
    }
  }
  for (const { name, row } of additions) {
    requests.push({ updateCells: {
      start: { sheetId: params.referenceSheetId, rowIndex: row - 1, columnIndex: 0 },
      rows: [{ values: [{ userEnteredValue: { stringValue: name } }] }],
      fields: 'userEnteredValue',
    } })
  }
  return { requests, addedNames: additions.map(({ name }) => name) }
}

export function assertFbsSummaryProductCoverage(summaryValues: unknown[][], expectedNames: string[]) {
  const seen = new Set<string>()
  for (const row of summaryValues.slice(1)) {
    const name = text(row[0])
    if (!name) continue
    if (seen.has(name)) throw new Error(`В сводке повторяется товар «${name}»`)
    seen.add(name)
  }
  const missing = Array.from(new Set(expectedNames)).filter((name) => !seen.has(name))
  if (missing.length) throw new Error(`В сводке отсутствуют товары: ${missing.join('; ')}`)
}
