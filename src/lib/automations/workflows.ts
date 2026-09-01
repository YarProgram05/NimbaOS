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
  type AutomationCatalogItem,
  type AutomationSchedule,
  type AutomationWorkflowRow,
  type AutomationWorkflowKind,
  type FbsMovementSheetConfig,
  type FbsMovementSheetWorkflowRow,
  type MorningWbReportWorkflowRow,
  type MorningWbReportConfig,
  type UpdateFbsMovementSheetWorkflowInput,
  type UpdateMorningWbReportWorkflowInput,
} from '@/types/automations'
import { validateFbsAccountTechnicalKey } from '@/lib/automations/fbs-sheet'
import {
  FBS_DEFAULT_SHEET_TABS,
  FBS_SHEET_ROLE_DEFINITIONS,
  normalizeFbsSheetTabs,
  normalizeSheetTabs,
  validateSheetTabs,
} from '@/lib/automations/sheet-template'
import { getAutomationDefinition } from '@/lib/automations/catalog'
import {
  automationScheduleFingerprint,
  buildAutomationScheduleRules,
  defaultAutomationSchedule,
  formatAutomationSchedule,
  getNextAutomationRunAt,
  normalizeAutomationSchedule,
  primaryAutomationTime,
  validateAutomationSchedule,
} from '@/lib/automations/schedule'

const TIMEZONE = 'Europe/Moscow'
const DEFAULT_TIME_OF_DAY = '10:00'
const MORNING_WB_REPORT_SPREADSHEET_ID = '1DH-Br4Co7h1yiU9LG0Wg8bPxIRuk9TswcyYtCL9VnXw'
const MORNING_WB_REPORT_SPREADSHEET_URL =
  `https://docs.google.com/spreadsheets/d/${MORNING_WB_REPORT_SPREADSHEET_ID}/edit`
const FBS_MOVEMENT_SPREADSHEET_ID = '18UZ2rI29JEy19ng_3HR4R92WFkdpFaqAAgC3Ttwklt4'
const FBS_MOVEMENT_SPREADSHEET_URL =
  `https://docs.google.com/spreadsheets/d/${FBS_MOVEMENT_SPREADSHEET_ID}/edit`
const FBS_DEFAULT_TIME_OF_DAY = '10:30'

const MORNING_WB_REPORT_PRISMA_KIND = toPrismaAutomationKind(
  AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
)
const FBS_MOVEMENT_SHEET_PRISMA_KIND = toPrismaAutomationKind(
  AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET,
)

function defaultMorningConfig(timeOfDay = DEFAULT_TIME_OF_DAY): MorningWbReportConfig {
  return {
    spreadsheetId: MORNING_WB_REPORT_SPREADSHEET_ID,
    spreadsheetUrl: MORNING_WB_REPORT_SPREADSHEET_URL,
    sheetTabs: {},
    schedule: defaultAutomationSchedule(timeOfDay),
  }
}

function parseMorningConfig(value: unknown, timeOfDay = DEFAULT_TIME_OF_DAY): MorningWbReportConfig {
  if (!value || typeof value !== 'object') return defaultMorningConfig(timeOfDay)
  const config = value as Partial<MorningWbReportConfig>
  const spreadsheetId = typeof config.spreadsheetId === 'string' && config.spreadsheetId.trim()
    ? config.spreadsheetId.trim()
    : MORNING_WB_REPORT_SPREADSHEET_ID
  const spreadsheetUrl = typeof config.spreadsheetUrl === 'string' && config.spreadsheetUrl.trim()
    ? config.spreadsheetUrl.trim()
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

  return {
    spreadsheetId,
    spreadsheetUrl,
    sheetTabs: normalizeSheetTabs(config.sheetTabs),
    schedule: normalizeAutomationSchedule(config.schedule, timeOfDay),
  }
}

function defaultFbsConfig(timeOfDay = FBS_DEFAULT_TIME_OF_DAY): FbsMovementSheetConfig {
  return {
    spreadsheetId: FBS_MOVEMENT_SPREADSHEET_ID,
    spreadsheetUrl: FBS_MOVEMENT_SPREADSHEET_URL,
    sheetTabs: { ...FBS_DEFAULT_SHEET_TABS },
    startDate: '2026-08-10',
    accountKeys: {},
    productAliases: {
      'nimba:158472051:263727213': 'парео черн шиф',
      'nimba:169028676:408742887': 'парео хлопок голубой',
      'nimba:232092330:366203451': 'туника зеленая волна',
      'nimba:232092449:366203604': 'туника синие волны',
      'nimba:272548220:420779646': 'туника черный лист',
      'nimba:297175085:452136209': 'туника леопард/пятна',
      'nimba:297175260:452136411': 'туника черный лист',
      'nimba:375529934:547426076': 'длинная жираф ЧЕРНО/белый',
      'nimba:412122105:591014919': 'синий шифон квадраты',
      'galioni:169042141:280894171': 'парео хлопок голубой',
      'galioni:219179076:348718974': 'туника синие волны',
      'galioni:219179130:348719037': 'туника светло зеленая',
      'galioni:242654871:380939756': 'туника зеленая волна',
      'galioni:270773541:418586502': 'туника черный лист',
      'galioni:270774246:418587463': 'туника леопард/пятна',
      'galioni:365509886:535488707': 'парео синий шиф',
    },
    schedule: defaultAutomationSchedule(timeOfDay),
  }
}

function parseFbsConfig(value: unknown, timeOfDay = FBS_DEFAULT_TIME_OF_DAY): FbsMovementSheetConfig {
  const defaults = defaultFbsConfig(timeOfDay)
  if (!value || typeof value !== 'object') return defaults
  const config = value as Partial<FbsMovementSheetConfig>
  const spreadsheetId = typeof config.spreadsheetId === 'string' && config.spreadsheetId.trim()
    ? config.spreadsheetId.trim()
    : defaults.spreadsheetId
  const readText = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && candidate.trim() ? candidate.trim() : fallback
  const accountKeys = config.accountKeys && typeof config.accountKeys === 'object' && !Array.isArray(config.accountKeys)
    ? Object.fromEntries(Object.entries(config.accountKeys).filter(([, key]) => typeof key === 'string')) as Record<string, string>
    : {}
  const configuredAliases = config.productAliases && typeof config.productAliases === 'object' && !Array.isArray(config.productAliases)
    ? Object.fromEntries(Object.entries(config.productAliases).filter(([, name]) => typeof name === 'string')) as Record<string, string>
    : {}
  const sheetTabs = normalizeFbsSheetTabs(value)
  return {
    spreadsheetId,
    spreadsheetUrl: readText(config.spreadsheetUrl, `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`),
    sheetTabs,
    startDate: readText(config.startDate, defaults.startDate),
    accountKeys,
    productAliases: { ...defaults.productAliases, ...configuredAliases },
    schedule: normalizeAutomationSchedule(config.schedule, timeOfDay),
  }
}

export function extractSpreadsheetId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Укажите ссылку или ID Google Sheet')
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? trimmed
}

function getNextRunAt(schedule: AutomationSchedule, enabled: boolean): string | null {
  if (!enabled) return null
  return getNextAutomationRunAt(schedule).toISOString()
}

function schedulerPrefix(kind: AutomationWorkflowKind = AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT) {
  return `automation:${kind}`
}

function schedulerId(idSuffix: string, kind: AutomationWorkflowKind = AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT) {
  return `${schedulerPrefix(kind)}:${idSuffix}`
}

function defaultSheetName(accountName: string) {
  const normalized = accountName.toLowerCase()
  if (normalized.includes('galioni')) return 'WB Galioni'
  if (normalized.includes('nimba')) return 'WB Nimba'
  return `WB ${accountName}`.slice(0, 100)
}

function defaultFbsCabinetLabel(accountName: string) {
  const normalized = accountName.toLowerCase()
  if (normalized.includes('galioni')) return 'Снигирева / WB Galioni'
  if (normalized.includes('nimba')) return 'Гребнев / WB Nimba'
  return accountName.slice(0, 100)
}

function defaultFbsTechnicalKey(account: { id: string; name: string }) {
  const normalized = account.name.toLowerCase()
  if (normalized.includes('galioni')) return 'galioni'
  if (normalized.includes('nimba')) return 'nimba'
  return `account-${account.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase()}`
}

function defaultFbsAccountEnabled(accountName: string) {
  const normalized = accountName.toLowerCase()
  return normalized.includes('galioni') || normalized.includes('nimba')
}

function buildScheduledJobData(
  workflowId: string,
  scheduledTime: string,
  schedule: AutomationSchedule,
  kind: AutomationWorkflowKind = AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
): AutomationJobData {
  return {
    kind,
    source: 'scheduled',
    workflowId,
    scheduledTime,
    scheduleFingerprint: automationScheduleFingerprint(schedule),
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

export async function getMorningWbReportWorkflow(): Promise<MorningWbReportWorkflowRow> {
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

  const config = parseMorningConfig(workflow.config, workflow.timeOfDay)
  return {
    id: workflow.id,
    kind: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
    enabled: workflow.enabled,
    timeOfDay: workflow.timeOfDay,
    schedule: config.schedule,
    timezone: workflow.timezone,
    config,
    lastAppliedAt: workflow.lastAppliedAt?.toISOString() ?? null,
    nextRunAt: getNextRunAt(config.schedule, workflow.enabled),
    accounts: workflowAccounts,
  }
}

export async function ensureFbsMovementSheetWorkflow() {
  let workflow = await prisma.automationWorkflowSetting.upsert({
    where: { kind: FBS_MOVEMENT_SHEET_PRISMA_KIND },
    create: {
      kind: FBS_MOVEMENT_SHEET_PRISMA_KIND,
      enabled: false,
      timeOfDay: FBS_DEFAULT_TIME_OF_DAY,
      timezone: TIMEZONE,
      config: defaultFbsConfig() as unknown as Prisma.InputJsonValue,
    },
    update: {},
  })
  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  const config = parseFbsConfig(workflow.config, workflow.timeOfDay)
  let configChanged = !(
    workflow.config && typeof workflow.config === 'object' && !Array.isArray(workflow.config) &&
    'productAliases' in workflow.config
  )
  for (const account of accounts) {
    if (!config.accountKeys[account.id]) {
      config.accountKeys[account.id] = defaultFbsTechnicalKey(account)
      configChanged = true
    }
    await prisma.automationWorkflowAccount.upsert({
      where: { workflowId_wbAccountId: { workflowId: workflow.id, wbAccountId: account.id } },
      create: {
        workflowId: workflow.id,
        wbAccountId: account.id,
        enabled: defaultFbsAccountEnabled(account.name),
        sheetName: defaultFbsCabinetLabel(account.name),
      },
      update: {},
    })
  }
  if (configChanged) {
    workflow = await prisma.automationWorkflowSetting.update({
      where: { id: workflow.id },
      data: { config: config as unknown as Prisma.InputJsonValue },
    })
  }
  return workflow
}

export async function getFbsMovementSheetWorkflow(): Promise<FbsMovementSheetWorkflowRow> {
  const workflow = await ensureFbsMovementSheetWorkflow()
  const [accounts, mappings] = await Promise.all([
    prisma.wbAccount.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sellerName: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.automationWorkflowAccount.findMany({ where: { workflowId: workflow.id } }),
  ])
  const config = parseFbsConfig(workflow.config, workflow.timeOfDay)
  const mappingsByAccount = new Map(mappings.map((mapping) => [mapping.wbAccountId, mapping]))
  return {
    id: workflow.id,
    kind: AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET,
    enabled: workflow.enabled,
    timeOfDay: workflow.timeOfDay,
    schedule: config.schedule,
    timezone: workflow.timezone,
    config,
    lastAppliedAt: workflow.lastAppliedAt?.toISOString() ?? null,
    nextRunAt: getNextRunAt(config.schedule, workflow.enabled),
    accounts: accounts.map((account) => {
      const mapping = mappingsByAccount.get(account.id)
      return {
        id: mapping?.id ?? null,
        wbAccountId: account.id,
        wbAccountName: account.name,
        sellerName: account.sellerName,
        enabled: mapping?.enabled ?? defaultFbsAccountEnabled(account.name),
        sheetName: mapping?.sheetName ?? defaultFbsCabinetLabel(account.name),
        technicalKey: config.accountKeys[account.id] ?? defaultFbsTechnicalKey(account),
      }
    }),
  }
}

export async function updateMorningWbReportWorkflow(
  input: UpdateMorningWbReportWorkflowInput,
): Promise<AutomationWorkflowRow> {
  const schedule = validateAutomationSchedule(input.schedule)
  const timeOfDay = primaryAutomationTime(schedule)
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl)
  const config: MorningWbReportConfig = {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheetTabs: {},
    schedule,
  }

  const activeAccounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  const activeAccountIds = new Set(activeAccounts.map((account) => account.id))

  const enabledSheetNames = new Set<string>()
  const normalizedAccounts = input.accounts
    .filter((account) => activeAccountIds.has(account.wbAccountId))
    .map((account) => {
      const sheetName = account.sheetName.trim()
      if (account.enabled && !sheetName) throw new Error('Укажите вкладку для каждого выбранного кабинета')
      const normalizedSheetName = sheetName.toLocaleLowerCase('ru')
      if (account.enabled && enabledSheetNames.has(normalizedSheetName)) {
        throw new Error(`Вкладка «${sheetName}» выбрана для нескольких кабинетов`)
      }
      if (account.enabled) enabledSheetNames.add(normalizedSheetName)
      return { ...account, sheetName }
    })
  if (input.enabled && enabledSheetNames.size === 0) throw new Error('Выберите хотя бы один кабинет')

  const workflow = await prisma.automationWorkflowSetting.upsert({
    where: { kind: MORNING_WB_REPORT_PRISMA_KIND },
    create: {
      kind: MORNING_WB_REPORT_PRISMA_KIND,
      enabled: input.enabled,
      timeOfDay,
      timezone: TIMEZONE,
      config: config as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: input.enabled,
      timeOfDay,
      timezone: TIMEZONE,
      config: config as unknown as Prisma.InputJsonValue,
    },
  })

  for (const account of normalizedAccounts) {
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
        sheetName: account.sheetName,
      },
      update: {
        enabled: account.enabled,
        sheetName: account.sheetName,
      },
    })
  }

  await applyMorningWbReportSchedule(workflow.id)
  return getMorningWbReportWorkflow()
}

export async function updateFbsMovementSheetWorkflow(
  input: UpdateFbsMovementSheetWorkflowInput,
): Promise<FbsMovementSheetWorkflowRow> {
  const existingWorkflow = await ensureFbsMovementSheetWorkflow()
  const existingConfig = parseFbsConfig(existingWorkflow.config, existingWorkflow.timeOfDay)
  const schedule = validateAutomationSchedule(input.schedule)
  const timeOfDay = primaryAutomationTime(schedule)
  const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error('Укажите дату начала в формате ГГГГ-ММ-ДД')
  const sheetTabs = validateSheetTabs(input.sheetTabs, FBS_SHEET_ROLE_DEFINITIONS)

  const activeAccounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  const activeAccountIds = new Set(activeAccounts.map((account) => account.id))
  const accountKeys: Record<string, string> = {}
  const enabledKeys = new Set<string>()
  for (const account of input.accounts) {
    if (!activeAccountIds.has(account.wbAccountId)) continue
    const technicalKey = validateFbsAccountTechnicalKey(account.technicalKey)
    if (account.enabled && enabledKeys.has(technicalKey)) throw new Error(`Технический ключ ${technicalKey} повторяется`)
    if (account.enabled) enabledKeys.add(technicalKey)
    if (!account.cabinetLabel.trim()) throw new Error('Укажите название кабинета для таблицы')
    accountKeys[account.wbAccountId] = technicalKey
  }
  if (input.enabled && enabledKeys.size === 0) throw new Error('Выберите хотя бы один кабинет')

  const config: FbsMovementSheetConfig = {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheetTabs,
    startDate: input.startDate,
    accountKeys,
    productAliases: existingConfig.productAliases,
    schedule,
  }
  const workflow = await prisma.automationWorkflowSetting.upsert({
    where: { kind: FBS_MOVEMENT_SHEET_PRISMA_KIND },
    create: {
      kind: FBS_MOVEMENT_SHEET_PRISMA_KIND,
      enabled: input.enabled,
      timeOfDay,
      timezone: TIMEZONE,
      config: config as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: input.enabled,
      timeOfDay,
      timezone: TIMEZONE,
      config: config as unknown as Prisma.InputJsonValue,
    },
  })
  for (const account of input.accounts) {
    if (!activeAccountIds.has(account.wbAccountId)) continue
    await prisma.automationWorkflowAccount.upsert({
      where: { workflowId_wbAccountId: { workflowId: workflow.id, wbAccountId: account.wbAccountId } },
      create: {
        workflowId: workflow.id,
        wbAccountId: account.wbAccountId,
        enabled: account.enabled,
        sheetName: account.cabinetLabel.trim(),
      },
      update: { enabled: account.enabled, sheetName: account.cabinetLabel.trim() },
    })
  }
  await applyFbsMovementSheetSchedule(workflow.id)
  return getFbsMovementSheetWorkflow()
}

export async function applyMorningWbReportSchedule(workflowId?: string): Promise<AutomationWorkflowRow> {
  const workflow = workflowId
    ? await prisma.automationWorkflowSetting.findUniqueOrThrow({ where: { id: workflowId } })
    : await ensureMorningWbReportWorkflow()

  const queue = await getAutomationQueue()
  const prefix = schedulerPrefix()
  const existingSchedulers = await queue.getJobSchedulers(0, -1, true)
  for (const scheduler of existingSchedulers) {
    if (scheduler.key === prefix || scheduler.key.startsWith(`${prefix}:`)) {
      await queue.removeJobScheduler(scheduler.key).catch(() => false)
    }
  }

  const config = parseMorningConfig(workflow.config, workflow.timeOfDay)
  if (workflow.enabled) {
    const rules = buildAutomationScheduleRules(config.schedule)
    for (const rule of rules) {
      await queue.upsertJobScheduler(
        schedulerId(rule.idSuffix),
        {
          pattern: rule.pattern,
          tz: workflow.timezone,
        },
        {
          name: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
          data: buildScheduledJobData(workflow.id, rule.scheduledTime, config.schedule),
          opts: DEFAULT_AUTOMATION_JOB_OPTIONS,
        },
      )
    }
  }

  await prisma.automationWorkflowSetting.update({
    where: { id: workflow.id },
    data: { lastAppliedAt: new Date() },
  })

  return getMorningWbReportWorkflow()
}

export async function applyFbsMovementSheetSchedule(workflowId?: string): Promise<FbsMovementSheetWorkflowRow> {
  const workflow = workflowId
    ? await prisma.automationWorkflowSetting.findUniqueOrThrow({ where: { id: workflowId } })
    : await ensureFbsMovementSheetWorkflow()
  const queue = await getAutomationQueue()
  const kind = AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET
  const prefix = schedulerPrefix(kind)
  const existingSchedulers = await queue.getJobSchedulers(0, -1, true)
  for (const scheduler of existingSchedulers) {
    if (scheduler.key === prefix || scheduler.key.startsWith(`${prefix}:`)) {
      await queue.removeJobScheduler(scheduler.key).catch(() => false)
    }
  }
  const config = parseFbsConfig(workflow.config, workflow.timeOfDay)
  if (workflow.enabled) {
    for (const rule of buildAutomationScheduleRules(config.schedule)) {
      await queue.upsertJobScheduler(
        schedulerId(rule.idSuffix, kind),
        { pattern: rule.pattern, tz: workflow.timezone },
        {
          name: kind,
          data: buildScheduledJobData(workflow.id, rule.scheduledTime, config.schedule, kind),
          opts: DEFAULT_AUTOMATION_JOB_OPTIONS,
        },
      )
    }
  }
  await prisma.automationWorkflowSetting.update({
    where: { id: workflow.id },
    data: { lastAppliedAt: new Date() },
  })
  return getFbsMovementSheetWorkflow()
}

export async function getAutomationCatalog(): Promise<AutomationCatalogItem[]> {
  const workflows: AutomationWorkflowRow[] = await Promise.all([
    getMorningWbReportWorkflow(),
    getFbsMovementSheetWorkflow(),
  ])
  return workflows.map((workflow) => {
    const definition = getAutomationDefinition(workflow.kind)
    return {
      kind: workflow.kind,
      name: definition.name,
      description: definition.description,
      enabled: workflow.enabled,
      timezone: workflow.timezone,
      scheduleSummary: formatAutomationSchedule(workflow.schedule),
      nextRunAt: workflow.nextRunAt,
      lastAppliedAt: workflow.lastAppliedAt,
    }
  })
}

export async function applyAllAutomationSchedules() {
  const [morning, fbs] = await Promise.all([
    ensureMorningWbReportWorkflow(),
    ensureFbsMovementSheetWorkflow(),
  ])
  await applyMorningWbReportSchedule(morning.id)
  await applyFbsMovementSheetSchedule(fbs.id)
  return { workflows: 2, scheduled: Number(morning.enabled) + Number(fbs.enabled) }
}
