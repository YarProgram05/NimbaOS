import type { ConnectionOptions, JobsOptions, Processor, Queue, Worker } from 'bullmq'
import {
  SYNC_JOB_KINDS,
  type SyncJobKind,
  type SyncJobSource,
} from '@/types/sync'

export const SYNC_QUEUE_NAME = 'sync'

export { SYNC_JOB_KINDS, type SyncJobKind, type SyncJobSource }

interface SyncJobBase {
  kind: SyncJobKind
  source: SyncJobSource
  runId?: string
  wbAccountId?: string
  rollingDays?: number
}

export interface ProductsRefreshJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.PRODUCTS_REFRESH
  wbAccountId: string
}

export interface ReportsPeriodJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.REPORTS_PERIOD
  wbAccountId: string
  dateFrom?: string
  dateTo?: string
}

export interface SalesPlanPeriodJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.SALES_PLAN_PERIOD
  wbAccountId?: string
  planId?: string
  dateFrom?: string
  dateTo?: string
}

export interface AdvertisingCampaignsJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS
  wbAccountId: string
}

export interface AdvertisingStatsJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.ADVERTISING_STATS
  wbAccountId: string
  campaignId?: string
  advertId?: number
  dateFrom?: string
  dateTo?: string
}

export interface AdvertisingClustersJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.ADVERTISING_CLUSTERS
  wbAccountId: string
  campaignId: string
  advertId: number
  dateFrom: string
  dateTo: string
}

export interface StocksCurrentJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.STOCKS_CURRENT
  wbAccountId: string
}

export interface ReviewsRefreshJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.REVIEWS_REFRESH
  wbAccountId: string
  dateFrom?: string
  dateTo?: string
}

export interface QuestionsRefreshJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.QUESTIONS_REFRESH
  wbAccountId: string
  dateFrom?: string
  dateTo?: string
}

export interface FbsOperationalJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.FBS_OPERATIONAL
  wbAccountId: string
  dateFrom?: string
  dateTo?: string
}

export interface FbsStocksCurrentJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.FBS_STOCKS_CURRENT
  wbAccountId: string
}

export interface FbsMarkingReportJobData extends SyncJobBase {
  kind: typeof SYNC_JOB_KINDS.FBS_MARKING_REPORT
  wbAccountId: string
  dateFrom?: string
  dateTo?: string
}

export type SyncJobData =
  | ProductsRefreshJobData
  | ReportsPeriodJobData
  | SalesPlanPeriodJobData
  | AdvertisingCampaignsJobData
  | AdvertisingStatsJobData
  | AdvertisingClustersJobData
  | StocksCurrentJobData
  | ReviewsRefreshJobData
  | QuestionsRefreshJobData
  | FbsOperationalJobData
  | FbsStocksCurrentJobData
  | FbsMarkingReportJobData

export const DEFAULT_SYNC_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 60_000,
  },
  removeOnComplete: 500,
  removeOnFail: 500,
}

let syncQueue: Queue<SyncJobData> | null = null

export function getRedisConnection(): ConnectionOptions {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  }
}

export async function getSyncQueue(): Promise<Queue<SyncJobData>> {
  if (!syncQueue) {
    const { Queue } = await import('bullmq')
    syncQueue = new Queue<SyncJobData>(SYNC_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_SYNC_JOB_OPTIONS,
    })
  }

  return syncQueue
}

export async function createSyncWorker(
  processor: Processor<SyncJobData>,
): Promise<Worker<SyncJobData>> {
  const { Worker } = await import('bullmq')
  return new Worker<SyncJobData>(SYNC_QUEUE_NAME, processor, {
    connection: getRedisConnection(),
    concurrency: Number(process.env.SYNC_WORKER_CONCURRENCY ?? 1),
    lockDuration: Number(process.env.SYNC_WORKER_LOCK_DURATION_MS ?? 15 * 60_000),
    stalledInterval: Number(process.env.SYNC_WORKER_STALLED_INTERVAL_MS ?? 60_000),
  })
}

export { getSyncQueue as createQueue }
