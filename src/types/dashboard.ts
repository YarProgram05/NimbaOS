import type { SyncJobKind, SyncJobStatus } from '@/types/sync'

export type DashboardPeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'currentMonth'
  | 'previousMonth'
  | 'custom'

export type DashboardMetricUnit = 'rub' | 'percent' | 'count'
export type DashboardValueStatus = 'ready' | 'partial' | 'missing' | 'not_applicable'
export type DashboardComputeMode = 'on_demand'

export interface DashboardPeriod {
  preset: DashboardPeriodPreset
  dateFrom: string
  dateTo: string
  label: string
  days: number
}

export interface DashboardMetric {
  label: string
  value: number | null
  previousValue: number | null
  changePercent: number | null
  unit: DashboardMetricUnit
  status: DashboardValueStatus
  source: string
  hint: string | null
}

export interface DashboardAccount {
  id: string
  name: string
  sellerName: string | null
  lastSyncAt: string | null
}

export interface DashboardProductSnapshot {
  nmId: number
  vendorCode: string
  brandName: string
  subjectName: string
  photoUrl: string | null
  revenue: number
  operatingProfit: number
  marginality: number
  drr: number
  returns: number
  status: DashboardValueStatus
}

export interface DashboardPlanSummary {
  status: DashboardValueStatus
  activePlans: number
  plannedUnits: number | null
  factUnits: number | null
  plannedRevenue: number | null
  factRevenue: number | null
  progressPercent: number | null
  source: string
  hint: string | null
}

export interface DashboardAdvertisingSummary {
  status: DashboardValueStatus
  spend: number | null
  views: number | null
  clicks: number | null
  orders: number | null
  cartAdds: number | null
  ctr: number | null
  cpc: number | null
  drr: number | null
  campaigns: number
  source: string
  hint: string | null
}

export interface DashboardFreshnessItem {
  key: string
  label: string
  status: DashboardValueStatus
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastCoverageSyncedAt: string | null
  activeJobs: number
  failedJobs: number
  source: SyncJobKind | 'products'
  hint: string | null
}

export interface DashboardSourceMapping {
  widget: string
  sources: string[]
  fallback: string
}

export interface DashboardSummary {
  account: DashboardAccount
  period: DashboardPeriod
  comparisonPeriod: DashboardPeriod
  generatedAt: string
  computeMode: DashboardComputeMode
  kpis: {
    revenue: DashboardMetric
    operatingProfit: DashboardMetric
    marginality: DashboardMetric
    drr: DashboardMetric
    orders: DashboardMetric
    returns: DashboardMetric
  }
  plan: DashboardPlanSummary
  advertising: DashboardAdvertisingSummary
  products: {
    status: DashboardValueStatus
    topProfit: DashboardProductSnapshot[]
    topRevenue: DashboardProductSnapshot[]
    risks: DashboardProductSnapshot[]
    source: string
    hint: string | null
  }
  freshness: {
    activeJobs: number
    failedJobs: number
    items: DashboardFreshnessItem[]
  }
  sourceMap: DashboardSourceMapping[]
}

export interface DashboardSummaryRequest {
  accountId?: string | null
  period?: DashboardPeriodPreset | null
  dateFrom?: string | null
  dateTo?: string | null
}

export interface DashboardSyncJobSnapshot {
  kind: SyncJobKind
  status: SyncJobStatus
  createdAt: Date
  finishedAt: Date | null
}
