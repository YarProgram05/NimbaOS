import type { Job } from 'bullmq'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { syncProducts } from '@/lib/services/sync-products'
import { syncRealizationReport } from '@/lib/services/sync-reports'
import { syncPaidStorage } from '@/lib/services/sync-paid-storage'
import { syncOrders } from '@/lib/services/sync-orders'
import { syncSales } from '@/lib/services/sync-sales'
import { syncFunnel } from '@/lib/services/sync-funnel'
import { syncAdCampaigns } from '@/lib/services/sync-ad-campaigns'
import { syncAdStats } from '@/lib/services/sync-ad-stats'
import { syncAdClusters } from '@/lib/services/sync-ad-clusters'
import { syncStocksCurrent } from '@/lib/services/sync-stocks'
import { syncQuestions, syncReviews } from '@/lib/services/sync-feedback'
import { DEFAULT_SYNC_JOB_OPTIONS, SYNC_JOB_KINDS, getSyncQueue, type SyncJobData } from '@/lib/queue'
import { createRunForBullJob } from '@/lib/queue/sync-jobs'
import { WbRateLimitError } from '@/lib/wb-api/client'
import { markSyncCoverage } from '@/lib/sync/coverage'

class SyncSubtaskError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncSubtaskError'
  }
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

const KIND_TO_PRISMA: Record<string, PrismaKind> = {
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

const SCHEDULED_START_GRACE_MINUTES = 10

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

function toMoscowDate(value: Date): Date {
  const utcMs = value.getTime() + value.getTimezoneOffset() * 60_000
  return new Date(utcMs + 3 * 60 * 60_000)
}

function minutesSinceScheduledTime(timeOfDay: string, now = new Date()): number {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const moscowNow = toMoscowDate(now)
  const scheduled = new Date(moscowNow)
  scheduled.setHours(hours, minutes, 0, 0)
  if (scheduled > moscowNow) scheduled.setDate(scheduled.getDate() - 1)
  return Math.floor((moscowNow.getTime() - scheduled.getTime()) / 60_000)
}

async function shouldSkipScheduledJob(data: SyncJobData): Promise<string | null> {
  if (data.source !== 'scheduled' || !data.wbAccountId) return null

  const prismaKind = KIND_TO_PRISMA[data.kind]
  if (!prismaKind) return null

  const schedule = await prisma.syncScheduleSetting.findUnique({
    where: {
      wbAccountId_kind: {
        wbAccountId: data.wbAccountId,
        kind: prismaKind,
      },
    },
    select: {
      enabled: true,
      timeOfDay: true,
    },
  })

  if (!schedule?.enabled) return 'scheduled job is disabled'

  const lateMinutes = minutesSinceScheduledTime(schedule.timeOfDay)
  if (lateMinutes > SCHEDULED_START_GRACE_MINUTES) {
    return `scheduled job is ${lateMinutes} minutes late`
  }

  return null
}

function resolvePeriod(data: { dateFrom?: string; dateTo?: string; rollingDays?: number }) {
  if (data.dateFrom && data.dateTo) {
    return { dateFrom: data.dateFrom, dateTo: data.dateTo }
  }

  const rollingDays = data.rollingDays ?? 7
  const today = new Date()
  const end = parseDate(formatDate(today))
  const start = addDays(end, -(rollingDays - 1))

  return {
    dateFrom: formatDate(start),
    dateTo: formatDate(end),
  }
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right
}

function minDate(left: Date, right: Date): Date {
  return left < right ? left : right
}

async function runReportsJob(data: Extract<SyncJobData, { kind: typeof SYNC_JOB_KINDS.REPORTS_PERIOD }>) {
  const { dateFrom, dateTo } = resolvePeriod(data)
  const report = await syncRealizationReport(data.wbAccountId, dateFrom, dateTo)
  const storage = await syncPaidStorage(data.wbAccountId, dateFrom, dateTo)
  if (report.maxReportDate && report.maxReportDate >= dateFrom) {
    await markSyncCoverage(
      data.wbAccountId,
      SYNC_JOB_KINDS.REPORTS_PERIOD,
      dateFrom,
      report.maxReportDate < dateTo ? report.maxReportDate : dateTo,
    )
  }

  await prisma.wbAccount.update({
    where: { id: data.wbAccountId },
    data: { lastSyncAt: new Date() },
  })

  return {
    period: { dateFrom, dateTo },
    report,
    paidStorage: storage,
  }
}

async function runOnePlan(plan: {
  id: string
  wbAccountId: string
  dateFrom: Date
  dateTo: Date
  items: Array<{ nmId: number }>
}, requested: { dateFrom?: string; dateTo?: string; rollingDays?: number }) {
  const period = resolvePeriod(requested)
  const requestedFrom = parseDate(period.dateFrom)
  const requestedTo = parseDate(period.dateTo)
  const dateFrom = maxDate(plan.dateFrom, requestedFrom)
  const dateTo = minDate(plan.dateTo, requestedTo)

  if (dateFrom > dateTo) {
    return {
      planId: plan.id,
      skipped: true,
      reason: 'period outside plan range',
    }
  }

  const from = formatDate(dateFrom)
  const to = formatDate(dateTo)
  const nmIds = Array.from(new Set(plan.items.map((item) => item.nmId)))
  const orders = await syncOrders(plan.wbAccountId, from)
  const sales = await syncSales(plan.wbAccountId, from)
  const funnel = await syncFunnel(plan.wbAccountId, nmIds, from, to)

  return {
    planId: plan.id,
    period: { dateFrom: from, dateTo: to },
    orders,
    sales,
    funnel,
  }
}

async function runSalesPlanJob(data: Extract<SyncJobData, { kind: typeof SYNC_JOB_KINDS.SALES_PLAN_PERIOD }>) {
  const plans = data.planId
    ? await prisma.salesPlan.findMany({
        where: { id: data.planId },
        select: {
          id: true,
          wbAccountId: true,
          dateFrom: true,
          dateTo: true,
          items: { select: { nmId: true } },
        },
      })
    : await prisma.salesPlan.findMany({
        where: {
          ...(data.wbAccountId ? { wbAccountId: data.wbAccountId } : {}),
          dateTo: { gte: parseDate(resolvePeriod(data).dateFrom) },
        },
        select: {
          id: true,
          wbAccountId: true,
          dateFrom: true,
          dateTo: true,
          items: { select: { nmId: true } },
        },
      })

  const results = []
  for (const plan of plans) {
    results.push(await runOnePlan(plan, data))
  }

  return {
    plans: results,
  }
}

async function runAdvertisingStatsJob(data: Extract<SyncJobData, { kind: typeof SYNC_JOB_KINDS.ADVERTISING_STATS }>) {
  const { dateFrom, dateTo } = resolvePeriod(data)
  const campaigns = data.campaignId && data.advertId
    ? [{ id: data.campaignId, advertId: data.advertId }]
    : await prisma.adCampaign.findMany({
        where: { wbAccountId: data.wbAccountId },
        select: { id: true, advertId: true },
        orderBy: { updatedAt: 'desc' },
      })

  const results = []
  for (const campaign of campaigns) {
    results.push({
      campaignId: campaign.id,
      advertId: campaign.advertId,
      result: await syncAdStats({
        wbAccountId: data.wbAccountId,
        campaignId: campaign.id,
        advertId: campaign.advertId,
        dateFrom,
        dateTo,
      }),
    })
  }

  return {
    period: { dateFrom, dateTo },
    campaigns: results,
  }
}

async function processSyncJobData(data: SyncJobData) {
  switch (data.kind) {
    case SYNC_JOB_KINDS.PRODUCTS_REFRESH:
      return syncProducts(data.wbAccountId)
    case SYNC_JOB_KINDS.REPORTS_PERIOD:
      return runReportsJob(data)
    case SYNC_JOB_KINDS.SALES_PLAN_PERIOD:
      return runSalesPlanJob(data)
    case SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS:
      return syncAdCampaigns(data.wbAccountId)
    case SYNC_JOB_KINDS.ADVERTISING_STATS:
      return runAdvertisingStatsJob(data)
    case SYNC_JOB_KINDS.ADVERTISING_CLUSTERS:
      return syncAdClusters(
        data.wbAccountId,
        data.campaignId,
        data.advertId,
        data.dateFrom,
        data.dateTo,
      )
    case SYNC_JOB_KINDS.STOCKS_CURRENT:
      return syncStocksCurrent(data.wbAccountId)
    case SYNC_JOB_KINDS.REVIEWS_REFRESH: {
      const { dateFrom, dateTo } = resolvePeriod(data)
      const result = await syncReviews(data.wbAccountId, { dateFrom, dateTo })
      await markSyncCoverage(data.wbAccountId, SYNC_JOB_KINDS.REVIEWS_REFRESH, dateFrom, dateTo)
      return result
    }
    case SYNC_JOB_KINDS.QUESTIONS_REFRESH: {
      const { dateFrom, dateTo } = resolvePeriod(data)
      const result = await syncQuestions(data.wbAccountId, { dateFrom, dateTo })
      await markSyncCoverage(data.wbAccountId, SYNC_JOB_KINDS.QUESTIONS_REFRESH, dateFrom, dateTo)
      return result
    }
  }
}

function collectInternalErrors(value: unknown, path = 'result'): string[] {
  if (!value || typeof value !== 'object') return []

  const entries = Object.entries(value as Record<string, unknown>)
  const errors: string[] = []

  for (const [key, nested] of entries) {
    const nextPath = `${path}.${key}`
    if (key.toLowerCase().endsWith('errors') && typeof nested === 'number' && nested > 0) {
      errors.push(`${nextPath}=${nested}`)
      continue
    }

    if (Array.isArray(nested)) {
      nested.forEach((item, index) => {
        errors.push(...collectInternalErrors(item, `${nextPath}[${index}]`))
      })
      continue
    }

    errors.push(...collectInternalErrors(nested, nextPath))
  }

  return errors
}

function assertNoInternalErrors(result: unknown) {
  const errors = collectInternalErrors(result)
  if (errors.length > 0) {
    throw new SyncSubtaskError(`Синхронизация завершилась с внутренними ошибками: ${errors.join(', ')}`)
  }
}

export async function processSyncJob(job: Job<SyncJobData>) {
  const skipReason = await shouldSkipScheduledJob(job.data)
  if (skipReason) {
    return {
      skippedScheduledJob: true,
      reason: skipReason,
      kind: job.data.kind,
      wbAccountId: job.data.wbAccountId ?? null,
    }
  }

  const existingRunId = job.data.runId
  const run = existingRunId
    ? await prisma.syncJobRun.update({
        where: { id: existingRunId },
        data: {
          status: 'RUNNING',
          bullJobId: String(job.id ?? ''),
          attempts: job.attemptsMade + 1,
          startedAt: new Date(),
          finishedAt: null,
          error: null,
        },
      })
    : await createRunForBullJob(job.data, job.id ? String(job.id) : undefined)

  if (!existingRunId) {
    await prisma.syncJobRun.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING',
        attempts: job.attemptsMade + 1,
        startedAt: new Date(),
        finishedAt: null,
      },
    })
  }

  try {
    const result = await processSyncJobData(job.data)
    assertNoInternalErrors(result)
    await prisma.syncJobRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        result: result as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error'
    if (error instanceof WbRateLimitError) {
      const retryAfterSec = Math.max(error.retryAfterSec ?? 60, 5)
      const retryAt = new Date(Date.now() + retryAfterSec * 1000 + 5000)
      const queue = await getSyncQueue()
      const retryJob = await queue.add(
        job.data.kind,
        { ...job.data, runId: run.id },
        {
          ...DEFAULT_SYNC_JOB_OPTIONS,
          delay: retryAt.getTime() - Date.now(),
        },
      )

      await prisma.syncJobRun.update({
        where: { id: run.id },
        data: {
          status: 'QUEUED',
          bullJobId: String(retryJob.id ?? '') || null,
          error: `${message}. Повтор запланирован на ${retryAt.toISOString()}`,
          finishedAt: null,
        },
      })

      return {
        delayedDueRateLimit: true,
        retryAt: retryAt.toISOString(),
        message,
      }
    }

    await prisma.syncJobRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        error: message,
        finishedAt: new Date(),
      },
    })
    throw error
  }
}
