import type { sheets_v4 } from 'googleapis'

export const FBS_FULFILLMENT_SUMMARY_RANGE = 'K4:L6'
export const FBS_FULFILLMENT_SUMMARY_TITLES = [
  'Передано в доставку по WB, шт.',
  'Приёмка WB подтверждена, шт.',
] as const

export interface FbsFulfillmentSummaryMetric {
  dateFrom: string
  dateTo: string
  asOf: string
  status: 'EXACT' | 'INCOMPLETE'
  units: number | null
  lowerBound: number
  confirmedAcceptanceLowerBound: number
  ordersInSource: number
}

const FIRST_ROW_INDEX = 3
const FIRST_COLUMN_INDEX = 10
const UNAVAILABLE = 'Нет данных'

function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Некорректный период показателей доставки FBS')
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error('Некорректный период показателей доставки FBS')
  }
  return timestamp
}

function displayDate(value: string) {
  return value.split('-').reverse().join('.')
}

function validPriorPeriod(value: unknown) {
  if (typeof value !== 'string') return false
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})–(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return false
  try {
    return dateValue(`${match[3]}-${match[2]}-${match[1]}`) <= dateValue(`${match[6]}-${match[5]}-${match[4]}`)
  } catch { return false }
}

function validPriorCount(value: unknown) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0
  if (value === UNAVAILABLE) return true
  if (typeof value !== 'string') return false
  const match = value.match(/^не менее (0|[1-9]\d*)$/)
  return Boolean(match && Number.isSafeInteger(Number(match[1])))
}

function assertAvailableArea(params: {
  summarySheetId: number
  currentValues: unknown[][]
  merges: sheets_v4.Schema$GridRange[]
}) {
  for (const merge of params.merges) {
    if (merge.sheetId != null && merge.sheetId !== params.summarySheetId) continue
    if ((merge.startRowIndex ?? 0) < 6 && (merge.endRowIndex ?? Infinity) > FIRST_ROW_INDEX
      && (merge.startColumnIndex ?? 0) < 12 && (merge.endColumnIndex ?? Infinity) > FIRST_COLUMN_INDEX) {
      throw new Error('Область K4:L6 сводки объединена с другими ячейками; запись показателей доставки остановлена')
    }
  }
  if (params.currentValues.length > 3 || params.currentValues.some((row) => row.length > 2)) {
    throw new Error('Для проверки показателей доставки требуется только диапазон K4:L6')
  }
  const cells = Array.from({ length: 3 }, (_, row) => Array.from({ length: 2 }, (_, column) => params.currentValues[row]?.[column]))
  const allEmpty = cells.every((row) => row.every((value) => value == null || value === ''))
  if (allEmpty) return
  const owned = cells[0][0] === FBS_FULFILLMENT_SUMMARY_TITLES[0]
    && cells[0][1] === FBS_FULFILLMENT_SUMMARY_TITLES[1]
    && cells[1].every(validPriorCount)
    && cells[2][0] === 'Период, МСК' && validPriorPeriod(cells[2][1])
  if (!owned) throw new Error('Область K4:L6 сводки содержит неизвестные данные или формулы; запись показателей доставки остановлена')
}

function color(hex: string): sheets_v4.Schema$Color {
  return { red: parseInt(hex.slice(0, 2), 16) / 255, green: parseInt(hex.slice(2, 4), 16) / 255, blue: parseInt(hex.slice(4, 6), 16) / 255 }
}

const FORMAT_FIELDS = [
  'userEnteredValue', 'note',
  'userEnteredFormat.backgroundColorStyle.rgbColor',
  'userEnteredFormat.textFormat.foregroundColorStyle.rgbColor',
  'userEnteredFormat.textFormat.bold', 'userEnteredFormat.textFormat.fontSize',
  'userEnteredFormat.horizontalAlignment', 'userEnteredFormat.verticalAlignment',
  'userEnteredFormat.wrapStrategy',
].join(',')

/** Sets only the verified K4:L6 area; it never changes ledger quantities or formulas. */
export function planFbsFulfillmentSummary(params: {
  summarySheetId: number
  currentValues: unknown[][]
  merges: sheets_v4.Schema$GridRange[]
  fulfillment: FbsFulfillmentSummaryMetric
}) {
  if (!Number.isInteger(params.summarySheetId) || params.summarySheetId < 0) throw new Error('Некорректный ID вкладки сводки FBS')
  assertAvailableArea(params)
  const metric = params.fulfillment
  if (dateValue(metric.dateFrom) > dateValue(metric.dateTo)) throw new Error('Начало периода доставки FBS позже окончания')
  const asOf = Date.parse(metric.asOf)
  if (!Number.isFinite(asOf) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(metric.asOf)) throw new Error('Некорректное время среза приёмки WB')
  if (![metric.lowerBound, metric.confirmedAcceptanceLowerBound, metric.ordersInSource].every((value) => Number.isSafeInteger(value) && value >= 0)
    || metric.confirmedAcceptanceLowerBound > metric.lowerBound || metric.lowerBound > metric.ordersInSource) {
    throw new Error('Некорректное количество в показателях доставки FBS')
  }
  if ((metric.status !== 'EXACT' && metric.status !== 'INCOMPLETE')
    || (metric.status === 'EXACT' && metric.units !== metric.lowerBound)
    || (metric.status === 'INCOMPLETE' && metric.units !== null)) {
    throw new Error('Количество доставки FBS не соответствует полноте данных')
  }
  const period = `${displayDate(metric.dateFrom)}–${displayDate(metric.dateTo)}`
  const hasData = metric.ordersInSource > 0
  const values: Array<Array<string | number>> = [
    [...FBS_FULFILLMENT_SUMMARY_TITLES],
    [hasData ? metric.status === 'EXACT' ? metric.units! : `не менее ${metric.lowerBound}` : UNAVAILABLE,
      hasData ? `не менее ${metric.confirmedAcceptanceLowerBound}` : UNAVAILABLE],
    ['Период, МСК', period],
  ]
  const cutoff = new Date(asOf + 3 * 60 * 60 * 1_000).toISOString()
  const cutoffDisplay = `${displayDate(cutoff.slice(0, 10))} ${cutoff.slice(11, 19)} МСК`
  const sharedNote = `Один сборочный заказ WB — одна единица; идентичность: кабинет + внешний ID заказа. Каждый заказ учитывается один раз по первой подтверждённой передаче. Поздние отмены и возвраты не вычитаются из факта передачи. Общий накопительный период: ${period}, МСК.`
  const handoffNote = `Передача в доставку по системным данным WB: дата закрытия поставки и статус передачи заказа. Закрытие поставки в системе не подтверждает физическую приёмку WB. ${metric.status === 'INCOMPLETE' ? 'История неполна: указана нижняя граница подтверждённого количества.' : 'Точное количество относится к доступным системным данным WB.'} ${sharedNote}`
  const acceptanceNote = `Нижняя граница приёмки, подтверждённой индивидуальными статусами заказов WB. Учитываются только заказы из того же набора передач за указанный период; наблюдение статуса должно быть не раньше передачи и не позже ${cutoffDisplay}. История подтверждений неполна: отсутствие подтверждения не означает, что WB не принял товар. Время наблюдения не является датой физической приёмки. ${sharedNote}`
  const notes = [
    [handoffNote, acceptanceNote],
    [hasData ? handoffNote : `Нет локальных заказов для расчёта. ${handoffNote}`, hasData ? acceptanceNote : `Нет локальных заказов для расчёта. ${acceptanceNote}`],
    [sharedNote, `Одинаковый накопительный период обоих показателей. Срез подтверждений: ${cutoffDisplay}. ${sharedNote}`],
  ]
  const requests: sheets_v4.Schema$Request[] = values.map((row, index) => ({
    updateCells: {
      start: { sheetId: params.summarySheetId, rowIndex: FIRST_ROW_INDEX + index, columnIndex: FIRST_COLUMN_INDEX },
      rows: [{ values: row.map((value, column) => ({
        userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: value },
        note: notes[index][column],
        userEnteredFormat: {
          backgroundColorStyle: { rgbColor: color(index === 0 ? 'd9eaf7' : 'ffffff') },
          textFormat: { foregroundColorStyle: { rgbColor: color(index === 0 ? '17365d' : '1f4e78') }, bold: index < 2, fontSize: index === 1 ? 16 : 10 },
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP',
        },
      })) }],
      // Do not use a whole-format mask: K6:L6 has an existing bottom border.
      fields: FORMAT_FIELDS,
    },
  }))
  requests.push({ updateDimensionProperties: {
    range: { sheetId: params.summarySheetId, dimension: 'ROWS', startIndex: 3, endIndex: 4 },
    properties: { pixelSize: 60 }, fields: 'pixelSize',
  } })
  return { requests, values }
}
