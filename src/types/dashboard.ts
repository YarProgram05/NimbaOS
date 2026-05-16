import type { SyncJobKind, SyncJobStatus } from '@/types/sync'
import type { StocksSummary } from '@/types/stocks'
import type { FeedbackSummary } from '@/types/feedback'

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
export type DashboardForecastConfidence = 'low' | 'medium'
export type DashboardIssueCategory =
  | 'sync_failed'
  | 'data_stale'
  | 'missing_cost_price'
  | 'no_recent_report_data'
  | 'high_drr'
  | 'negative_margin'
  | 'high_logistics_share'
  | 'high_storage_share'
  | 'high_return_rate'
  | 'inefficient_campaign'
  | 'campaign_without_recent_stats'
  | 'product_without_stock_data'
  | 'unanswered_review_question'
  | 'low_stock'
  | 'out_of_stock'

export type ActionRecommendationCategory =
  | DashboardIssueCategory
  | 'overstock'
  | 'no_demand'
  | 'plan_adjustment'

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
  toTransfer: number
  operatingProfit: number
  marginality: number
  rentability: number
  drr: number
  logistics: number
  logisticsShare: number
  storage: number
  storageShare: number
  costPrice: number
  returns: number
  returnRate: number
  status: DashboardValueStatus
}

export interface DashboardFinancialBreakdown {
  status: DashboardValueStatus
  revenue: number | null
  toTransfer: number | null
  operatingProfit: number | null
  marginality: number | null
  rentability: number | null
  taxes: number | null
  logistics: number | null
  storage: number | null
  penalties: number | null
  acceptance: number | null
  paidStorage: number | null
  selfPurchases: number | null
  externalAds: number | null
  wbAds: number | null
  returnAmount: number | null
  returnCount: number | null
  returnRate: number | null
  source: string
  hint: string | null
}

export interface DashboardSalesAnalytics {
  status: DashboardValueStatus
  orders: number | null
  sales: number | null
  returns: number | null
  cancellations: number | null
  buyoutPercent: number | null
  averagePrice: number | null
  funnel: {
    openCount: number | null
    addToCartCount: number | null
    cartCount: number | null
    ordersCount: number | null
    addToCartConversion: number | null
    cartToOrderConversion: number | null
  }
  source: string
  hint: string | null
}

export interface DashboardAdvertisingCampaignSnapshot {
  id: string
  advertId: number
  name: string
  status: number
  spend: number
  views: number
  clicks: number
  orders: number
  cartAdds: number
  ctr: number
  cpc: number
  lastStatDate: string | null
  statusText: DashboardValueStatus
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
  spendWithoutOrders: number | null
  inefficientCampaigns: DashboardAdvertisingCampaignSnapshot[]
  campaignsWithoutRecentStats: DashboardAdvertisingCampaignSnapshot[]
  source: string
  hint: string | null
}

export interface DashboardFreshnessItem {
  key: string
  label: string
  status: DashboardValueStatus
  severity: DashboardIssueSeverity
  isStale: boolean
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastFailedAt: string | null
  lastError: string | null
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

export interface DashboardForecastMetric {
  label: string
  status: DashboardValueStatus
  value: number | null
  projectedValue: number | null
  dailyAverage: number | null
  unit: DashboardMetricUnit
  confidence: DashboardForecastConfidence | null
  horizonDate: string | null
  source: string
  hint: string | null
}

export interface DashboardPlanForecast {
  status: DashboardValueStatus
  plannedUnits: number | null
  factUnits: number | null
  forecastUnits: number | null
  forecastCompletionPercent: number | null
  currentDailyUnits: number | null
  requiredDailyUnits: number | null
  unitsNeeded: number | null
  confidence: DashboardForecastConfidence | null
  horizonDate: string | null
  source: string
  hint: string | null
}

export interface DashboardStockForecastProduct {
  nmId: number
  vendorCode: string
  title: string | null
  quantity: number
  daysUntilZero: number | null
  stockNeeded: number | null
}

export interface DashboardStockForecast {
  status: DashboardValueStatus
  lowStockCount: number
  outOfStockCount: number
  overstockCount: number
  noDemandCount: number
  earliestDaysUntilZero: number | null
  stockNeeded: number | null
  productsAtRisk: DashboardStockForecastProduct[]
  confidence: DashboardForecastConfidence | null
  horizonDate: string | null
  source: string
  hint: string | null
}

export interface DashboardForecasts {
  revenue: DashboardForecastMetric
  operatingProfit: DashboardForecastMetric
  advertisingSpend: DashboardForecastMetric
  planCompletion: DashboardPlanForecast
  stockDepletion: DashboardStockForecast
  dailySalesPace: DashboardForecastMetric
  unitsNeeded: DashboardForecastMetric
  stockNeeded: DashboardForecastMetric
  productsRequiringPlanAdjustment: DashboardProductSnapshot[]
}

export interface ActionRecommendation {
  id: string
  severity: DashboardIssueSeverity
  category: ActionRecommendationCategory
  title: string
  description: string
  metric: string | null
  href: string
  createdAt: string
}

export interface DashboardSourceMapping {
  widget: string
  sources: string[]
  fallback: string
}

export interface DashboardOverviewTrendPoint {
  label: string
  dateFrom: string
  dateTo: string
  revenue: number | null
  operatingProfit: number | null
  orders: number | null
  buyouts: number | null
  adSpend: number | null
  status: DashboardValueStatus
}

export interface DashboardOverviewDistributionItem {
  key: string
  label: string
  value: number
  status: DashboardValueStatus
  tone: 'positive' | 'neutral' | 'warning' | 'critical'
}

export interface DashboardOverviewCharts {
  granularity: 'day' | 'week'
  trend: DashboardOverviewTrendPoint[]
  finance: DashboardOverviewDistributionItem[]
  dataQuality: DashboardOverviewDistributionItem[]
  risks: DashboardOverviewDistributionItem[]
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
    buyouts: DashboardMetric
  }
  financialBreakdown: DashboardFinancialBreakdown
  salesAnalytics: DashboardSalesAnalytics
  plan: DashboardPlanSummary
  advertising: DashboardAdvertisingSummary
  stocks: StocksSummary
  feedback: FeedbackSummary
  forecasts: DashboardForecasts
  recommendations: ActionRecommendation[]
  overviewCharts: DashboardOverviewCharts
  products: {
    status: DashboardValueStatus
    topProfit: DashboardProductSnapshot[]
    topRevenue: DashboardProductSnapshot[]
    risks: DashboardProductSnapshot[]
    negativeProfit: DashboardProductSnapshot[]
    highLogisticsShare: DashboardProductSnapshot[]
    highStorageShare: DashboardProductSnapshot[]
    missingCostPrice: DashboardProductSnapshot[]
    highReturnRate: DashboardProductSnapshot[]
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
