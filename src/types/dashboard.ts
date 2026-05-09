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
export type DashboardIssueSeverity = 'info' | 'warning' | 'critical'
export type DashboardIssueCategory =
  | 'sync_failed'
  | 'data_stale'
  | 'missing_cost_price'
  | 'no_recent_report_data'
  | 'high_drr'
  | 'negative_margin'
  | 'product_without_stock_data'
  | 'unanswered_review_question'
  | 'low_stock'
  | 'out_of_stock'

export type DashboardFreshnessDomain =
  | SyncJobKind
  | 'products'
  | 'stocks'
  | 'reviews'
  | 'questions'

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
  severity: DashboardIssueSeverity
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastCoverageSyncedAt: string | null
  checkedFrom: string | null
  checkedTo: string | null
  staleAfterHours: number | null
  activeJobs: number
  failedJobs: number
  source: DashboardFreshnessDomain
  href: string
  implemented: boolean
  hint: string | null
}

export interface DataFreshnessStatus {
  activeJobs: number
  failedJobs: number
  criticalCount: number
  warningCount: number
  items: DashboardFreshnessItem[]
}

export interface DashboardIssue {
  id: string
  category: DashboardIssueCategory
  severity: DashboardIssueSeverity
  title: string
  description: string
  href: string
  source: string
  metricLabel: string | null
  metricValue: string | null
  entityId: string | null
  entityLabel: string | null
  createdAt: string
}

export interface DashboardInsight {
  id: string
  severity: DashboardIssueSeverity
  category: DashboardIssueCategory
  title: string
  description: string
  metric: string | null
  href: string
  issueIds: string[]
  createdAt: string
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
    criticalCount: number
    warningCount: number
    items: DashboardFreshnessItem[]
  }
  problemCenter: {
    status: DashboardValueStatus
    criticalCount: number
    warningCount: number
    infoCount: number
    issues: DashboardIssue[]
    insights: DashboardInsight[]
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
