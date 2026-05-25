import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_AUTOMATION_JOB_OPTIONS,
  getAutomationQueue,
  type AutomationJobData,
} from '@/lib/queue/automation'
import { toPrismaAutomationKind } from '@/lib/automations/mapping'
import {
  AUTOMATION_WORKFLOW_KINDS,
  type AutomationAccountRow,
  type AutomationWorkflowRow,
  type MorningWbReportConfig,
  type UpdateMorningWbReportWorkflowInput,
} from '@/types/automations'

const TIMEZONE = 'Europe/Moscow'
const DEFAULT_TIME_OF_DAY = '10:00'
const MORNING_WB_REPORT_SPREADSHEET_ID = '1DH-Br4Co7h1yiU9LG0Wg8bPxIRuk9TswcyYtCL9VnXw'
const MORNING_WB_REPORT_SPREADSHEET_URL =
  `https://docs.google.com/spreadsheets/d/${MORNING_WB_REPORT_SPREADSHEET_ID}/edit`

const MORNING_WB_REPORT_PRISMA_KIND = toPrismaAutomationKind(
  AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
)

function defaultMorningConfig(): MorningWbReportConfig {
  return {
    spreadsheetId: MORNING_WB_REPORT_SPREADSHEET_ID,
    spreadsheetUrl: MORNING_WB_REPORT_SPREADSHEET_URL,
  }
}

function parseMorningConfig(value: unknown): MorningWbReportConfig {
  if (!value || typeof value !== 'object') return defaultMorningConfig()
  const config = value as Partial<MorningWbReportConfig>
  const spreadsheetId = typeof config.spreadsheetId === 'string' && config.spreadsheetId.trim()
    ? config.spreadsheetId.trim()
    : MORNING_WB_REPORT_SPREADSHEET_ID
  const spreadsheetUrl = typeof config.spreadsheetUrl === 'string' && config.spreadsheetUrl.trim()
    ? config.spreadsheetUrl.trim()
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

  return { spreadsheetId, spreadsheetUrl }
}

export function extractSpreadsheetId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Укажите ссылку или ID Google Sheet')
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? trimmed
}

function validateTimeOfDay(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Укажите время в формате ЧЧ:ММ')
  const [hours, minutes] = value.split(':').map(Number)
  if (hours > 23 || minutes > 59) throw new Error('Укажите корректное время')
}

function patternFromTime(timeOfDay: string) {
  validateTimeOfDay(timeOfDay)
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  return `0 ${minutes} ${hours} * * *`
}

function getNextRunAt(timeOfDay: string, enabled: boolean): string | null {
  if (!enabled) return null
  validateTimeOfDay(timeOfDay)
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const moscowNow = new Date(utcMs + 3 * 60 * 60_000)
  const nextMoscow = new Date(moscowNow)
  nextMoscow.setHours(hours, minutes, 0, 0)
  if (nextMoscow <= moscowNow) nextMoscow.setDate(nextMoscow.getDate() + 1)
  return new Date(nextMoscow.getTime() - 3 * 60 * 60_000).toISOString()
}

function schedulerId(kind = AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT) {
  return `automation:${kind}`
}

function defaultSheetName(accountName: string) {
  const normalized = accountName.toLowerCase()
  if (normalized.includes('galioni')) return 'WB Galioni'
  if (normalized.includes('nimba')) return 'WB Nimba'
  return `WB ${accountName}`.slice(0, 100)
}

function buildScheduledJobData(workflowId: string): AutomationJobData {
  return {
    kind: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
    source: 'scheduled',
    workflowId,
  }
}

export async function ensureMorningWbReportWorkflow() {
  const workflow = await prisma.automationWorkflowSetting.upsert({
    where: { kind: MORNING_WB_REPORT_PRISMA_KIND },
    create: {
      kind: MORNING_WB_REPORT_PRISMA_KIND,
      enabled: false,
      timeOfDay: DEFAULT_TIME_OF_DAY,
      timezone: TIMEZONE,
      config: defaultMorningConfig() as unknown as Prisma.InputJsonValue,
    },
    update: {},
  })

  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  for (const account of accounts) {
    await prisma.automationWorkflowAccount.upsert({
      where: {
        workflowId_wbAccountId: {
          workflowId: workflow.id,
          wbAccountId: account.id,
        },
      },
      create: {
        workflowId: workflow.id,
        wbAccountId: account.id,
        enabled: true,
        sheetName: defaultSheetName(account.name),
      },
      update: {},
    })
  }

  return workflow
}

export async function getMorningWbReportWorkflow(): Promise<AutomationWorkflowRow> {
  const workflow = await ensureMorningWbReportWorkflow()

  const [accounts, mappings] = await Promise.all([
    prisma.wbAccount.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sellerName: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.automationWorkflowAccount.findMany({
      where: { workflowId: workflow.id },
    }),
  ])

  const mappingsByAccount = new Map(mappings.map((mapping) => [mapping.wbAccountId, mapping]))
  const workflowAccounts: AutomationAccountRow[] = accounts.map((account) => {
    const mapping = mappingsByAccount.get(account.id)
    return {
      id: mapping?.id ?? null,
      wbAccountId: account.id,
      wbAccountName: account.name,
      sellerName: account.sellerName,
      enabled: mapping?.enabled ?? true,
      sheetName: mapping?.sheetName ?? defaultSheetName(account.name),
    }
  })

  return {
    id: workflow.id,
    kind: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
    enabled: workflow.enabled,
    timeOfDay: workflow.timeOfDay,
    timezone: workflow.timezone,
    config: parseMorningConfig(workflow.config),
    lastAppliedAt: workflow.lastAppliedAt?.toISOString() ?? null,
    nextRunAt: getNextRunAt(workflow.timeOfDay, workflow.enabled),
    accounts: workflowAccounts,
  }
}

export async function updateMorningWbReportWorkflow(
  input: UpdateMorningWbReportWorkflowInput,
): Promise<AutomationWorkflowRow> {
  validateTimeOfDay(input.timeOfDay)
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl)
  const config: MorningWbReportConfig = {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  }

  const activeAccounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  const activeAccountIds = new Set(activeAccounts.map((account) => account.id))

  const workflow = await prisma.automationWorkflowSetting.upsert({
    where: { kind: MORNING_WB_REPORT_PRISMA_KIND },
    create: {
      kind: MORNING_WB_REPORT_PRISMA_KIND,
      enabled: input.enabled,
      timeOfDay: input.timeOfDay,
      timezone: TIMEZONE,
      config: config as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: input.enabled,
      timeOfDay: input.timeOfDay,
      timezone: TIMEZONE,
      config: config as unknown as Prisma.InputJsonValue,
    },
  })

  for (const account of input.accounts) {
    if (!activeAccountIds.has(account.wbAccountId)) continue
    if (!account.sheetName.trim()) throw new Error('Укажите вкладку для каждого выбранного кабинета')
    await prisma.automationWorkflowAccount.upsert({
      where: {
        workflowId_wbAccountId: {
          workflowId: workflow.id,
          wbAccountId: account.wbAccountId,
        },
      },
      create: {
        workflowId: workflow.id,
        wbAccountId: account.wbAccountId,
        enabled: account.enabled,
        sheetName: account.sheetName.trim(),
      },
      update: {
        enabled: account.enabled,
        sheetName: account.sheetName.trim(),
      },
    })
  }

  await applyMorningWbReportSchedule(workflow.id)
  return getMorningWbReportWorkflow()
}

export async function applyMorningWbReportSchedule(workflowId?: string): Promise<AutomationWorkflowRow> {
  const workflow = workflowId
    ? await prisma.automationWorkflowSetting.findUniqueOrThrow({ where: { id: workflowId } })
    : await ensureMorningWbReportWorkflow()

  const queue = await getAutomationQueue()
  if (!workflow.enabled) {
    await queue.removeJobScheduler(schedulerId()).catch(() => false)
  } else {
    const nextRunAt = getNextRunAt(workflow.timeOfDay, workflow.enabled)
    await queue.upsertJobScheduler(
      schedulerId(),
      {
        pattern: patternFromTime(workflow.timeOfDay),
        tz: workflow.timezone,
        startDate: nextRunAt ? new Date(nextRunAt).getTime() : undefined,
      },
      {
        name: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
        data: buildScheduledJobData(workflow.id),
        opts: DEFAULT_AUTOMATION_JOB_OPTIONS,
      },
    )
  }

  await prisma.automationWorkflowSetting.update({
    where: { id: workflow.id },
    data: { lastAppliedAt: new Date() },
  })

  return getMorningWbReportWorkflow()
}

export async function applyAllAutomationSchedules() {
  const workflow = await ensureMorningWbReportWorkflow()
  await applyMorningWbReportSchedule(workflow.id)
  return { workflows: 1, scheduled: workflow.enabled ? 1 : 0 }
}
