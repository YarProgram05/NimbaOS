import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSyncQueue } from '@/lib/queue'
import {
  SYNC_JOB_KINDS,
  type SyncJobKind,
  type SyncJobRunRow,
  type SyncJobSource,
} from '@/types/sync'

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
}

const PRISMA_TO_KIND = Object.fromEntries(
  Object.entries(KIND_TO_PRISMA).map(([kind, prismaKind]) => [prismaKind, kind]),
) as Record<PrismaSyncJobKind, SyncJobKind>

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

export async function listSyncJobRuns(limit = 50): Promise<SyncJobRunRow[]> {
  const rows = await prisma.syncJobRun.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      wbAccount: {
        select: { name: true },
      },
    },
  })

  return rows.map((row) => ({
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
  }))
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
