import { prisma } from '@/lib/db'
import { getSpreadsheetMetadata, getSheetValues, batchUpdateSheetValues, clearSheetValues } from '@/lib/google/sheets'
import { ensureMorningWbReportWorkflow } from '@/lib/automations/workflows'
import { getSyncCoverage, markSyncCoverage } from '@/lib/sync/coverage'
import { syncAdCampaigns } from '@/lib/services/sync-ad-campaigns'
import { syncAdStats } from '@/lib/services/sync-ad-stats'
import { syncOrders } from '@/lib/services/sync-orders'
import { syncPaidStorage } from '@/lib/services/sync-paid-storage'
import { syncRealizationReport } from '@/lib/services/sync-reports'
import { syncSales } from '@/lib/services/sync-sales'
import { syncStocksCurrent } from '@/lib/services/sync-stocks'
import { getMorningReportData } from '@/lib/services/morning-report'
import { WbRateLimitError } from '@/lib/wb-api/client'
import { AUTOMATION_WORKFLOW_KINDS } from '@/types/automations'
import { SYNC_JOB_KINDS } from '@/types/sync'
import type { MorningReportData } from '@/lib/services/morning-report'

const HEADER_ROW = [
  'Дата',
  'Заказано, руб',
  'Выкупили, руб',
  '% выкупа',
  'Факт приход',
  'Логистика',
  'Хранение',
  'Оборачиваемость',
  'Себестоимость',
  'Реклама',
  'ДРР',
  'ЧП',
  'Налоги в руб',
  'Налог %',
  'ОП факт без рекламы',
  'ROMI',
]

const DAY_ROWS = 31
const FORMULA_COLUMNS = new Set([4, 11, 16])

interface WorkflowAccountResult {
  wbAccountId: string
  accountName: string
  sheetName: string
  status: 'SUCCEEDED' | 'FAILED'
  rowsWritten: number
  error?: string
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

function toMoscowDate(value: Date): Date {
  const utcMs = value.getTime() + value.getTimezoneOffset() * 60_000
  return new Date(utcMs + 3 * 60 * 60_000)
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

function getTargetDate(now = new Date()) {
  const moscowNow = toMoscowDate(now)
  moscowNow.setHours(0, 0, 0, 0)
  moscowNow.setDate(moscowNow.getDate() - 1)
  return parseDate(formatDate(moscowNow))
}

function firstDayOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
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
    bc: [orderedRub, sale],
    ej: [toTransfer, logistics, storage, turnover, costPrice, adAll],
    lo: [operatingProfit, taxes, taxRatePercent / 100, operatingProfitBeforeAds],
  }
}

async function ensureReportSources(wbAccountId: string, dateFrom: string, dateTo: string) {
  const reportCoverage = await getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.REPORTS_PERIOD, dateFrom, dateTo)
  if (!reportCoverage.isCovered) {
    const report = await syncRealizationReport(wbAccountId, dateFrom, dateTo)
    await syncPaidStorage(wbAccountId, dateFrom, dateTo)
    await syncOrders(wbAccountId, dateFrom, { dateTo, forceFullFetch: true })
    if (report.maxReportDate && report.maxReportDate >= dateFrom) {
      await markSyncCoverage(
        wbAccountId,
        SYNC_JOB_KINDS.REPORTS_PERIOD,
        dateFrom,
        report.maxReportDate < dateTo ? report.maxReportDate : dateTo,
      )
    }
  }

  const salesCoverage = await getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.SALES_PLAN_PERIOD, dateFrom, dateTo)
  if (!salesCoverage.isCovered) {
    await syncOrders(wbAccountId, dateFrom, { dateTo, forceFullFetch: true })
    await syncSales(wbAccountId, dateFrom)
    await markSyncCoverage(wbAccountId, SYNC_JOB_KINDS.SALES_PLAN_PERIOD, dateFrom, dateTo)
  }

  const adCoverage = await getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.ADVERTISING_STATS, dateFrom, dateTo)
  if (!adCoverage.isCovered) {
    await syncAdCampaigns(wbAccountId)
    const campaigns = await prisma.adCampaign.findMany({
      where: { wbAccountId },
      select: { id: true, advertId: true },
    })
    const errors: string[] = []
    for (const campaign of campaigns) {
      try {
        await syncAdStats({
          wbAccountId,
          campaignId: campaign.id,
          advertId: campaign.advertId,
          dateFrom,
          dateTo,
        })
      } catch (error) {
        if (error instanceof WbRateLimitError) throw error
        errors.push(error instanceof Error ? error.message : 'Unknown advertising stats error')
      }
    }
    if (errors.length > 0) {
      throw new Error(`Не удалось обновить рекламу: ${errors.join('; ')}`)
    }
    await markSyncCoverage(wbAccountId, SYNC_JOB_KINDS.ADVERTISING_STATS, dateFrom, dateTo)
  }

  const latestSnapshot = await prisma.stockSnapshot.findFirst({
    where: { wbAccountId },
    select: { syncedAt: true },
    orderBy: { syncedAt: 'desc' },
  })
  const target = parseDate(dateTo)
  if (!latestSnapshot || latestSnapshot.syncedAt < target) {
    await syncStocksCurrent(wbAccountId)
  }
}

async function prepareMonthIfNeeded(
  spreadsheetId: string,
  sheetName: string,
  targetDate: Date,
) {
  const prefix = sheetNameA1(sheetName)
  const values = await getSheetValues(spreadsheetId, `${prefix}!A1:P33`, 'FORMULA')
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
    `${prefix}!B2:C32`,
    `${prefix}!E2:J32`,
    `${prefix}!L2:O32`,
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
  await prepareMonthIfNeeded(spreadsheetId, sheetName, targetDate)
  await ensureReportSources(wbAccountId, dateFrom, dateTo)

  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  const bcValues: number[][] = []
  const ejValues: number[][] = []
  const loValues: number[][] = []

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const dayString = formatDate(day)
    const data = await getMorningReportData(wbAccountId, dayString, dayString)
    if (!data.financial.coverage.isCovered) {
      throw new Error(`Нет покрытия финансовых данных за ${dayString}`)
    }
    const values = buildDailyValues(data, taxRatePercent)
    bcValues.push(values.bc)
    ejValues.push(values.ej)
    loValues.push(values.lo)
  }

  const endRow = bcValues.length + 1
  const prefix = sheetNameA1(sheetName)
  await batchUpdateSheetValues(spreadsheetId, [
    { range: `${prefix}!B2:C${endRow}`, values: bcValues },
    { range: `${prefix}!E2:J${endRow}`, values: ejValues },
    { range: `${prefix}!L2:O${endRow}`, values: loValues },
  ])

  return bcValues.length
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
  const dateFrom = formatDate(monthStart)
  const dateTo = formatDate(targetDate)
  const results: WorkflowAccountResult[] = []

  for (const mapping of fullWorkflow.accounts) {
    if (!mapping.wbAccount.isActive) continue
    try {
      const rowsWritten = await writeAccountReport({
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
        rowsWritten,
      })
    } catch (error) {
      results.push({
        wbAccountId: mapping.wbAccount.id,
        accountName: mapping.wbAccount.name,
        sheetName: mapping.sheetName,
        status: 'FAILED',
        rowsWritten: 0,
        error: error instanceof Error ? error.message : 'Unknown morning report error',
      })
    }
  }

  const accountsFailed = results.filter((result) => result.status === 'FAILED').length
  return {
    spreadsheetId,
    targetDate: dateTo,
    dateFrom,
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
    dateFrom: formatDate(firstDayOfMonth(target)),
    dateTo: formatDate(target),
  }
}

export function isFormulaColumn(columnNumber: number) {
  return FORMULA_COLUMNS.has(columnNumber)
}
