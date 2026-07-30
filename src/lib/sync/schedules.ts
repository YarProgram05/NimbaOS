import { prisma } from '@/lib/db'
import { DEFAULT_SYNC_JOB_OPTIONS, getSyncQueue, type SyncJobData } from '@/lib/queue'
import {
  SYNC_JOB_KINDS,
  type SyncJobKind,
  type SyncScheduleRow,
  type UpdateSyncScheduleInput,
} from '@/types/sync'
import { getNextMoscowRunAt } from '@/lib/time/moscow'

const TIMEZONE = 'Europe/Moscow'

export const SCHEDULED_SYNC_KINDS: SyncJobKind[] = [
  SYNC_JOB_KINDS.PRODUCTS_REFRESH,
  SYNC_JOB_KINDS.REPORTS_PERIOD,
  SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
  SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS,
  SYNC_JOB_KINDS.ADVERTISING_STATS,
  SYNC_JOB_KINDS.STOCKS_CURRENT,
  SYNC_JOB_KINDS.REVIEWS_REFRESH,
  SYNC_JOB_KINDS.QUESTIONS_REFRESH,
  SYNC_JOB_KINDS.FBS_OPERATIONAL,
  SYNC_JOB_KINDS.FBS_STOCKS_CURRENT,
  SYNC_JOB_KINDS.FBS_MARKING_REPORT,
]

const DEFAULT_TIMES: Record<SyncJobKind, string> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: '02:00',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: '02:30',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: '03:30',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: '04:30',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: '05:00',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: '00:00',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: '05:30',
  [SYNC_JOB_KINDS.REVIEWS_REFRESH]: '06:00',
  [SYNC_JOB_KINDS.QUESTIONS_REFRESH]: '06:15',
  [SYNC_JOB_KINDS.FBS_OPERATIONAL]: '00:00',
  [SYNC_JOB_KINDS.FBS_STOCKS_CURRENT]: '00:00',
  [SYNC_JOB_KINDS.FBS_MARKING_REPORT]: '00:00',
}

const DEFAULT_INTERVALS: Record<SyncJobKind, number | null> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: null,
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: null,
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: null,
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: null,
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: null,
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: null,
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: null,
  [SYNC_JOB_KINDS.REVIEWS_REFRESH]: null,
  [SYNC_JOB_KINDS.QUESTIONS_REFRESH]: null,
  [SYNC_JOB_KINDS.FBS_OPERATIONAL]: 5,
  [SYNC_JOB_KINDS.FBS_STOCKS_CURRENT]: 15,
  [SYNC_JOB_KINDS.FBS_MARKING_REPORT]: 60,
}

const DEFAULT_ENABLED: Record<SyncJobKind, boolean> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: true,
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: true,
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: true,
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: true,
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: true,
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: false,
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: true,
  [SYNC_JOB_KINDS.REVIEWS_REFRESH]: true,
  [SYNC_JOB_KINDS.QUESTIONS_REFRESH]: true,
  [SYNC_JOB_KINDS.FBS_OPERATIONAL]: false,
  [SYNC_JOB_KINDS.FBS_STOCKS_CURRENT]: false,
  [SYNC_JOB_KINDS.FBS_MARKING_REPORT]: false,
}

const LEGACY_SCHEDULER_IDS: Record<SyncJobKind, string> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: 'products-nightly',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: 'reports-nightly',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: 'sales-plan-nightly',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: 'advertising-campaigns-nightly',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: 'advertising-stats-nightly',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: 'advertising-clusters-nightly',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: 'stocks-current-nightly',
  [SYNC_JOB_KINDS.REVIEWS_REFRESH]: 'reviews-refresh-nightly',
  [SYNC_JOB_KINDS.QUESTIONS_REFRESH]: 'questions-refresh-nightly',
  [SYNC_JOB_KINDS.FBS_OPERATIONAL]: 'fbs-operational-interval',
  [SYNC_JOB_KINDS.FBS_STOCKS_CURRENT]: 'fbs-stocks-interval',
  [SYNC_JOB_KINDS.FBS_MARKING_REPORT]: 'fbs-marking-report-interval',
}

type PrismaKind =
  | 'PRODUCTS_REFRESH'
  | 'REPORTS_PERIOD'
  | 'SALES_PLAN_PERIOD'
  | 'ADVERTISING_CAMPAIGNS'
  | 'ADVERTISING_STATS'
  | 'ADVERTISING_CLUSTERS'
  | 'STOCKS_CURRENT'
  | 'REVIEWS_REFRESH'
  | 'QUESTIONS_REFRESH'
  | 'FBS_OPERATIONAL'
  | 'FBS_STOCKS_CURRENT'
  | 'FBS_MARKING_REPORT'

const KIND_TO_PRISMA: Record<SyncJobKind, PrismaKind> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: 'PRODUCTS_REFRESH',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: 'REPORTS_PERIOD',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: 'SALES_PLAN_PERIOD',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: 'ADVERTISING_CAMPAIGNS',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: 'ADVERTISING_STATS',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: 'ADVERTISING_CLUSTERS',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: 'STOCKS_CURRENT',
  [SYNC_JOB_KINDS.REVIEWS_REFRESH]: 'REVIEWS_REFRESH',
  [SYNC_JOB_KINDS.QUESTIONS_REFRESH]: 'QUESTIONS_REFRESH',
  [SYNC_JOB_KINDS.FBS_OPERATIONAL]: 'FBS_OPERATIONAL',
  [SYNC_JOB_KINDS.FBS_STOCKS_CURRENT]: 'FBS_STOCKS_CURRENT',
  [SYNC_JOB_KINDS.FBS_MARKING_REPORT]: 'FBS_MARKING_REPORT',
}

const PRISMA_TO_KIND = Object.fromEntries(
  Object.entries(KIND_TO_PRISMA).map(([kind, prismaKind]) => [prismaKind, kind]),
) as Record<PrismaKind, SyncJobKind>

function schedulerId(wbAccountId: string, kind: SyncJobKind) {
  return `sync:${kind}:${wbAccountId}`
}

function legacySchedulerId(wbAccountId: string, kind: SyncJobKind) {
  return `${LEGACY_SCHEDULER_IDS[kind]}:${wbAccountId}`
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

function buildJobData(wbAccountId: string, kind: SyncJobKind, rollingDays: number): SyncJobData {
  return {
    kind,
    source: 'scheduled',
    wbAccountId,
    rollingDays,
  } as SyncJobData
}

function getNextRunAt(
  timeOfDay: string,
  enabled: boolean,
  intervalMinutes: number | null,
): string | null {
  if (!enabled) return null
  if (intervalMinutes) return new Date(Date.now() + intervalMinutes * 60_000).toISOString()
  validateTimeOfDay(timeOfDay)
  return getNextMoscowRunAt(timeOfDay).toISOString()
}

export async function ensureDefaultSyncSchedules(wbAccountId: string) {
  for (const kind of SCHEDULED_SYNC_KINDS) {
    await prisma.syncScheduleSetting.upsert({
      where: { wbAccountId_kind: { wbAccountId, kind: KIND_TO_PRISMA[kind] } },
      create: {
        wbAccountId,
        kind: KIND_TO_PRISMA[kind],
        enabled: DEFAULT_ENABLED[kind],
        timeOfDay: DEFAULT_TIMES[kind],
        intervalMinutes: DEFAULT_INTERVALS[kind],
        rollingDays: DEFAULT_INTERVALS[kind] ? 1 : 7,
        timezone: TIMEZONE,
      },
      update: {},
    })
  }
}

export async function listSyncSchedules(wbAccountId: string): Promise<SyncScheduleRow[]> {
  await ensureDefaultSyncSchedules(wbAccountId)

  const rows = await prisma.syncScheduleSetting.findMany({
    where: { wbAccountId },
    orderBy: { timeOfDay: 'asc' },
  })

  const byKind = new Map(rows.map((row) => [PRISMA_TO_KIND[row.kind as PrismaKind], row]))

  return SCHEDULED_SYNC_KINDS.map((kind) => {
    const row = byKind.get(kind)
    const enabled = row?.enabled ?? DEFAULT_ENABLED[kind]
    const timeOfDay = row?.timeOfDay ?? DEFAULT_TIMES[kind]
    const intervalMinutes = row?.intervalMinutes ?? DEFAULT_INTERVALS[kind]
    return {
      id: row?.id ?? null,
      kind,
      enabled,
      timeOfDay,
      intervalMinutes,
      rollingDays: row?.rollingDays ?? (intervalMinutes ? 1 : 7),
      timezone: row?.timezone ?? TIMEZONE,
      lastAppliedAt: row?.lastAppliedAt?.toISOString() ?? null,
      nextRunAt: getNextRunAt(timeOfDay, enabled, intervalMinutes),
    }
  })
}

export async function applySyncSchedule(
  wbAccountId: string,
  kind: SyncJobKind,
): Promise<SyncScheduleRow> {
  const row = await prisma.syncScheduleSetting.findUniqueOrThrow({
    where: { wbAccountId_kind: { wbAccountId, kind: KIND_TO_PRISMA[kind] } },
  })

  const queue = await getSyncQueue()
  await queue.removeJobScheduler(legacySchedulerId(wbAccountId, kind)).catch(() => false)

  if (!row.enabled) {
    await queue.removeJobScheduler(schedulerId(wbAccountId, kind)).catch(() => false)
  } else {
    const repeat = row.intervalMinutes
      ? { every: row.intervalMinutes * 60_000 }
      : {
          pattern: patternFromTime(row.timeOfDay),
          tz: row.timezone,
        }
    await queue.upsertJobScheduler(
      schedulerId(wbAccountId, kind),
      repeat,
      {
        name: kind,
        data: buildJobData(wbAccountId, kind, row.rollingDays),
        opts: DEFAULT_SYNC_JOB_OPTIONS,
      },
    )
  }

  const updated = await prisma.syncScheduleSetting.update({
    where: { id: row.id },
    data: { lastAppliedAt: new Date() },
  })

  return {
    id: updated.id,
    kind,
    enabled: updated.enabled,
    timeOfDay: updated.timeOfDay,
    intervalMinutes: updated.intervalMinutes,
    rollingDays: updated.rollingDays,
    timezone: updated.timezone,
    lastAppliedAt: updated.lastAppliedAt?.toISOString() ?? null,
    nextRunAt: getNextRunAt(updated.timeOfDay, updated.enabled, updated.intervalMinutes),
  }
}

export async function removeAllSyncSchedulesForAccount(wbAccountId: string): Promise<void> {
  const queue = await getSyncQueue()
  for (const kind of SCHEDULED_SYNC_KINDS) {
    await queue.removeJobScheduler(schedulerId(wbAccountId, kind)).catch(() => false)
    await queue.removeJobScheduler(legacySchedulerId(wbAccountId, kind)).catch(() => false)
  }
}

export async function updateSyncSchedule(input: UpdateSyncScheduleInput): Promise<SyncScheduleRow> {
  if (!SCHEDULED_SYNC_KINDS.includes(input.kind)) {
    throw new Error('Этот тип синхронизации не запускается по расписанию')
  }
  if (input.intervalMinutes === null) validateTimeOfDay(input.timeOfDay)
  if (
    input.intervalMinutes !== null &&
    (!Number.isInteger(input.intervalMinutes) || input.intervalMinutes < 1 || input.intervalMinutes > 1_440)
  ) {
    throw new Error('Интервал должен быть от 1 до 1440 минут')
  }
  if (input.rollingDays < 1 || input.rollingDays > 30) {
    throw new Error('Период должен быть от 1 до 30 дней')
  }

  await prisma.wbAccount.findUniqueOrThrow({
    where: { id: input.wbAccountId },
    select: { id: true },
  })

  await prisma.syncScheduleSetting.upsert({
    where: { wbAccountId_kind: { wbAccountId: input.wbAccountId, kind: KIND_TO_PRISMA[input.kind] } },
    create: {
      wbAccountId: input.wbAccountId,
      kind: KIND_TO_PRISMA[input.kind],
      enabled: input.enabled,
      timeOfDay: input.timeOfDay,
      intervalMinutes: input.intervalMinutes,
      rollingDays: input.rollingDays,
      timezone: TIMEZONE,
    },
    update: {
      enabled: input.enabled,
      timeOfDay: input.timeOfDay,
      intervalMinutes: input.intervalMinutes,
      rollingDays: input.rollingDays,
      timezone: TIMEZONE,
    },
  })

  return applySyncSchedule(input.wbAccountId, input.kind)
}

export async function applyAllSyncSchedules() {
  const inactiveAccounts = await prisma.wbAccount.findMany({
    where: { isActive: false },
    select: { id: true },
  })

  for (const account of inactiveAccounts) {
    await removeAllSyncSchedulesForAccount(account.id)
  }

  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  let scheduled = 0
  for (const account of accounts) {
    await ensureDefaultSyncSchedules(account.id)
    const rows = await prisma.syncScheduleSetting.findMany({
      where: { wbAccountId: account.id },
    })

    for (const row of rows) {
      const kind = PRISMA_TO_KIND[row.kind as PrismaKind]
      if (!SCHEDULED_SYNC_KINDS.includes(kind)) continue
      await applySyncSchedule(account.id, kind)
      scheduled++
    }
  }

  return { accounts: accounts.length, scheduled }
}
