import { prisma } from '@/lib/db'
import { DEFAULT_SYNC_JOB_OPTIONS, getSyncQueue, type SyncJobData } from '@/lib/queue'
import {
  SYNC_JOB_KINDS,
  type SyncJobKind,
  type SyncScheduleRow,
  type UpdateSyncScheduleInput,
} from '@/types/sync'

const TIMEZONE = 'Europe/Moscow'

export const SCHEDULED_SYNC_KINDS: SyncJobKind[] = [
  SYNC_JOB_KINDS.PRODUCTS_REFRESH,
  SYNC_JOB_KINDS.REPORTS_PERIOD,
  SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
  SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS,
  SYNC_JOB_KINDS.ADVERTISING_STATS,
  SYNC_JOB_KINDS.STOCKS_CURRENT,
]

const DEFAULT_TIMES: Record<SyncJobKind, string> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: '02:00',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: '02:30',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: '03:30',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: '04:30',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: '05:00',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: '00:00',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: '05:30',
}

const LEGACY_SCHEDULER_IDS: Record<SyncJobKind, string> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: 'products-nightly',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: 'reports-nightly',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: 'sales-plan-nightly',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: 'advertising-campaigns-nightly',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: 'advertising-stats-nightly',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: 'advertising-clusters-nightly',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: 'stocks-current-nightly',
}

type PrismaKind =
  | 'PRODUCTS_REFRESH'
  | 'REPORTS_PERIOD'
  | 'SALES_PLAN_PERIOD'
  | 'ADVERTISING_CAMPAIGNS'
  | 'ADVERTISING_STATS'
  | 'ADVERTISING_CLUSTERS'
  | 'STOCKS_CURRENT'

const KIND_TO_PRISMA: Record<SyncJobKind, PrismaKind> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: 'PRODUCTS_REFRESH',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: 'REPORTS_PERIOD',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: 'SALES_PLAN_PERIOD',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: 'ADVERTISING_CAMPAIGNS',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: 'ADVERTISING_STATS',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: 'ADVERTISING_CLUSTERS',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: 'STOCKS_CURRENT',
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

export async function ensureDefaultSyncSchedules(wbAccountId: string) {
  for (const kind of SCHEDULED_SYNC_KINDS) {
    await prisma.syncScheduleSetting.upsert({
      where: { wbAccountId_kind: { wbAccountId, kind: KIND_TO_PRISMA[kind] } },
      create: {
        wbAccountId,
        kind: KIND_TO_PRISMA[kind],
        enabled: true,
        timeOfDay: DEFAULT_TIMES[kind],
        rollingDays: 7,
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
    const enabled = row?.enabled ?? true
    const timeOfDay = row?.timeOfDay ?? DEFAULT_TIMES[kind]
    return {
      id: row?.id ?? null,
      kind,
      enabled,
      timeOfDay,
      rollingDays: row?.rollingDays ?? 7,
      timezone: row?.timezone ?? TIMEZONE,
      lastAppliedAt: row?.lastAppliedAt?.toISOString() ?? null,
      nextRunAt: getNextRunAt(timeOfDay, enabled),
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
    const nextRunAt = getNextRunAt(row.timeOfDay, row.enabled)
    await queue.upsertJobScheduler(
      schedulerId(wbAccountId, kind),
      {
        pattern: patternFromTime(row.timeOfDay),
        tz: row.timezone,
        startDate: nextRunAt ? new Date(nextRunAt).getTime() : undefined,
      },
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
    rollingDays: updated.rollingDays,
    timezone: updated.timezone,
    lastAppliedAt: updated.lastAppliedAt?.toISOString() ?? null,
    nextRunAt: getNextRunAt(updated.timeOfDay, updated.enabled),
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
  validateTimeOfDay(input.timeOfDay)
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
      rollingDays: input.rollingDays,
      timezone: TIMEZONE,
    },
    update: {
      enabled: input.enabled,
      timeOfDay: input.timeOfDay,
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
