import type { FlexibleSchedule } from '@/types/schedules'

export const SYNC_JOB_KINDS = {
  PRODUCTS_REFRESH: 'products.refresh',
  REPORTS_PERIOD: 'reports.period',
  SALES_PLAN_PERIOD: 'sales-plan.period',
  ADVERTISING_CAMPAIGNS: 'advertising.campaigns',
  ADVERTISING_STATS: 'advertising.stats',
  ADVERTISING_CLUSTERS: 'advertising.clusters',
  STOCKS_CURRENT: 'stocks.current',
  REVIEWS_REFRESH: 'reviews.refresh',
  QUESTIONS_REFRESH: 'questions.refresh',
  FBS_OPERATIONAL: 'fbs.operational',
  FBS_STOCKS_CURRENT: 'fbs.stocks.current',
  FBS_MARKING_REPORT: 'fbs.marking-report',
} as const

export type SyncJobKind = (typeof SYNC_JOB_KINDS)[keyof typeof SYNC_JOB_KINDS]
export type SyncJobSource = 'manual' | 'scheduled'

export type SyncJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface EnqueuedSyncJob {
  id: string
  kind: SyncJobKind
  status: SyncJobStatus
  bullJobId: string | null
}

export interface SyncJobRunRow {
  id: string
  kind: SyncJobKind
  status: SyncJobStatus
  wbAccountId: string | null
  wbAccountName: string | null
  source: SyncJobSource | null
  period: string | null
  bullJobId: string | null
  error: string | null
  attempts: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
}

export type SyncJobRunSortKey =
  | 'kind'
  | 'status'
  | 'wbAccountName'
  | 'createdAt'
  | 'attempts'
  | 'error'

export interface SyncJobRunQuery {
  page?: number
  pageSize?: number
  sortBy?: SyncJobRunSortKey
  sortDirection?: 'asc' | 'desc'
  kind?: SyncJobKind | 'ALL'
  status?: SyncJobStatus | 'ALL'
  wbAccountId?: string | 'ALL'
  source?: SyncJobSource | 'ALL'
  createdFrom?: string
  createdTo?: string
  error?: string
}

export interface SyncScheduleRow {
  id: string | null
  kind: SyncJobKind
  enabled: boolean
  timeOfDay: string
  intervalMinutes: number | null
  schedule: FlexibleSchedule
  rollingDays: number
  timezone: string
  lastAppliedAt: string | null
  nextRunAt: string | null
}

export interface UpdateSyncScheduleInput {
  wbAccountId: string
  kind: SyncJobKind
  enabled: boolean
  timeOfDay: string
  intervalMinutes: number | null
  schedule: FlexibleSchedule
  rollingDays: number
}
