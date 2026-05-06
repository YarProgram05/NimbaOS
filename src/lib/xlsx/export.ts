import * as XLSX from 'xlsx'

type CellValue = string | number | boolean | Date | null | undefined

interface SheetPolishOptions {
  widths?: number[]
  autoFilter?: boolean
  columnFormats?: Record<number, string>
  numericFromRow?: number
}

export function createWorkbook() {
  return XLSX.utils.book_new()
}

export function appendAoaSheet(
  workbook: XLSX.WorkBook,
  name: string,
  data: CellValue[][],
  options: SheetPolishOptions = {},
) {
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  polishWorksheet(worksheet, options)
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(name))
  return worksheet
}

export function polishWorksheet(
  worksheet: XLSX.WorkSheet,
  {
    widths,
    autoFilter = true,
    columnFormats,
    numericFromRow = 1,
  }: SheetPolishOptions = {},
) {
  const rangeRef = worksheet['!ref']
  if (!rangeRef) return

  const range = XLSX.utils.decode_range(rangeRef)

  if (widths?.length) {
    worksheet['!cols'] = widths.map((wch) => ({ wch }))
  }

  if (autoFilter) {
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: range.s.r, c: range.s.c },
        e: { r: range.s.r, c: range.e.c },
      }),
    }
  }

  if (!columnFormats) return

  for (const [column, format] of Object.entries(columnFormats)) {
    const c = Number(column)
    for (let r = numericFromRow; r <= range.e.r; r += 1) {
      const address = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[address]
      if (!cell || cell.v === '' || cell.v == null) continue
      if (cell.t !== 'n' && !(cell.v instanceof Date)) continue
      cell.z = format
    }
  }
}

export function workbookToBase64(workbook: XLSX.WorkBook) {
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buffer).toString('base64')
}

export function safeXlsxFilename(...parts: Array<string | number | null | undefined>) {
  const stem = parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
    .map((part) => String(part).trim().replace(/[^\w\u0400-\u04ff.-]+/g, '_'))
    .join('_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `${stem || 'export'}.xlsx`
}

export function safeSheetName(name: string) {
  const cleaned = name.replace(/[:\\/?*\[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  return (cleaned || 'Sheet').slice(0, 31)
}

export function toExcelNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return value as CellValue
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!normalized || Number.isNaN(Number(normalized))) return value
  return Number(normalized)
}
