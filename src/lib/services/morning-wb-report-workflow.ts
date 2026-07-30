import { prisma } from '@/lib/db'
import { getSpreadsheetMetadata, getSheetValues, batchUpdateSheetValues, clearSheetValues } from '@/lib/google/sheets'
import { ensureMorningWbReportWorkflow } from '@/lib/automations/workflows'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { getMorningReportData } from '@/lib/services/morning-report'
import { AUTOMATION_WORKFLOW_KINDS } from '@/types/automations'
import { SYNC_JOB_KINDS } from '@/types/sync'
import type { MorningReportData } from '@/lib/services/morning-report'

const HEADER_ROW = [
  'Дата',
  'Заказано, руб',
  'Выкупили, руб',
  'Выкупили, шт',
  '% выкупа',
  'Факт приход',
  'Логистика',
  'Хранение',
  'Оборачиваемость',
  'Себестоимость',
  'Реклама',
  'ДРР',
  'ЧП',
  'ЧП на 1 ед',
  'Налоги в руб',
  'Налог %',
  'ОП факт без рекламы',
]

const DAY_ROWS = 31
const YEAR_START_MONTH = 0
const YEAR_START_DAY = 1
const YEAR_TOTAL_ROW = 34
const MONTH_PROGRESS_VALUE_ROW = 44
const FORMULA_COLUMNS = new Set([5, 12, 14])
const MOSCOW_TIME_ZONE = 'Europe/Moscow'

interface WorkflowStepTiming {
  name: string
  durationMs: number
  skipped?: boolean
  error?: string
  note?: string
}

interface WorkflowAccountResult {
  wbAccountId: string
  accountName: string
  sheetName: string
  status: 'SUCCEEDED' | 'FAILED'
  rowsWritten: number
  durationMs: number
  steps: WorkflowStepTiming[]
  error?: string
}

class MorningWbReportAccountError extends Error {
  steps: WorkflowStepTiming[]
  durationMs: number

  constructor(message: string, steps: WorkflowStepTiming[], durationMs: number) {
    super(message)
    this.name = 'MorningWbReportAccountError'
    this.steps = steps
    this.durationMs = durationMs
  }
}

export interface MorningWbReportWorkflowResult {
  spreadsheetId: string
  targetDate: string
  dateFrom: string
  dateTo: string
  accountsProcessed: number
  accountsFailed: number
  accounts: WorkflowAccountResult[]
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDateInMoscow(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) throw new Error('Не удалось определить московскую дату')
  return `${year}-${month}-${day}`
}

function getTargetDate(now = new Date()) {
  return addDays(parseDate(formatDateInMoscow(now)), -1)
}

function firstDayOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
}

function firstDayOfYear(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), YEAR_START_MONTH, YEAR_START_DAY))
}

function daysInMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate()
}

function sheetSerialDate(value: Date) {
  const epoch = Date.UTC(1899, 11, 30)
  return Math.round((value.getTime() - epoch) / 86_400_000)
}

function sheetNameA1(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`
}

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function validateHeaders(sheetName: string, values: unknown[][]) {
  const headers = values[0] ?? []
  for (let index = 0; index < HEADER_ROW.length; index++) {
    if (normalizeHeader(headers[index]) !== normalizeHeader(HEADER_ROW[index])) {
      throw new Error(`Вкладка ${sheetName}: ожидается заголовок "${HEADER_ROW[index]}" в колонке ${index + 1}`)
    }
  }
}

function numberValue(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function weightedTurnover(data: MorningReportData) {
  const rows = data.stockRows.filter((row) => row.quantity > 0 && row.turnoverDays !== null)
  const weighted = rows.reduce(
    (acc, row) => {
      const weight = Math.max(row.stockValue, row.quantity, 1)
      return {
        total: acc.total + (row.turnoverDays ?? 0) * weight,
        weight: acc.weight + weight,
      }
    },
    { total: 0, weight: 0 },
  )

  return weighted.weight > 0 ? weighted.total / weighted.weight : 0
}

function buildDailyValues(data: MorningReportData, taxRatePercent: number) {
  const summary = data.financial.summary
  const orderedRub = numberValue(summary.orderedRub)
  const sale = numberValue(summary.sale)
  const boughtQty = numberValue(summary.boughtWithReturns)
  const toTransfer = numberValue(summary.toTransfer)
  const logistics = numberValue(summary.logistics)
  const storage = numberValue(summary.storageFee)
  const turnover = weightedTurnover(data)
  const costPrice = numberValue(summary.costPrice)
  const adAll = numberValue(summary.adAll)
  const operatingProfit = numberValue(summary.operatingProfit)
  const taxes = numberValue(summary.taxes)
  const operatingProfitBeforeAds = operatingProfit + adAll

  return {
    bd: [orderedRub, sale, boughtQty],
    fk: [toTransfer, logistics, storage, turnover, costPrice, adAll],
    m: [operatingProfit],
    oq: [taxes, taxRatePercent / 100, operatingProfitBeforeAds],
  }
}

function skippedStep(name: string, note: string): WorkflowStepTiming {
  return { name, durationMs: 0, skipped: true, note }
}

async function timedStep<T>(
  steps: WorkflowStepTiming[],
  name: string,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await action()
    steps.push({ name, durationMs: Date.now() - startedAt })
    return result
  } catch (error) {
    steps.push({
      name,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

async function ensureReportSources(params: {
  wbAccountId: string
  reportDateFrom: string
  adDateFrom: string
  dateTo: string
}) {
  const { wbAccountId, reportDateFrom, adDateFrom, dateTo } = params
  const steps: WorkflowStepTiming[] = []

  const reportCoverage = await timedStep(steps, 'coverage:reports', () =>
    getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.REPORTS_PERIOD, reportDateFrom, dateTo),
  )
  if (!reportCoverage.isCovered) {
    throw new Error(`Нет локального покрытия отчетных данных за ${reportDateFrom} - ${dateTo}; запустите sync отчетов отдельно`)
  } else {
    steps.push(skippedStep('sync:reports', 'DB coverage complete; external sync disabled for this workflow'))
  }

  const adCoverage = await timedStep(steps, 'coverage:advertising', () =>
    getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.ADVERTISING_STATS, adDateFrom, dateTo),
  )
  if (!adCoverage.isCovered) {
    throw new Error(`Нет локального покрытия рекламы за ${adDateFrom} - ${dateTo}; запустите sync рекламы отдельно`)
  } else {
    steps.push(skippedStep('sync:advertising', 'DB coverage complete; external sync disabled for this workflow'))
  }

  const latestSnapshot = await timedStep(steps, 'db:latest-stock-snapshot', () =>
    prisma.stockSnapshot.findFirst({
      where: { wbAccountId },
      select: { syncedAt: true },
      orderBy: { syncedAt: 'desc' },
    }),
  )
  const target = parseDate(dateTo)
  if (!latestSnapshot) {
    throw new Error('Нет локального снимка остатков; запустите sync остатков отдельно')
  }
  if (latestSnapshot.syncedAt < target) {
    throw new Error(`Локальный снимок остатков устарел (${latestSnapshot.syncedAt.toISOString()}); запустите sync остатков отдельно`)
  }
  steps.push(skippedStep('sync:stocks-current', 'DB snapshot is fresh enough; external sync disabled for this workflow'))

  return steps
}

async function prepareMonthIfNeeded(
  spreadsheetId: string,
  sheetName: string,
  targetDate: Date,
) {
  const prefix = sheetNameA1(sheetName)
  const values = await getSheetValues(spreadsheetId, `${prefix}!A1:Q${YEAR_TOTAL_ROW}`, 'FORMULA')
  validateHeaders(sheetName, values)

  const firstExistingDate = numberValue(values[1]?.[0])
  const targetFirstDate = sheetSerialDate(firstDayOfMonth(targetDate))
  const needsRollover = firstExistingDate !== targetFirstDate
  const monthDays = daysInMonth(targetDate)

  if (!needsRollover) return

  const monthStart = firstDayOfMonth(targetDate)
  const dateValues = Array.from({ length: monthDays }, (_, index) => [
    sheetSerialDate(addDays(monthStart, index)),
  ])

  const clearRanges = [
    `${prefix}!B2:D32`,
    `${prefix}!F2:K32`,
    `${prefix}!M2:M32`,
    `${prefix}!O2:Q32`,
  ]
  if (monthDays < DAY_ROWS) {
    clearRanges.push(`${prefix}!A${monthDays + 2}:A32`)
  }

  await clearSheetValues(spreadsheetId, clearRanges)

  await batchUpdateSheetValues(spreadsheetId, [
    {
      range: `${prefix}!A2:A${monthDays + 1}`,
      values: dateValues,
    },
  ])
}

async function writeAccountReport(params: {
  spreadsheetId: string
  wbAccountId: string
  accountName: string
  sheetName: string
  taxRatePercent: number
  dateFrom: string
  dateTo: string
  targetDate: Date
}) {
  const { spreadsheetId, wbAccountId, sheetName, taxRatePercent, dateFrom, dateTo, targetDate } = params
  const steps: WorkflowStepTiming[] = []
  const startedAt = Date.now()
  try {
    await timedStep(steps, 'sheet:prepare-month', () => prepareMonthIfNeeded(spreadsheetId, sheetName, targetDate))
    const yearStart = formatDate(firstDayOfYear(targetDate))
    steps.push(...(await ensureReportSources({
      wbAccountId,
      reportDateFrom: yearStart,
      adDateFrom: dateFrom,
      dateTo,
    })))

    const from = parseDate(dateFrom)
    const to = parseDate(dateTo)
    const bdValues: number[][] = []
    const fkValues: number[][] = []
    const mValues: number[][] = []
    const oqValues: number[][] = []

    await timedStep(steps, 'report:build-daily-values', async () => {
      for (let day = from; day <= to; day = addDays(day, 1)) {
        const dayString = formatDate(day)
        const data = await getMorningReportData(wbAccountId, dayString, dayString)
        if (!data.financial.coverage.isCovered) {
          throw new Error(`Нет покрытия финансовых данных за ${dayString}`)
        }
        const values = buildDailyValues(data, taxRatePercent)
        bdValues.push(values.bd)
        fkValues.push(values.fk)
        mValues.push(values.m)
        oqValues.push(values.oq)
      }
    })

    const yearData = await timedStep(steps, 'report:build-year-total-values', async () => {
      const data = await getMorningReportData(wbAccountId, yearStart, dateTo)
      if (!data.financial.coverage.isCovered) {
        throw new Error(`Нет покрытия финансовых данных за ${yearStart} - ${dateTo}`)
      }
      return buildDailyValues(data, taxRatePercent)
    })

    const endRow = bdValues.length + 1
    const prefix = sheetNameA1(sheetName)
    await timedStep(steps, 'sheet:write-daily-values', () =>
      batchUpdateSheetValues(spreadsheetId, [
        { range: `${prefix}!B2:D${endRow}`, values: bdValues },
        { range: `${prefix}!F2:K${endRow}`, values: fkValues },
        { range: `${prefix}!M2:M${endRow}`, values: mValues },
        { range: `${prefix}!O2:Q${endRow}`, values: oqValues },
        { range: `${prefix}!B${YEAR_TOTAL_ROW}:D${YEAR_TOTAL_ROW}`, values: [yearData.bd] },
        { range: `${prefix}!F${YEAR_TOTAL_ROW}:K${YEAR_TOTAL_ROW}`, values: [yearData.fk] },
        { range: `${prefix}!M${YEAR_TOTAL_ROW}:M${YEAR_TOTAL_ROW}`, values: [yearData.m] },
        { range: `${prefix}!O${YEAR_TOTAL_ROW}:Q${YEAR_TOTAL_ROW}`, values: [yearData.oq] },
      ]),
    )

    const workedDays = targetDate.getUTCDate()
    const totalDays = daysInMonth(targetDate)
    await timedStep(steps, 'sheet:write-month-progress', () =>
      batchUpdateSheetValues(spreadsheetId, [
        { range: `${prefix}!A${MONTH_PROGRESS_VALUE_ROW}:C${MONTH_PROGRESS_VALUE_ROW}`, values: [[workedDays, totalDays, totalDays - workedDays]] },
      ]),
    )

    return {
      rowsWritten: bdValues.length,
      durationMs: Date.now() - startedAt,
      steps,
    }
  } catch (error) {
    throw new MorningWbReportAccountError(
      error instanceof Error ? error.message : 'Unknown morning report error',
      steps,
      Date.now() - startedAt,
    )
  }
}

export async function runMorningWbReportWorkflow(options: { targetDate?: string } = {}): Promise<MorningWbReportWorkflowResult> {
  const workflow = await ensureMorningWbReportWorkflow()
  const fullWorkflow = await prisma.automationWorkflowSetting.findUniqueOrThrow({
    where: { id: workflow.id },
    include: {
      accounts: {
        where: { enabled: true },
        include: {
          wbAccount: {
            select: { id: true, name: true, isActive: true, taxRate: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const config = fullWorkflow.config as { spreadsheetId?: string }
  const spreadsheetId = config.spreadsheetId?.trim()
  if (!spreadsheetId) throw new Error('В настройках workflow не указан Google Sheet')
  await getSpreadsheetMetadata(spreadsheetId)

  const targetDate = options.targetDate ? parseDate(options.targetDate) : getTargetDate()
  const monthStart = firstDayOfMonth(targetDate)
  const yearStart = firstDayOfYear(targetDate)
  const dateFrom = formatDate(monthStart)
  const dateTo = formatDate(targetDate)
  const results: WorkflowAccountResult[] = []

  for (const mapping of fullWorkflow.accounts) {
    if (!mapping.wbAccount.isActive) continue
    const accountStartedAt = Date.now()
    try {
      const accountResult = await writeAccountReport({
        spreadsheetId,
        wbAccountId: mapping.wbAccount.id,
        accountName: mapping.wbAccount.name,
        sheetName: mapping.sheetName,
        taxRatePercent: numberValue(mapping.wbAccount.taxRate.toString()),
        dateFrom,
        dateTo,
        targetDate,
      })
      results.push({
        wbAccountId: mapping.wbAccount.id,
        accountName: mapping.wbAccount.name,
        sheetName: mapping.sheetName,
        status: 'SUCCEEDED',
        rowsWritten: accountResult.rowsWritten,
        durationMs: accountResult.durationMs,
        steps: accountResult.steps,
      })
    } catch (error) {
      const accountError = error instanceof MorningWbReportAccountError ? error : null
      results.push({
        wbAccountId: mapping.wbAccount.id,
        accountName: mapping.wbAccount.name,
        sheetName: mapping.sheetName,
        status: 'FAILED',
        rowsWritten: 0,
        durationMs: accountError?.durationMs ?? Date.now() - accountStartedAt,
        steps: accountError?.steps ?? [],
        error: error instanceof Error ? error.message : 'Unknown morning report error',
      })
    }
  }

  const accountsFailed = results.filter((result) => result.status === 'FAILED').length
  return {
    spreadsheetId,
    targetDate: dateTo,
    dateFrom: formatDate(yearStart),
    dateTo,
    accountsProcessed: results.length,
    accountsFailed,
    accounts: results,
  }
}

export function morningWbReportPayload(targetDate?: string) {
  const target = targetDate ? parseDate(targetDate) : getTargetDate()
  return {
    kind: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
    targetDate: formatDate(target),
    dateFrom: formatDate(firstDayOfYear(target)),
    dateTo: formatDate(target),
  }
}

export function isFormulaColumn(columnNumber: number) {
  return FORMULA_COLUMNS.has(columnNumber)
}
