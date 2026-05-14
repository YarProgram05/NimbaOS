import { prisma } from '@/lib/db'
import { SYNC_JOB_KINDS, type SyncJobKind } from '@/types/sync'

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
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export async function markSyncCoverage(
  wbAccountId: string,
  kind: SyncJobKind,
  dateFrom: string,
  dateTo: string,
) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  const prismaKind = KIND_TO_PRISMA[kind]
  const overlapping = await prisma.syncDataCoverage.findMany({
    where: {
      wbAccountId,
      kind: prismaKind,
      dateFrom: { lte: addDays(to, 1) },
      dateTo: { gte: addDays(from, -1) },
    },
  })

  const mergedFrom = overlapping.reduce(
    (min, row) => (row.dateFrom < min ? row.dateFrom : min),
    from,
  )
  const mergedTo = overlapping.reduce(
    (max, row) => (row.dateTo > max ? row.dateTo : max),
    to,
  )

  await prisma.$transaction(async (tx) => {
    if (overlapping.length > 0) {
      await tx.syncDataCoverage.deleteMany({
        where: { id: { in: overlapping.map((row) => row.id) } },
      })
    }

    await tx.syncDataCoverage.create({
      data: {
        wbAccountId,
        kind: prismaKind,
        dateFrom: mergedFrom,
        dateTo: mergedTo,
        syncedAt: new Date(),
      },
    })
  })
}

export async function getSyncCoverage(
  wbAccountId: string,
  kind: SyncJobKind,
  dateFrom: string,
  dateTo: string,
) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  const prismaKind = KIND_TO_PRISMA[kind]
  const coverages = await prisma.syncDataCoverage.findMany({
    where: {
      wbAccountId,
      kind: prismaKind,
      dateTo: { gte: from },
      dateFrom: { lte: to },
    },
    orderBy: { dateFrom: 'asc' },
  })

  let cursor = from
  let syncedAt: Date | null = null

  for (const coverage of coverages) {
    if (coverage.dateFrom > cursor) {
      return { isCovered: false, syncedAt: syncedAt?.toISOString() ?? null }
    }
    if (!syncedAt || coverage.syncedAt > syncedAt) syncedAt = coverage.syncedAt
    if (coverage.dateTo >= to) {
      return { isCovered: true, syncedAt: (syncedAt ?? coverage.syncedAt).toISOString() }
    }
    cursor = addDays(coverage.dateTo, 1)
  }

  return {
    isCovered: false,
    syncedAt: syncedAt?.toISOString() ?? null,
    checkedRange: `${formatDate(from)} - ${formatDate(to)}`,
  }
}
