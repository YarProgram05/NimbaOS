import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSyncQueue } from '@/lib/queue'
import {
  SYNC_JOB_KINDS,
  type SyncJobKind,
  type SyncJobRunQuery,
  type SyncJobRunRow,
  type SyncJobSource,
} from '@/types/sync'
import {
  normalizeRunHistoryPageSize,
  type RunHistoryPage,
  type RunHistorySortDirection,
} from '@/types/run-history'

export type PrismaSyncJobKind =
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

const KIND_TO_PRISMA: Record<SyncJobKind, PrismaSyncJobKind> = {
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
) as Record<PrismaSyncJobKind, SyncJobKind>

const SYNC_JOB_KIND_VALUES = new Set<SyncJobKind>(Object.values(SYNC_JOB_KINDS))
const SYNC_JOB_STATUS_VALUES = new Set(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'])
const SYNC_JOB_SOURCE_VALUES = new Set(['manual', 'scheduled'])

export function toPrismaSyncJobKind(kind: SyncJobKind): PrismaSyncJobKind {
  return KIND_TO_PRISMA[kind]
}

export function toSyncJobPayloadJson(payload: unknown): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue
}

function getPeriodFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as { dateFrom?: unknown; dateTo?: unknown; rollingDays?: unknown }
  if (typeof data.dateFrom === 'string' && typeof data.dateTo === 'string') {
    return `${data.dateFrom} - ${data.dateTo}`
  }
  if (typeof data.rollingDays === 'number') {
    return `last ${data.rollingDays} days`
  }
  return null
}

function getSourceFromPayload(payload: unknown): SyncJobSource | null {
  if (!payload || typeof payload !== 'object') return null
  const source = (payload as { source?: unknown }).source
  return source === 'manual' || source === 'scheduled' ? source : null
}

function parseMoscowDay(value: string | undefined, endExclusive = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00+03:00`)
  if (Number.isNaN(date.getTime())) return undefined
  if (endExclusive) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function getSyncRunOrderBy(
  sortBy: SyncJobRunQuery['sortBy'],
  direction: RunHistorySortDirection,
): Prisma.SyncJobRunOrderByWithRelationInput[] {
  const primary: Prisma.SyncJobRunOrderByWithRelationInput = (() => {
    switch (sortBy) {
      case 'kind': return { kind: direction }
      case 'status': return { status: direction }
      case 'wbAccountName': return { wbAccount: { name: direction } }
      case 'attempts': return { attempts: direction }
      case 'error': return { error: direction }
      default: return { createdAt: direction }
    }
  })()

  return [primary, { createdAt: 'desc' }, { id: 'desc' }]
}

function getSyncRunWhere(query: SyncJobRunQuery): Prisma.SyncJobRunWhereInput {
  const createdFrom = parseMoscowDay(query.createdFrom)
  const createdTo = parseMoscowDay(query.createdTo, true)
  const error = query.error?.trim()

  return {
    ...(query.kind && query.kind !== 'ALL' && SYNC_JOB_KIND_VALUES.has(query.kind)
      ? { kind: toPrismaSyncJobKind(query.kind) }
      : {}),
    ...(query.status && query.status !== 'ALL' && SYNC_JOB_STATUS_VALUES.has(query.status)
      ? { status: query.status }
      : {}),
    ...(query.wbAccountId && query.wbAccountId !== 'ALL' ? { wbAccountId: query.wbAccountId } : {}),
    ...(query.source && query.source !== 'ALL' && SYNC_JOB_SOURCE_VALUES.has(query.source)
      ? { payload: { path: ['source'], equals: query.source } }
      : {}),
    ...(createdFrom || createdTo
      ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lt: createdTo } : {}) } }
      : {}),
    ...(error ? { error: { contains: error, mode: 'insensitive' } } : {}),
  }
}

export async function listSyncJobRuns(
  query: SyncJobRunQuery = {},
): Promise<RunHistoryPage<SyncJobRunRow>> {
  const pageSize = normalizeRunHistoryPageSize(query.pageSize)
  const requestedPage = Number.isFinite(query.page)
    ? Math.max(1, Math.trunc(query.page as number))
    : 1
  const sortDirection: RunHistorySortDirection = query.sortDirection === 'asc' ? 'asc' : 'desc'
  const where = getSyncRunWhere(query)
  const total = await prisma.syncJobRun.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const rows = await prisma.syncJobRun.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: getSyncRunOrderBy(query.sortBy ?? 'createdAt', sortDirection),
    include: {
      wbAccount: {
        select: { name: true },
      },
    },
  })

  return {
    rows: rows.map((row) => ({
      id: row.id,
      kind: PRISMA_TO_KIND[row.kind as PrismaSyncJobKind],
      status: row.status as SyncJobRunRow['status'],
      wbAccountId: row.wbAccountId,
      wbAccountName: row.wbAccount?.name ?? null,
      source: getSourceFromPayload(row.payload),
      period: getPeriodFromPayload(row.payload),
      bullJobId: row.bullJobId,
      error: row.error,
      attempts: row.attempts,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      durationMs: row.startedAt && row.finishedAt
        ? row.finishedAt.getTime() - row.startedAt.getTime()
        : null,
    })),
    total,
    page,
    pageSize,
  }
}

export async function deleteSyncJobRun(id: string): Promise<void> {
  const run = await prisma.syncJobRun.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      bullJobId: true,
    },
  })

  if (!run) {
    throw new Error('Задача не найдена')
  }

  if (run.status === 'RUNNING') {
    throw new Error('Нельзя удалить задачу, которая выполняется прямо сейчас')
  }

  if (run.bullJobId) {
    const queue = await getSyncQueue()
    const job = await queue.getJob(run.bullJobId)

    if (job) {
      await job.remove()
    }
  }

  await prisma.syncJobRun.delete({
    where: { id: run.id },
  })
}
