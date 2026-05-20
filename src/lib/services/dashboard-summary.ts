import { prisma } from '@/lib/db'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { buildDashboardProblemCenter } from '@/lib/services/dashboard-problem-center'
import { calculateReport } from '@/lib/services/report-calculator'
import { getFeedbackSummary } from '@/lib/services/feedback'
import { getStocksSummary } from '@/lib/services/stocks'
import { SYNC_JOB_KINDS, type SyncJobKind } from '@/types/sync'
import type { ReportData, ReportRow } from '@/types/reports'
import type {
  DashboardAdvertisingCampaignSnapshot,
  DashboardAdvertisingSummary,
  DashboardFinancialBreakdown,
  DashboardFreshnessDomain,
  DashboardFreshnessItem,
  DashboardIssueSeverity,
  DashboardMetric,
  DashboardOverviewCharts,
  DashboardPeriod,
  DashboardPeriodPreset,
  DashboardPlanSummary,
  DashboardProductSnapshot,
  DashboardSalesAnalytics,
  DashboardSummary,
  DashboardSummaryRequest,
  DashboardValueStatus,
  ActionRecommendation,
  ActionRecommendationCategory,
} from '@/types/dashboard'

const DASHBOARD_SUMMARY_CACHE_TTL_MS = 60_000
const HIGH_LOGISTICS_SHARE_PERCENT = 15
const HIGH_STORAGE_SHARE_PERCENT = 5
const HIGH_RETURN_RATE_PERCENT = 20
const HIGH_RETURN_RATE_MIN_RETURNS = 2
const ACTIVE_AD_STATUS = 9
const RECENT_AD_STATS_DAYS = 3
const MIN_FORECAST_OBSERVED_DAYS = 3
const WEAK_PLAN_COMPLETION_PERCENT = 90
const DASHBOARD_REPORT_OPTIONS = {
  preferPersistedAdStats: true,
  preferLiveAdCostTotals: false,
}
const dashboardSummaryCache = new Map<string, { expiresAt: number; summary: DashboardSummary }>()

const SOURCE_MAP = [
  {
    widget: 'Executive KPI',
    sources: ['Report calculator', 'RealizationReport', 'PaidStorage', 'CostPrice', 'SelfPurchase', 'ExternalAd', 'advertising spend from existing report flow'],
    fallback: 'Нет синхронизации финансового отчета: метрики возвращаются со статусом missing, а не нулем.',
  },
  {
    widget: 'Plan/fact',
    sources: ['SalesPlan', 'SalesPlanItem', 'WbSale'],
    fallback: 'Нет активного плана или синхронизации продаж: блок показывает явный empty state.',
  },
  {
    widget: 'Advertising',
    sources: ['AdCampaign', 'AdCampaignStat'],
    fallback: 'Нет сохраненной статистики рекламы: расходы и CTR не подменяются нулями без покрытия периода.',
  },
  {
    widget: 'Product leaders and risks',
    sources: ['Report calculator output from persisted data'],
    fallback: 'Нет строк реализации: списки товаров остаются пустыми со статусом missing.',
  },
  {
    widget: 'Freshness',
    sources: ['SyncJobRun', 'SyncDataCoverage', 'WbAccount.lastSyncAt'],
    fallback: 'История синхронизаций недоступна: источник помечается как missing.',
  },
  {
    widget: 'Problem center',
    sources: ['SyncJobRun', 'SyncDataCoverage', 'Report calculator output'],
    fallback: 'Problems become actionable dashboard items; failed sync jobs do not block the whole dashboard.',
  },
  {
    widget: 'Stock risk',
    sources: ['StockSnapshot', 'StockItem', 'Warehouse', 'CostPrice', 'WbSale'],
    fallback: 'Нет снимка остатков: блок показывает явное состояние missing и предлагает синхронизацию.',
  },
  {
    widget: 'Reviews and questions',
    sources: ['ProductReview', 'ProductQuestion', 'feedbacks-api.wildberries.ru'],
    fallback: 'Нет синхронизации отзывов и вопросов: workload помечается как missing, а не подменяется нулями.',
  },
]

const FRESHNESS_DOMAINS: {
  key: string
  label: string
  source: DashboardFreshnessDomain
  prismaKind:
    | 'PRODUCTS_REFRESH'
    | 'REPORTS_PERIOD'
    | 'SALES_PLAN_PERIOD'
    | 'ADVERTISING_CAMPAIGNS'
    | 'ADVERTISING_STATS'
    | 'ADVERTISING_CLUSTERS'
    | 'STOCKS_CURRENT'
    | 'REVIEWS_REFRESH'
    | 'QUESTIONS_REFRESH'
    | null
  href: string
  implemented: boolean
  staleAfterHours: number | null
}[] = [
  {
    key: 'products',
    label: 'Карточки',
    source: 'products',
    prismaKind: 'PRODUCTS_REFRESH',
    href: '/cards',
    implemented: true,
    staleAfterHours: 24,
  },
  {
    key: 'reports',
    label: 'Финансы',
    source: SYNC_JOB_KINDS.REPORTS_PERIOD,
    prismaKind: 'REPORTS_PERIOD',
    href: '/reports',
    implemented: true,
    staleAfterHours: 24,
  },
  {
    key: 'sales-plan',
    label: 'План продаж',
    source: SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
    prismaKind: 'SALES_PLAN_PERIOD',
    href: '/sales-plan',
    implemented: true,
    staleAfterHours: 24,
  },
  {
    key: 'advertising-stats',
    label: 'Рекламная статистика',
    source: SYNC_JOB_KINDS.ADVERTISING_STATS,
    prismaKind: 'ADVERTISING_STATS',
    href: '/advertising',
    implemented: true,
    staleAfterHours: 24,
  },
  {
    key: 'advertising-campaigns',
    label: 'Рекламные кампании',
    source: SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS,
    prismaKind: 'ADVERTISING_CAMPAIGNS',
    href: '/advertising',
    implemented: true,
    staleAfterHours: 24,
  },
  {
    key: 'advertising-clusters',
    label: 'Рекламные кластеры',
    source: SYNC_JOB_KINDS.ADVERTISING_CLUSTERS,
    prismaKind: 'ADVERTISING_CLUSTERS',
    href: '/advertising',
    implemented: true,
    staleAfterHours: 48,
  },
  {
    key: 'stocks',
    label: 'Остатки',
    source: 'stocks',
    prismaKind: 'STOCKS_CURRENT',
    href: '/stocks',
    implemented: true,
    staleAfterHours: 2,
  },
  {
    key: 'reviews',
    label: 'Отзывы',
    source: SYNC_JOB_KINDS.REVIEWS_REFRESH,
    prismaKind: 'REVIEWS_REFRESH',
    href: '/reviews',
    implemented: true,
    staleAfterHours: 12,
  },
  {
    key: 'questions',
    label: 'Вопросы',
    source: SYNC_JOB_KINDS.QUESTIONS_REFRESH,
    prismaKind: 'QUESTIONS_REFRESH',
    href: '/reviews?tab=questions',
    implemented: true,
    staleAfterHours: 12,
  },
]

export async function getDashboardSummary(
  request: DashboardSummaryRequest = {},
): Promise<DashboardSummary | null> {
  const requestedAccountId = request.accountId?.trim()
  const requestedAccount = requestedAccountId
    ? await prisma.wbAccount.findFirst({
      where: { id: requestedAccountId, isActive: true },
      select: { id: true, name: true, sellerName: true, lastSyncAt: true },
    })
    : null
  const account = requestedAccount
    ?? await prisma.wbAccount.findFirst({
        where: { isActive: true },
        select: { id: true, name: true, sellerName: true, lastSyncAt: true },
        orderBy: { createdAt: 'asc' },
      })

  if (!account) return null

  const period = resolveDashboardPeriod(request)
  const comparisonPeriod = resolveComparisonPeriod(period)
  const dateFrom = parseDateKey(period.dateFrom)
  const dateTo = parseDateKey(period.dateTo)
  const comparisonDateFrom = parseDateKey(comparisonPeriod.dateFrom)
  const comparisonDateTo = parseDateKey(comparisonPeriod.dateTo)
  const cacheKey = [
    account.id,
    period.preset,
    period.dateFrom,
    period.dateTo,
    comparisonPeriod.dateFrom,
    comparisonPeriod.dateTo,
  ].join(':')
  const cached = dashboardSummaryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.summary

  const [
    reportCoverage,
    comparisonReportCoverage,
    advertisingCoverage,
    reportRowsCount,
    comparisonReportRowsCount,
  ] = await Promise.all([
    getSyncCoverage(account.id, SYNC_JOB_KINDS.REPORTS_PERIOD, period.dateFrom, period.dateTo),
    getSyncCoverage(account.id, SYNC_JOB_KINDS.REPORTS_PERIOD, comparisonPeriod.dateFrom, comparisonPeriod.dateTo),
    getSyncCoverage(account.id, SYNC_JOB_KINDS.ADVERTISING_STATS, period.dateFrom, period.dateTo),
    countReportRows(account.id, dateFrom, dateTo),
    countReportRows(account.id, comparisonDateFrom, comparisonDateTo),
  ])

  const financialStatus = statusFromCoverage(reportCoverage.isCovered, reportRowsCount)
  const comparisonFinancialStatus = statusFromCoverage(
    comparisonReportCoverage.isCovered,
    comparisonReportRowsCount,
  )

  const [
    report,
    comparisonReport,
    plan,
    advertising,
    salesAnalytics,
    stocks,
    feedback,
    freshness,
  ] = await Promise.all([
    financialStatus === 'missing'
      ? Promise.resolve(null)
      : calculateReport(account.id, period.dateFrom, period.dateTo, DASHBOARD_REPORT_OPTIONS),
    comparisonFinancialStatus === 'missing'
      ? Promise.resolve(null)
      : calculateReport(account.id, comparisonPeriod.dateFrom, comparisonPeriod.dateTo, DASHBOARD_REPORT_OPTIONS),
    getPlanSummary(account.id, period.dateFrom, period.dateTo),
    getAdvertisingSummary(account.id, period.dateFrom, period.dateTo),
    getSalesAnalytics(account.id, period.dateFrom, period.dateTo),
    getStocksSummary(account.id),
    getFeedbackSummary(account.id, period.dateFrom, period.dateTo),
    getFreshnessSummary(account.id, period.dateFrom, period.dateTo),
  ])

  const revenue = reportMetricValue(report, 'sale', financialStatus)
  const operatingProfit = reportMetricValue(report, 'operatingProfit', financialStatus)
  const marginality = reportMetricValue(report, 'marginality', financialStatus)
  const drr = reportMetricValue(report, 'drr', financialStatus)
  const adSpend = reportMetricValue(report, 'adAll', financialStatus)
  const orders = reportMetricValue(report, 'delivered', financialStatus)
  const buyouts = reportMetricValue(report, 'boughtWithReturns', financialStatus)

  const comparisonRevenue = reportMetricValue(comparisonReport, 'sale', comparisonFinancialStatus)
  const comparisonOperatingProfit = reportMetricValue(comparisonReport, 'operatingProfit', comparisonFinancialStatus)
  const comparisonMarginality = reportMetricValue(comparisonReport, 'marginality', comparisonFinancialStatus)
  const comparisonDrr = reportMetricValue(comparisonReport, 'drr', comparisonFinancialStatus)
  const comparisonOrders = reportMetricValue(comparisonReport, 'delivered', comparisonFinancialStatus)
  const comparisonBuyouts = reportMetricValue(comparisonReport, 'boughtWithReturns', comparisonFinancialStatus)

  const productStatus = financialStatus
  const productRows = productStatus === 'missing' ? [] : report?.rows ?? []
  const financialBreakdown = buildFinancialBreakdown(report, financialStatus)
  const advertisingSummary = mergeReportAdvertisingSummary(
    advertising,
    adSpend,
    drr,
    mergeStatus(advertising.status, advertisingCoverage.isCovered ? 'ready' : advertising.status),
  )
  const topProfit = productRows
    .filter((row) => Number(row.operatingProfit) > 0)
    .sort((a, b) => Number(b.operatingProfit) - Number(a.operatingProfit))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const topRevenue = productRows
    .filter((row) => Number(row.sale) > 0)
    .sort((a, b) => Number(b.sale) - Number(a.sale))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const negativeProfit = productRows
    .filter((row) => Number(row.operatingProfit) < 0)
    .sort((a, b) => Number(a.operatingProfit) - Number(b.operatingProfit))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const highLogisticsShare = productRows
    .filter((row) => Number(row.logisticsFromSalesPercent) >= HIGH_LOGISTICS_SHARE_PERCENT)
    .sort((a, b) => Number(b.logisticsFromSalesPercent) - Number(a.logisticsFromSalesPercent))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const highStorageShare = productRows
    .filter((row) => Number(row.storageFromSalesPercent) >= HIGH_STORAGE_SHARE_PERCENT)
    .sort((a, b) => Number(b.storageFromSalesPercent) - Number(a.storageFromSalesPercent))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const missingCostPrice = productRows
    .filter((row) => Number(row.costPrice) === 0 && row.boughtWithReturns > 0)
    .sort((a, b) => b.boughtWithReturns - a.boughtWithReturns)
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const highReturnRate = productRows
    .filter((row) => productReturnRate(row) >= HIGH_RETURN_RATE_PERCENT && row.returns >= HIGH_RETURN_RATE_MIN_RETURNS)
    .sort((a, b) => productReturnRate(b) - productReturnRate(a))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const risks = productRows
    .filter((row) =>
      Number(row.operatingProfit) < 0
      || Number(row.drr) >= 20
      || Number(row.logisticsFromSalesPercent) >= HIGH_LOGISTICS_SHARE_PERCENT
      || Number(row.storageFromSalesPercent) >= HIGH_STORAGE_SHARE_PERCENT
      || (Number(row.costPrice) === 0 && row.boughtWithReturns > 0)
      || (productReturnRate(row) >= HIGH_RETURN_RATE_PERCENT && row.returns >= HIGH_RETURN_RATE_MIN_RETURNS)
    )
    .sort((a, b) => Number(a.operatingProfit) - Number(b.operatingProfit))
    .slice(0, 5)
    .map((row) => mapProductSnapshot(row, productStatus))
  const generatedAt = new Date().toISOString()
  const problemCenter = buildDashboardProblemCenter({
    accountId: account.id,
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    financialStatus,
    reportRowsCount,
    reportRows: productRows,
    advertising: advertisingSummary,
    stocks,
    feedback,
    freshnessItems: freshness.items,
    generatedAt,
  })
  const forecasts = await buildDashboardForecasts({
    accountId: account.id,
    period,
    financialStatus,
    financialBreakdown,
    plan,
    advertising: advertisingSummary,
    stocks,
    productsRequiringPlanAdjustment: risks,
  })
  const recommendations = buildActionRecommendations({
    accountId: account.id,
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    problemCenter,
    forecasts,
    stocks,
    generatedAt,
  })
  const overviewCharts = await buildOverviewCharts({
    accountId: account.id,
    period,
    financialBreakdown,
    advertising: advertisingSummary,
    stocks,
    feedback,
    freshness,
    problemCenter,
    products: {
      status: productStatus,
      risks,
    },
  })

  const summary: DashboardSummary = {
    account: {
      id: account.id,
      name: account.name,
      sellerName: account.sellerName,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    },
    period,
    comparisonPeriod,
    generatedAt,
    computeMode: 'on_demand',
    kpis: {
      revenue: metric('Выручка', revenue, comparisonRevenue, 'rub', financialStatus, 'RealizationReport', reportHint(financialStatus)),
      operatingProfit: metric('Операционная прибыль', operatingProfit, comparisonOperatingProfit, 'rub', financialStatus, 'Report calculator', reportHint(financialStatus)),
      marginality: metric('Маржинальность', marginality, comparisonMarginality, 'percent', financialStatus, 'Report calculator', reportHint(financialStatus)),
      drr: metric('ДРР', drr, comparisonDrr, 'percent', financialStatus, 'Report calculator + AdCampaignNmStat', reportHint(financialStatus)),
      orders: metric('Заказы', orders, comparisonOrders, 'count', financialStatus, 'RealizationReport.delivered', reportHint(financialStatus)),
      buyouts: metric('Выкупы', buyouts, comparisonBuyouts, 'count', financialStatus, 'RealizationReport.boughtWithReturns', reportHint(financialStatus)),
    },
    financialBreakdown,
    salesAnalytics,
    plan,
    advertising: advertisingSummary,
    stocks,
    feedback,
    forecasts,
    recommendations,
    overviewCharts,
    products: {
      status: productStatus,
      topProfit,
      topRevenue,
      risks,
      negativeProfit,
      highLogisticsShare,
      highStorageShare,
      missingCostPrice,
      highReturnRate,
      source: 'Report calculator output from persisted data',
      hint: productStatus === 'missing' ? 'Синхронизируйте финансовый отчет за выбранный период.' : null,
    },
    freshness,
    problemCenter,
    sourceMap: SOURCE_MAP,
  }

  dashboardSummaryCache.set(cacheKey, {
    expiresAt: Date.now() + DASHBOARD_SUMMARY_CACHE_TTL_MS,
    summary,
  })
  return summary
}

function resolveDashboardPeriod(request: DashboardSummaryRequest): DashboardPeriod {
  const preset = request.period ?? 'last7'
  const today = startOfUtcDay(new Date())

  if (preset === 'custom' && request.dateFrom && request.dateTo) {
    return buildPeriod('custom', request.dateFrom, request.dateTo, 'Свой период')
  }

  if (preset === 'today') {
    const key = formatDateKey(today)
    return buildPeriod('today', key, key, 'Сегодня')
  }

  if (preset === 'yesterday') {
    const value = addDays(today, -1)
    const key = formatDateKey(value)
    return buildPeriod('yesterday', key, key, 'Вчера')
  }

  if (preset === 'currentMonth') {
    return buildPeriod(
      'currentMonth',
      formatDateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
      formatDateKey(today),
      'Текущий месяц',
    )
  }

  if (preset === 'previousMonth') {
    return buildPeriod(
      'previousMonth',
      formatDateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))),
      formatDateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))),
      'Прошлый месяц',
    )
  }

  return buildPeriod('last7', formatDateKey(addDays(today, -6)), formatDateKey(today), 'Последние 7 дней')
}

function resolveComparisonPeriod(period: DashboardPeriod): DashboardPeriod {
  const previousTo = addDays(parseDateKey(period.dateFrom), -1)
  const previousFrom = addDays(previousTo, -(period.days - 1))
  return buildPeriod('custom', formatDateKey(previousFrom), formatDateKey(previousTo), 'Предыдущий равный период')
}

function buildPeriod(
  preset: DashboardPeriodPreset,
  dateFrom: string,
  dateTo: string,
  label: string,
): DashboardPeriod {
  const from = parseDateKey(dateFrom)
  const to = parseDateKey(dateTo)
  const normalizedFrom = from <= to ? from : to
  const normalizedTo = from <= to ? to : from
  const days = Math.max(1, Math.round((normalizedTo.getTime() - normalizedFrom.getTime()) / 86_400_000) + 1)

  return {
    preset,
    dateFrom: formatDateKey(normalizedFrom),
    dateTo: formatDateKey(normalizedTo),
    label,
    days,
  }
}

async function countReportRows(wbAccountId: string, dateFrom: Date, dateTo: Date) {
  return prisma.realizationReport.count({
    where: {
      wbAccountId,
      OR: [
        { rrDt: { gte: dateFrom, lte: dateTo } },
        {
          rrDt: null,
          dateFrom: { lte: dateTo },
          dateTo: { gte: dateFrom },
        },
      ],
    },
  })
}

async function getPlanSummary(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DashboardPlanSummary> {
  const from = parseDateKey(dateFrom)
  const to = parseDateKey(dateTo)
  const coverage = await getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.SALES_PLAN_PERIOD, dateFrom, dateTo)
  const plans = await prisma.salesPlan.findMany({
    where: {
      wbAccountId,
      dateFrom: { lte: to },
      dateTo: { gte: from },
    },
    include: { items: true },
  })

  if (plans.length === 0) {
    return {
      status: 'not_applicable',
      activePlans: 0,
      plannedUnits: null,
      factUnits: null,
      plannedRevenue: null,
      factRevenue: null,
      progressPercent: null,
      source: 'SalesPlan',
      hint: 'На выбранный период нет активного плана продаж.',
    }
  }

  const nmIds = Array.from(new Set(plans.flatMap((plan) => plan.items.map((item) => item.nmId))))
  const sales = nmIds.length > 0
    ? await prisma.wbSale.findMany({
        where: {
          wbAccountId,
          nmId: { in: nmIds },
          isReturn: false,
          date: { gte: from, lte: to },
        },
        select: { priceWithDisc: true },
      })
    : []

  let plannedUnits = 0
  let plannedRevenue = 0

  for (const plan of plans) {
    const overlapFrom = plan.dateFrom > from ? plan.dateFrom : from
    const overlapTo = plan.dateTo < to ? plan.dateTo : to
    const planDays = inclusiveDays(plan.dateFrom, plan.dateTo)
    const overlapDays = inclusiveDays(overlapFrom, overlapTo)
    const share = planDays > 0 ? overlapDays / planDays : 0

    for (const item of plan.items) {
      plannedUnits += item.plannedQty * share
      plannedRevenue += item.plannedQty * Number(item.price) * share
    }
  }

  const factUnits = sales.length
  const factRevenue = sales.reduce((sum, sale) => sum + Number(sale.priceWithDisc), 0)
  const status = coverage.isCovered ? 'ready' : factUnits > 0 ? 'partial' : 'missing'

  return {
    status,
    activePlans: plans.length,
    plannedUnits,
    factUnits: status === 'missing' ? null : factUnits,
    plannedRevenue,
    factRevenue: status === 'missing' ? null : factRevenue,
    progressPercent: plannedUnits > 0 && status !== 'missing' ? (factUnits / plannedUnits) * 100 : null,
    source: 'SalesPlan + WbSale',
    hint: status === 'missing' ? 'Синхронизируйте продажи для плана за выбранный период.' : null,
  }
}

async function getAdvertisingSummary(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DashboardAdvertisingSummary> {
  const from = parseDateKey(dateFrom)
  const to = parseDateKey(dateTo)
  const [coverage, rows, campaigns] = await Promise.all([
    getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.ADVERTISING_STATS, dateFrom, dateTo),
    prisma.adCampaignStat.findMany({
      where: {
        date: { gte: from, lte: to },
        campaign: { wbAccountId },
      },
      select: {
        campaignId: true,
        date: true,
        source: true,
        views: true,
        clicks: true,
        spend: true,
        orders: true,
        cartAdds: true,
      },
    }),
    prisma.adCampaign.findMany({
      where: { wbAccountId },
      select: { id: true, advertId: true, name: true, status: true },
    }),
  ])

  const rowsByCampaign = new Map<string, typeof rows>()
  for (const row of rows) {
    const group = rowsByCampaign.get(row.campaignId) ?? []
    group.push(row)
    rowsByCampaign.set(row.campaignId, group)
  }

  const campaignSnapshots: DashboardAdvertisingCampaignSnapshot[] = campaigns.map((campaign) => {
    const campaignRows = rowsByCampaign.get(campaign.id) ?? []
    const totalRows = campaignRows.filter((row) => row.source === 'total')
    const rowsForTotals = totalRows.length > 0 ? totalRows : campaignRows.filter((row) => row.source !== 'total')
    const views = rowsForTotals.reduce((sum, row) => sum + row.views, 0)
    const clicks = rowsForTotals.reduce((sum, row) => sum + row.clicks, 0)
    const spend = rowsForTotals.reduce((sum, row) => sum + Number(row.spend), 0)
    const orders = rowsForTotals.reduce((sum, row) => sum + row.orders, 0)
    const cartAdds = rowsForTotals.reduce((sum, row) => sum + row.cartAdds, 0)
    const lastStat = campaignRows.reduce<Date | null>(
      (latest, row) => (!latest || row.date > latest ? row.date : latest),
      null,
    )

    return {
      id: campaign.id,
      advertId: campaign.advertId,
      name: campaign.name,
      status: campaign.status,
      spend,
      views,
      clicks,
      orders,
      cartAdds,
      ctr: views > 0 ? (clicks / views) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      lastStatDate: lastStat ? formatDateKey(lastStat) : null,
      statusText: rowsForTotals.length > 0 ? 'ready' : 'missing',
    }
  })

  const snapshotsWithStats = campaignSnapshots.filter((campaign) => campaign.statusText !== 'missing')
  const activeCampaigns = snapshotsWithStats
    .filter((campaign) =>
      campaign.spend > 0
      || campaign.views > 0
      || campaign.clicks > 0
      || campaign.orders > 0
      || campaign.cartAdds > 0
    )
    .sort((a, b) => b.spend - a.spend || b.views - a.views || a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
  const status = statusFromCoverage(coverage.isCovered, snapshotsWithStats.length)
  const staleStatsBoundary = addDays(to, -RECENT_AD_STATS_DAYS)
  const campaignsWithoutRecentStats = campaignSnapshots
    .filter((campaign) => {
      if (campaign.status !== ACTIVE_AD_STATUS) return false
      if (!campaign.lastStatDate) return true
      return parseDateKey(campaign.lastStatDate) < staleStatsBoundary
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
    .slice(0, 5)
  const inefficientCampaigns = snapshotsWithStats
    .filter((campaign) => campaign.spend >= 1 && campaign.orders === 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)

  if (status === 'missing') {
    return {
      status,
      spend: null,
      views: null,
      clicks: null,
      orders: null,
      cartAdds: null,
      ctr: null,
      cpc: null,
      drr: null,
      campaigns: 0,
      spendWithoutOrders: null,
      activeCampaigns: [],
      inefficientCampaigns: [],
      campaignsWithoutRecentStats,
      source: 'AdCampaignStat',
      hint: 'Синхронизируйте статистику рекламы за выбранный период.',
    }
  }

  const views = snapshotsWithStats.reduce((sum, campaign) => sum + campaign.views, 0)
  const clicks = snapshotsWithStats.reduce((sum, campaign) => sum + campaign.clicks, 0)
  const spend = snapshotsWithStats.reduce((sum, campaign) => sum + campaign.spend, 0)
  const orders = snapshotsWithStats.reduce((sum, campaign) => sum + campaign.orders, 0)
  const cartAdds = snapshotsWithStats.reduce((sum, campaign) => sum + campaign.cartAdds, 0)
  const spendWithoutOrders = inefficientCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0)

  return {
    status,
    spend,
    views,
    clicks,
    orders,
    cartAdds,
    ctr: views > 0 ? (clicks / views) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    drr: null,
    campaigns: snapshotsWithStats.length,
    spendWithoutOrders,
    activeCampaigns,
    inefficientCampaigns,
    campaignsWithoutRecentStats,
    source: 'AdCampaignStat',
    hint: status === 'partial' ? 'Есть сохраненная статистика рекламы, но покрытие периода неполное.' : null,
  }
}

async function getSalesAnalytics(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DashboardSalesAnalytics> {
  const from = parseDateKey(dateFrom)
  const to = parseDateKey(dateTo)
  const [coverage, orders, sales, funnelRows] = await Promise.all([
    getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.SALES_PLAN_PERIOD, dateFrom, dateTo),
    prisma.wbOrder.findMany({
      where: { wbAccountId, date: { gte: from, lte: to } },
      select: { finishedPrice: true, isCancel: true },
    }),
    prisma.wbSale.findMany({
      where: { wbAccountId, date: { gte: from, lte: to } },
      select: { priceWithDisc: true, isReturn: true },
    }),
    prisma.wbFunnelStat.findMany({
      where: { wbAccountId, date: { gte: from, lte: to } },
      select: {
        openCount: true,
        addToCartCount: true,
        cartCount: true,
        ordersCount: true,
      },
    }),
  ])
  const rowCount = orders.length + sales.length + funnelRows.length
  const status = statusFromCoverage(coverage.isCovered, rowCount)

  if (status === 'missing') {
    return {
      status,
      orders: null,
      sales: null,
      returns: null,
      cancellations: null,
      buyoutPercent: null,
      averagePrice: null,
      funnel: {
        openCount: null,
        addToCartCount: null,
        cartCount: null,
        ordersCount: null,
        addToCartConversion: null,
        cartToOrderConversion: null,
      },
      source: 'WbOrder + WbSale + WbFunnelStat',
      hint: 'Синхронизируйте продажи, заказы и воронку за выбранный период.',
    }
  }

  const ordersCount = orders.length
  const cancellations = orders.filter((order) => order.isCancel).length
  const nonReturnSales = sales.filter((sale) => !sale.isReturn)
  const returns = sales.filter((sale) => sale.isReturn).length
  const salesAmount = nonReturnSales.reduce((sum, sale) => sum + Number(sale.priceWithDisc), 0)
  const buyoutPercent = ordersCount > 0
    ? Math.min(100, (nonReturnSales.length / ordersCount) * 100)
    : null
  const openCount = funnelRows.reduce((sum, row) => sum + row.openCount, 0)
  const addToCartCount = funnelRows.reduce((sum, row) => sum + row.addToCartCount, 0)
  const cartCount = funnelRows.reduce((sum, row) => sum + row.cartCount, 0)
  const funnelOrdersCount = funnelRows.reduce((sum, row) => sum + row.ordersCount, 0)

  return {
    status,
    orders: ordersCount,
    sales: nonReturnSales.length,
    returns,
    cancellations,
    buyoutPercent,
    averagePrice: nonReturnSales.length > 0 ? salesAmount / nonReturnSales.length : 0,
    funnel: {
      openCount,
      addToCartCount,
      cartCount,
      ordersCount: funnelOrdersCount,
      addToCartConversion: openCount > 0 ? (addToCartCount / openCount) * 100 : 0,
      cartToOrderConversion: cartCount > 0 ? (funnelOrdersCount / cartCount) * 100 : 0,
    },
    source: 'WbOrder + WbSale + WbFunnelStat',
    hint: status === 'partial' ? 'Есть часть данных продаж или воронки, но период не закрыт покрытием.' : null,
  }
}

type OverviewBucket = {
  dateFrom: string
  dateTo: string
  label: string
}

async function buildOverviewCharts(input: {
  accountId: string
  period: DashboardPeriod
  financialBreakdown: DashboardFinancialBreakdown
  advertising: DashboardAdvertisingSummary
  stocks: DashboardSummary['stocks']
  feedback: DashboardSummary['feedback']
  freshness: DashboardSummary['freshness']
  problemCenter: DashboardSummary['problemCenter']
  products: {
    status: DashboardValueStatus
    risks: DashboardProductSnapshot[]
  }
}): Promise<DashboardOverviewCharts> {
  const { granularity, buckets } = buildOverviewBuckets(input.period)
  const trend = await Promise.all(buckets.map(async (bucket) => {
    const from = parseDateKey(bucket.dateFrom)
    const to = parseDateKey(bucket.dateTo)
    const [coverage, rowCount] = await Promise.all([
      getSyncCoverage(input.accountId, SYNC_JOB_KINDS.REPORTS_PERIOD, bucket.dateFrom, bucket.dateTo),
      countReportRows(input.accountId, from, to),
    ])
    const status = statusFromCoverage(coverage.isCovered, rowCount)
    const report = status === 'missing'
      ? null
      : await calculateReport(input.accountId, bucket.dateFrom, bucket.dateTo, DASHBOARD_REPORT_OPTIONS)

    return {
      label: bucket.label,
      dateFrom: bucket.dateFrom,
      dateTo: bucket.dateTo,
      revenue: reportMetricValue(report, 'sale', status),
      operatingProfit: reportMetricValue(report, 'operatingProfit', status),
      orders: reportMetricValue(report, 'delivered', status),
      buyouts: reportMetricValue(report, 'boughtWithReturns', status),
      adSpend: reportMetricValue(report, 'adAll', status),
      status,
    }
  }))

  return {
    granularity,
    trend,
    finance: [
      distributionItem('to-transfer', 'К перечислению', input.financialBreakdown.toTransfer, input.financialBreakdown.status, 'positive'),
      distributionItem('logistics', 'Логистика', input.financialBreakdown.logistics, input.financialBreakdown.status, 'warning'),
      distributionItem('storage', 'Хранение', input.financialBreakdown.storage, input.financialBreakdown.status, 'warning'),
      distributionItem('taxes', 'Налоги', input.financialBreakdown.taxes, input.financialBreakdown.status, 'neutral'),
      distributionItem('wb-ads', 'WB реклама', input.financialBreakdown.wbAds ?? input.advertising.spend, input.financialBreakdown.status, 'warning'),
    ].filter((item) => item.value > 0),
    dataQuality: [
      distributionItem('ready', 'Готово', input.freshness.items.filter((item) => item.status === 'ready').length, 'ready', 'positive'),
      distributionItem('partial', 'Частично', input.freshness.items.filter((item) => item.status === 'partial').length, 'partial', 'warning'),
      distributionItem('missing', 'Нет данных', input.freshness.items.filter((item) => item.status === 'missing').length, 'missing', 'critical'),
      distributionItem('failed', 'Ошибки', input.freshness.failedJobs, input.freshness.failedJobs > 0 ? 'partial' : 'ready', 'critical'),
    ],
    risks: [
      distributionItem('stock', 'Остатки', input.stocks.lowStockCount + input.stocks.outOfStockCount, input.stocks.status === 'ready' ? 'ready' : 'missing', 'critical'),
      distributionItem('products', 'Товары', input.products.risks.length, input.products.status, 'warning'),
      distributionItem('feedback', 'Отзывы/вопросы', input.feedback.negativeReviews + input.feedback.unansweredReviews + input.feedback.unansweredQuestions, input.feedback.status === 'ready' ? 'ready' : 'missing', 'warning'),
      distributionItem('campaigns', 'Реклама', input.advertising.inefficientCampaigns.length + input.advertising.campaignsWithoutRecentStats.length, input.advertising.status, 'warning'),
      distributionItem('actions', 'Фокус', input.problemCenter.criticalCount + input.problemCenter.warningCount, input.problemCenter.status, 'critical'),
    ],
  }
}

function buildOverviewBuckets(period: DashboardPeriod): { granularity: DashboardOverviewCharts['granularity']; buckets: OverviewBucket[] } {
  const from = parseDateKey(period.dateFrom)
  const to = parseDateKey(period.dateTo)
  const useWeeks = period.days > 31
  const buckets: OverviewBucket[] = []
  let cursor = from

  while (cursor <= to) {
    const bucketFrom = cursor
    const bucketTo = useWeeks ? minDate(addDays(cursor, 6), to) : cursor
    buckets.push({
      dateFrom: formatDateKey(bucketFrom),
      dateTo: formatDateKey(bucketTo),
      label: useWeeks
        ? `${formatDateKey(bucketFrom).slice(5)}-${formatDateKey(bucketTo).slice(5)}`
        : formatDateKey(bucketFrom).slice(5),
    })
    cursor = addDays(bucketTo, 1)
  }

  return {
    granularity: useWeeks ? 'week' : 'day',
    buckets,
  }
}

function distributionItem(
  key: string,
  label: string,
  value: number | null,
  status: DashboardValueStatus,
  tone: DashboardOverviewCharts['finance'][number]['tone'],
): DashboardOverviewCharts['finance'][number] {
  return {
    key,
    label,
    value: Math.max(0, Number(value ?? 0)),
    status,
    tone,
  }
}

async function buildDashboardForecasts(input: {
  accountId: string
  period: DashboardPeriod
  financialStatus: DashboardValueStatus
  financialBreakdown: DashboardFinancialBreakdown
  plan: DashboardPlanSummary
  advertising: DashboardAdvertisingSummary
  stocks: DashboardSummary['stocks']
  productsRequiringPlanAdjustment: DashboardProductSnapshot[]
}): Promise<DashboardSummary['forecasts']> {
  const window = resolveForecastWindow(input.period)
  const planCompletion = await buildPlanForecast(input.accountId, input.period, input.plan, window)
  const stockDepletion = buildStockForecast(input.stocks, window)

  return {
    revenue: buildPaceForecast({
      label: 'Прогноз выручки',
      value: input.financialBreakdown.revenue,
      unit: 'rub',
      sourceStatus: input.financialStatus,
      source: 'Report calculator',
      window,
    }),
    operatingProfit: buildPaceForecast({
      label: 'Прогноз операционной прибыли',
      value: input.financialBreakdown.operatingProfit,
      unit: 'rub',
      sourceStatus: input.financialStatus,
      source: 'Report calculator',
      window,
    }),
    advertisingSpend: buildPaceForecast({
      label: 'Прогноз рекламного расхода',
      value: input.advertising.spend,
      unit: 'rub',
      sourceStatus: input.advertising.status,
      source: 'AdCampaignStat',
      window,
    }),
    planCompletion,
    stockDepletion,
    dailySalesPace: {
      label: 'Текущий темп продаж',
      status: planCompletion.status,
      value: planCompletion.currentDailyUnits,
      projectedValue: planCompletion.forecastUnits,
      dailyAverage: planCompletion.currentDailyUnits,
      unit: 'count',
      confidence: planCompletion.confidence,
      horizonDate: planCompletion.horizonDate,
      source: planCompletion.source,
      hint: planCompletion.hint,
    },
    unitsNeeded: {
      label: 'Нужно продать до плана',
      status: planCompletion.status,
      value: planCompletion.unitsNeeded,
      projectedValue: null,
      dailyAverage: planCompletion.requiredDailyUnits,
      unit: 'count',
      confidence: planCompletion.confidence,
      horizonDate: planCompletion.horizonDate,
      source: planCompletion.source,
      hint: planCompletion.hint,
    },
    stockNeeded: {
      label: 'Оценка пополнения',
      status: stockDepletion.status,
      value: stockDepletion.stockNeeded,
      projectedValue: null,
      dailyAverage: null,
      unit: 'count',
      confidence: stockDepletion.confidence,
      horizonDate: stockDepletion.horizonDate,
      source: stockDepletion.source,
      hint: stockDepletion.hint,
    },
    productsRequiringPlanAdjustment: input.productsRequiringPlanAdjustment,
  }
}

type ForecastWindow = {
  status: 'ready' | 'not_applicable'
  dateFrom: string
  observedTo: string | null
  horizonDate: string | null
  observedDays: number
  horizonDays: number
  remainingDays: number
  confidence: DashboardSummary['forecasts']['revenue']['confidence']
  hint: string | null
}

function resolveForecastWindow(period: DashboardPeriod): ForecastWindow {
  const today = startOfUtcDay(new Date())
  const from = parseDateKey(period.dateFrom)
  const selectedTo = parseDateKey(period.dateTo)

  let horizon = selectedTo
  if (period.preset === 'currentMonth') {
    horizon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
  }

  if (from > today) {
    return notApplicableWindow(period.dateFrom, 'Период начинается в будущем: нет фактического темпа для прогноза.')
  }

  if (period.preset !== 'currentMonth' && selectedTo <= today) {
    return notApplicableWindow(period.dateFrom, 'Выбранный период уже закрыт, прогноз до конца периода не строится.')
  }

  const observedTo = minDate(today, selectedTo)
  const observedDays = inclusiveDays(from, observedTo)
  const horizonDays = inclusiveDays(from, horizon)
  const remainingDays = Math.max(0, horizonDays - observedDays)

  if (remainingDays <= 0) {
    return notApplicableWindow(period.dateFrom, 'До конца выбранного горизонта не осталось будущих дней.')
  }

  if (observedDays < MIN_FORECAST_OBSERVED_DAYS) {
    return notApplicableWindow(period.dateFrom, 'Для прогноза нужно минимум 3 дня фактического темпа.')
  }

  return {
    status: 'ready',
    dateFrom: formatDateKey(from),
    observedTo: formatDateKey(observedTo),
    horizonDate: formatDateKey(horizon),
    observedDays,
    horizonDays,
    remainingDays,
    confidence: observedDays >= 7 ? 'medium' : 'low',
    hint: null,
  }
}

function notApplicableWindow(dateFrom: string, hint: string): ForecastWindow {
  return {
    status: 'not_applicable',
    dateFrom,
    observedTo: null,
    horizonDate: null,
    observedDays: 0,
    horizonDays: 0,
    remainingDays: 0,
    confidence: null,
    hint,
  }
}

function buildPaceForecast(input: {
  label: string
  value: number | null
  unit: DashboardMetric['unit']
  sourceStatus: DashboardValueStatus
  source: string
  window: ForecastWindow
}): DashboardSummary['forecasts']['revenue'] {
  if (input.sourceStatus === 'missing' || input.value === null) {
    return {
      label: input.label,
      status: 'missing',
      value: null,
      projectedValue: null,
      dailyAverage: null,
      unit: input.unit,
      confidence: null,
      horizonDate: input.window.horizonDate,
      source: input.source,
      hint: 'Нет локальных данных за выбранный период, прогноз не строится.',
    }
  }

  if (input.window.status !== 'ready') {
    return {
      label: input.label,
      status: 'not_applicable',
      value: input.value,
      projectedValue: null,
      dailyAverage: null,
      unit: input.unit,
      confidence: null,
      horizonDate: input.window.horizonDate,
      source: input.source,
      hint: input.window.hint,
    }
  }

  const dailyAverage = input.value / input.window.observedDays
  return {
    label: input.label,
    status: input.sourceStatus === 'ready' ? 'ready' : 'partial',
    value: input.value,
    projectedValue: dailyAverage * input.window.horizonDays,
    dailyAverage,
    unit: input.unit,
    confidence: input.window.confidence,
    horizonDate: input.window.horizonDate,
    source: input.source,
    hint: `Простая проекция: средний дневной темп за ${input.window.observedDays} дн. умножен на ${input.window.horizonDays} дн.`,
  }
}

async function buildPlanForecast(
  wbAccountId: string,
  period: DashboardPeriod,
  plan: DashboardPlanSummary,
  window: ForecastWindow,
): Promise<DashboardSummary['forecasts']['planCompletion']> {
  if (plan.activePlans === 0 || plan.status === 'not_applicable') {
    return emptyPlanForecast('not_applicable', window, 'На выбранный период нет активного плана продаж.')
  }

  if (window.status !== 'ready' || !window.observedTo || !window.horizonDate) {
    return {
      ...emptyPlanForecast(window.status, window, window.hint),
      plannedUnits: plan.plannedUnits,
      factUnits: plan.factUnits,
    }
  }

  const from = parseDateKey(period.dateFrom)
  const observedTo = parseDateKey(window.observedTo)
  const horizon = parseDateKey(window.horizonDate)
  const plans = await prisma.salesPlan.findMany({
    where: {
      wbAccountId,
      dateFrom: { lte: horizon },
      dateTo: { gte: from },
    },
    include: { items: true },
  })

  if (plans.length === 0) {
    return emptyPlanForecast('not_applicable', window, 'На горизонте прогноза нет активного плана продаж.')
  }

  const nmIds = Array.from(new Set(plans.flatMap((item) => item.items.map((planItem) => planItem.nmId))))
  const sales = nmIds.length > 0
    ? await prisma.wbSale.findMany({
        where: {
          wbAccountId,
          nmId: { in: nmIds },
          isReturn: false,
          date: { gte: from, lte: observedTo },
        },
        select: { id: true },
      })
    : []

  let plannedUnits = 0
  for (const salesPlan of plans) {
    const overlapFrom = salesPlan.dateFrom > from ? salesPlan.dateFrom : from
    const overlapTo = salesPlan.dateTo < horizon ? salesPlan.dateTo : horizon
    const planDays = inclusiveDays(salesPlan.dateFrom, salesPlan.dateTo)
    const overlapDays = inclusiveDays(overlapFrom, overlapTo)
    const share = planDays > 0 ? overlapDays / planDays : 0

    for (const item of salesPlan.items) {
      plannedUnits += item.plannedQty * share
    }
  }

  const factUnits = sales.length
  const currentDailyUnits = factUnits / window.observedDays
  const forecastUnits = currentDailyUnits * window.horizonDays
  const unitsNeeded = Math.max(0, plannedUnits - factUnits)
  const requiredDailyUnits = window.remainingDays > 0 ? unitsNeeded / window.remainingDays : null
  const forecastCompletionPercent = plannedUnits > 0 ? (forecastUnits / plannedUnits) * 100 : null
  const status = plan.status === 'ready' ? 'ready' : plan.status === 'missing' ? 'missing' : 'partial'

  return {
    status,
    plannedUnits,
    factUnits,
    forecastUnits,
    forecastCompletionPercent,
    currentDailyUnits,
    requiredDailyUnits,
    unitsNeeded,
    confidence: window.confidence,
    horizonDate: window.horizonDate,
    source: 'SalesPlan + WbSale',
    hint: 'Прогноз плана строится по текущему среднему темпу выкупов и плану на оставшийся горизонт.',
  }
}

function emptyPlanForecast(
  status: DashboardValueStatus,
  window: ForecastWindow,
  hint: string | null,
): DashboardSummary['forecasts']['planCompletion'] {
  return {
    status,
    plannedUnits: null,
    factUnits: null,
    forecastUnits: null,
    forecastCompletionPercent: null,
    currentDailyUnits: null,
    requiredDailyUnits: null,
    unitsNeeded: null,
    confidence: null,
    horizonDate: window.horizonDate,
    source: 'SalesPlan + WbSale',
    hint,
  }
}

function buildStockForecast(
  stocks: DashboardSummary['stocks'],
  window: ForecastWindow,
): DashboardSummary['forecasts']['stockDepletion'] {
  if (stocks.status === 'missing') {
    return {
      status: 'missing',
      lowStockCount: 0,
      outOfStockCount: 0,
      overstockCount: 0,
      noDemandCount: 0,
      earliestDaysUntilZero: null,
      stockNeeded: null,
      productsAtRisk: [],
      confidence: null,
      horizonDate: window.horizonDate,
      source: 'StockSnapshot + WbSale',
      hint: 'Нет локального снимка остатков WB.',
    }
  }

  const riskItems = stocks.items
    .filter((item) => item.risk === 'out_of_stock' || item.risk === 'low_stock')
    .sort((a, b) => (a.daysUntilZero ?? 0) - (b.daysUntilZero ?? 0) || a.quantity - b.quantity)
    .slice(0, 5)
  const positiveDays = stocks.items
    .map((item) => item.daysUntilZero)
    .filter((value): value is number => value !== null && value >= 0)
  const earliestDaysUntilZero = positiveDays.length > 0 ? Math.min(...positiveDays) : null
  const productsAtRisk = riskItems.map((item) => {
    const dailySales = item.daysUntilZero && item.daysUntilZero > 0 ? item.quantity / item.daysUntilZero : null
    const stockNeeded = dailySales && window.status === 'ready'
      ? Math.max(0, Math.ceil(dailySales * window.horizonDays - item.quantity))
      : null

    return {
      nmId: item.nmId,
      vendorCode: item.vendorCode,
      title: item.title,
      quantity: item.quantity,
      daysUntilZero: item.daysUntilZero,
      stockNeeded,
    }
  })
  const stockNeeded = productsAtRisk.reduce((sum, item) => sum + (item.stockNeeded ?? 0), 0)

  return {
    status: window.status === 'ready' || riskItems.length > 0 ? 'ready' : 'not_applicable',
    lowStockCount: stocks.lowStockCount,
    outOfStockCount: stocks.outOfStockCount,
    overstockCount: stocks.overstockCount,
    noDemandCount: stocks.productsWithStockNoSales,
    earliestDaysUntilZero,
    stockNeeded: window.status === 'ready' ? stockNeeded : null,
    productsAtRisk,
    confidence: window.status === 'ready' ? window.confidence : 'low',
    horizonDate: window.horizonDate,
    source: 'StockSnapshot + WbSale',
    hint: window.status === 'ready'
      ? 'Потребность в пополнении считается только для товаров, где известен темп продаж и дни до нуля.'
      : 'Текущий риск остатков показан без прогноза потребности, потому что горизонт периода закрыт или слишком короткий.',
  }
}

function buildActionRecommendations(input: {
  accountId: string
  dateFrom: string
  dateTo: string
  problemCenter: DashboardSummary['problemCenter']
  forecasts: DashboardSummary['forecasts']
  stocks: DashboardSummary['stocks']
  generatedAt: string
}): ActionRecommendation[] {
  const recommendations = new Map<string, ActionRecommendation>()
  const add = (recommendation: ActionRecommendation) => {
    const current = recommendations.get(recommendation.id)
    if (!current || actionSeverityRank(recommendation.severity) > actionSeverityRank(current.severity)) {
      recommendations.set(recommendation.id, recommendation)
    }
  }

  for (const insight of input.problemCenter.insights) {
    add({
      id: `action:${insight.category}`,
      severity: insight.severity,
      category: insight.category,
      title: recommendationTitle(insight.category, insight.title),
      description: insight.description,
      metric: insight.metric,
      href: insight.href,
      createdAt: input.generatedAt,
    })
  }

  const planForecast = input.forecasts.planCompletion
  if (
    (planForecast.status === 'ready' || planForecast.status === 'partial')
    && planForecast.forecastCompletionPercent !== null
    && planForecast.forecastCompletionPercent < WEAK_PLAN_COMPLETION_PERCENT
  ) {
    add({
      id: 'action:plan-adjustment',
      severity: planForecast.forecastCompletionPercent < 75 ? 'critical' : 'warning',
      category: 'plan_adjustment',
      title: 'Скорректировать план или темп продаж',
      description: 'При текущем темпе выбранный план может не выйти на цель. Проверьте товары, цены, рекламу и дневной темп.',
      metric: `${formatNumber(planForecast.forecastCompletionPercent, 0)}%`,
      href: withAccount('/sales-plan', input.accountId),
      createdAt: input.generatedAt,
    })
  }

  if (input.stocks.overstockCount > 0) {
    add({
      id: 'action:overstock',
      severity: 'warning',
      category: 'overstock',
      title: 'Проверить избыточные остатки',
      description: 'Есть товары, где запас сильно выше текущего темпа продаж. Проверьте спрос, хранение и промо-план.',
      metric: `${input.stocks.overstockCount} поз.`,
      href: `${withAccount('/stocks', input.accountId)}&risk=overstock`,
      createdAt: input.generatedAt,
    })
  }

  if (input.stocks.productsWithStockNoSales > 0) {
    add({
      id: 'action:no-demand',
      severity: 'info',
      category: 'no_demand',
      title: 'Разобрать товар с остатком без продаж',
      description: 'Есть остатки, но по ним не видно недавних продаж. Проверьте карточку, цену, видимость и план продвижения.',
      metric: `${input.stocks.productsWithStockNoSales} поз.`,
      href: `${withAccount('/stocks', input.accountId)}&risk=no_sales`,
      createdAt: input.generatedAt,
    })
  }

  return Array.from(recommendations.values())
    .sort(compareRecommendations)
    .slice(0, 8)
}

function recommendationTitle(category: ActionRecommendationCategory, fallback: string): string {
  if (category === 'sync_failed') return 'Проверить сбои синхронизации'
  if (category === 'data_stale') return 'Обновить данные перед решениями'
  if (category === 'missing_cost_price') return 'Заполнить себестоимость'
  if (category === 'negative_margin') return 'Разобрать отрицательную прибыль'
  if (category === 'high_drr') return 'Снизить или проверить высокий ДРР'
  if (category === 'inefficient_campaign') return 'Проверить рекламу без заказов'
  if (category === 'campaign_without_recent_stats') return 'Обновить статистику активной рекламы'
  if (category === 'out_of_stock') return 'Пополнить товары без остатка'
  if (category === 'low_stock') return 'Подготовить пополнение остатков'
  if (category === 'unanswered_review_question') return 'Ответить на отзывы и вопросы'
  if (category === 'high_return_rate') return 'Проверить товары с высокими возвратами'
  return fallback
}

function compareRecommendations(a: ActionRecommendation, b: ActionRecommendation): number {
  return actionSeverityRank(b.severity) - actionSeverityRank(a.severity)
    || actionCategoryRank(a.category) - actionCategoryRank(b.category)
    || a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })
}

function actionSeverityRank(severity: DashboardIssueSeverity): number {
  if (severity === 'critical') return 3
  if (severity === 'warning') return 2
  return 1
}

function actionCategoryRank(category: ActionRecommendationCategory): number {
  const ranks: Record<ActionRecommendationCategory, number> = {
    sync_failed: 1,
    no_recent_report_data: 2,
    data_stale: 3,
    plan_adjustment: 4,
    negative_margin: 5,
    high_drr: 6,
    inefficient_campaign: 7,
    out_of_stock: 8,
    low_stock: 9,
    high_return_rate: 10,
    missing_cost_price: 11,
    overstock: 12,
    no_demand: 13,
    high_logistics_share: 14,
    high_storage_share: 15,
    campaign_without_recent_stats: 16,
    product_without_stock_data: 17,
    unanswered_review_question: 18,
  }
  return ranks[category]
}

async function getFreshnessSummary(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DashboardSummary['freshness']> {
  const [activeJobs, failedJobs, items] = await Promise.all([
    prisma.syncJobRun.count({
      where: { wbAccountId, status: { in: ['QUEUED', 'RUNNING'] } },
    }),
    prisma.syncJobRun.count({
      where: {
        wbAccountId,
        status: 'FAILED',
        createdAt: { gte: addDays(new Date(), -7) },
      },
    }),
    Promise.all(FRESHNESS_DOMAINS.map((domain) => getFreshnessItem(wbAccountId, domain, dateFrom, dateTo))),
  ])

  return {
    activeJobs,
    failedJobs,
    criticalCount: items.filter((item) => item.severity === 'critical').length,
    warningCount: items.filter((item) => item.severity === 'warning').length,
    items,
  }
}

async function getFreshnessItem(
  wbAccountId: string,
  domain: (typeof FRESHNESS_DOMAINS)[number],
  dateFrom: string,
  dateTo: string,
): Promise<DashboardFreshnessItem> {
  if (!domain.implemented || !domain.prismaKind) {
    return {
      key: domain.key,
      label: domain.label,
      status: 'not_applicable',
      severity: 'info',
      isStale: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastFailedAt: null,
      lastError: null,
      lastCoverageSyncedAt: null,
      checkedFrom: null,
      checkedTo: null,
      staleAfterHours: domain.staleAfterHours,
      activeJobs: 0,
      failedJobs: 0,
      source: domain.source,
      href: withAccount(domain.href, wbAccountId),
      implemented: domain.implemented,
      hint: 'Источник запланирован для будущей фазы и пока не участвует в оценке проблем.',
    }
  }

  const [lastRun, lastSuccess, lastFailed, activeJobs, failedJobs, coverage, rowCount] = await Promise.all([
    prisma.syncJobRun.findFirst({
      where: { wbAccountId, kind: domain.prismaKind },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.syncJobRun.findFirst({
      where: { wbAccountId, kind: domain.prismaKind, status: 'SUCCEEDED' },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.syncJobRun.findFirst({
      where: { wbAccountId, kind: domain.prismaKind, status: 'FAILED' },
      select: { error: true, finishedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.syncJobRun.count({
      where: { wbAccountId, kind: domain.prismaKind, status: { in: ['QUEUED', 'RUNNING'] } },
    }),
    prisma.syncJobRun.count({
      where: {
        wbAccountId,
        kind: domain.prismaKind,
        status: 'FAILED',
        createdAt: { gte: addDays(new Date(), -7) },
      },
    }),
    needsCoverage(domain.source)
      ? getSyncCoverage(wbAccountId, domain.source, dateFrom, dateTo)
      : Promise.resolve({ isCovered: false, syncedAt: null as string | null }),
    countFreshnessRows(wbAccountId, domain.key, dateFrom, dateTo),
  ])

  const status = freshnessStatus(domain.source, coverage.isCovered, rowCount, lastSuccess?.finishedAt ?? null)
  const severity = freshnessSeverity(status, failedJobs, domain.key, lastSuccess?.finishedAt ?? null, domain.staleAfterHours)
  const isStale = isFreshnessStale(status, lastSuccess?.finishedAt ?? null, domain.staleAfterHours)

  return {
    key: domain.key,
    label: domain.label,
    status,
    severity,
    isStale,
    lastRunAt: lastRun?.createdAt.toISOString() ?? null,
    lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    lastFailedAt: (lastFailed?.finishedAt ?? lastFailed?.createdAt)?.toISOString() ?? null,
    lastError: lastFailed?.error ?? null,
    lastCoverageSyncedAt: coverage.syncedAt,
    checkedFrom: dateFrom,
    checkedTo: dateTo,
    staleAfterHours: domain.staleAfterHours,
    activeJobs,
    failedJobs,
    source: domain.source,
    href: withAccount(domain.href, wbAccountId),
    implemented: domain.implemented,
    hint: status === 'ready' && isStale
      ? staleFreshnessHint(domain.staleAfterHours)
      : status === 'ready'
        ? null
        : freshnessHint(domain.key),
  }
}

function needsCoverage(source: DashboardFreshnessDomain): source is SyncJobKind {
  return source !== 'products' && source !== 'stocks' && source !== 'reviews' && source !== 'questions'
}

async function countFreshnessRows(
  wbAccountId: string,
  key: string,
  dateFrom: string,
  dateTo: string,
): Promise<number> {
  if (key === 'products') {
    return prisma.product.count({ where: { wbAccountId } })
  }
  if (key === 'reports') {
    return countReportRows(wbAccountId, parseDateKey(dateFrom), parseDateKey(dateTo))
  }
  if (key === 'sales-plan') {
    return prisma.wbSale.count({
      where: {
        wbAccountId,
        date: { gte: parseDateKey(dateFrom), lte: parseDateKey(dateTo) },
      },
    })
  }
  if (key === 'advertising-campaigns') {
    return prisma.adCampaign.count({ where: { wbAccountId } })
  }
  if (key === 'advertising-stats') {
    return prisma.adCampaignStat.count({
      where: {
        date: { gte: parseDateKey(dateFrom), lte: parseDateKey(dateTo) },
        campaign: { wbAccountId },
      },
    })
  }
  if (key === 'advertising-clusters') {
    return prisma.adCampaignCluster.count({
      where: {
        dateFrom: { lte: parseDateKey(dateTo) },
        dateTo: { gte: parseDateKey(dateFrom) },
        campaign: { wbAccountId },
      },
    })
  }
  if (key === 'stocks') {
    const snapshot = await prisma.stockSnapshot.findFirst({
      where: { wbAccountId },
      orderBy: { syncedAt: 'desc' },
      select: { id: true },
    })
    return snapshot ? prisma.stockItem.count({ where: { snapshotId: snapshot.id } }) : 0
  }
  if (key === 'reviews') {
    return prisma.productReview.count({
      where: {
        wbAccountId,
        createdDate: { gte: parseDateKey(dateFrom), lt: addDays(parseDateKey(dateTo), 1) },
      },
    })
  }
  if (key === 'questions') {
    return prisma.productQuestion.count({
      where: {
        wbAccountId,
        createdDate: { gte: parseDateKey(dateFrom), lt: addDays(parseDateKey(dateTo), 1) },
      },
    })
  }
  return 0
}

function freshnessStatus(
  source: DashboardFreshnessDomain,
  isCovered: boolean,
  rowCount: number,
  lastSuccessAt: Date | null,
): DashboardValueStatus {
  if (source === 'products') return rowCount > 0 ? 'ready' : lastSuccessAt ? 'partial' : 'missing'
  if (source === 'stocks') return lastSuccessAt ? 'ready' : 'missing'
  if (source === SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS) return rowCount > 0 ? 'ready' : lastSuccessAt ? 'partial' : 'missing'
  if (isCovered) return 'ready'
  if (rowCount > 0 || lastSuccessAt) return 'partial'
  return 'missing'
}

function freshnessSeverity(
  status: DashboardValueStatus,
  failedJobs: number,
  key: string,
  lastSuccessAt: Date | null,
  staleAfterHours: number | null,
): DashboardIssueSeverity {
  if (status === 'not_applicable' || status === 'ready') {
    if (!lastSuccessAt || !staleAfterHours) return failedJobs > 0 ? 'warning' : 'info'
    const ageHours = (Date.now() - lastSuccessAt.getTime()) / 3_600_000
    return ageHours > staleAfterHours ? 'warning' : failedJobs > 0 ? 'warning' : 'info'
  }
  if (failedJobs > 2) return 'critical'
  if (key === 'reports' && status === 'missing') return 'critical'
  return 'warning'
}

function isFreshnessStale(
  status: DashboardValueStatus,
  lastSuccessAt: Date | null,
  staleAfterHours: number | null,
): boolean {
  if (status !== 'ready' || !lastSuccessAt || !staleAfterHours) return false
  return (Date.now() - lastSuccessAt.getTime()) / 3_600_000 > staleAfterHours
}

function withAccount(href: string, wbAccountId: string): string {
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}account=${wbAccountId}`
}

function buildFinancialBreakdown(
  report: ReportData | null,
  status: DashboardValueStatus,
): DashboardFinancialBreakdown {
  if (status === 'missing') {
    return {
      status,
      revenue: null,
      toTransfer: null,
      operatingProfit: null,
      marginality: null,
      rentability: null,
      taxes: null,
      logistics: null,
      storage: null,
      penalties: null,
      acceptance: null,
      paidStorage: null,
      selfPurchases: null,
      externalAds: null,
      wbAds: null,
      returnAmount: null,
      returnCount: null,
      returnRate: null,
      source: 'Report calculator',
      hint: reportHint(status),
    }
  }

  const summary = report?.summary
  const returnCount = Number(summary?.returns ?? 0)
  const boughtWithoutReturns = Number(summary?.boughtWithoutReturns ?? 0)
  const returnsWithSpp = Number(summary?.returnsWithSpp ?? 0)

  return {
    status,
    revenue: Number(summary?.sale ?? 0),
    toTransfer: Number(summary?.toTransfer ?? 0),
    operatingProfit: Number(summary?.operatingProfit ?? 0),
    marginality: Number(summary?.marginality ?? 0),
    rentability: Number(summary?.rentability ?? 0),
    taxes: Number(summary?.taxes ?? 0),
    logistics: Number(summary?.logistics ?? 0),
    storage: Number(summary?.storageFee ?? 0),
    penalties: Number(summary?.penalty ?? 0),
    acceptance: Number(summary?.acceptance ?? 0),
    paidStorage: Number(summary?.storageFee ?? 0),
    selfPurchases: Number(summary?.selfPurchases ?? 0),
    externalAds: Number(summary?.externalAd ?? 0),
    wbAds: Number(summary?.adAll ?? 0),
    returnAmount: returnsWithSpp,
    returnCount,
    returnRate: boughtWithoutReturns > 0 ? (returnCount / boughtWithoutReturns) * 100 : 0,
    source: 'Report calculator',
    hint: reportHint(status),
  }
}

function reportMetricValue(
  report: ReportData | null,
  key: keyof ReportData['summary'],
  status: DashboardValueStatus,
): number | null {
  if (status === 'missing') return null
  return Number(report?.summary[key] ?? 0)
}

function metric(
  label: string,
  value: number | null,
  previousValue: number | null,
  unit: DashboardMetric['unit'],
  status: DashboardValueStatus,
  source: string,
  hint: string | null,
): DashboardMetric {
  return {
    label,
    value,
    previousValue,
    changePercent: value !== null && previousValue !== null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : null,
    unit,
    status,
    source,
    hint,
  }
}

function mapProductSnapshot(
  row: ReportRow,
  status: DashboardValueStatus,
): DashboardProductSnapshot {
  return {
    nmId: row.nmId,
    vendorCode: row.vendorCode,
    brandName: row.brandName,
    subjectName: row.subjectName,
    photoUrl: row.photoUrl,
    revenue: Number(row.sale),
    toTransfer: Number(row.toTransfer),
    operatingProfit: Number(row.operatingProfit),
    marginality: Number(row.marginality),
    rentability: Number(row.rentability),
    drr: Number(row.drr),
    logistics: Number(row.logistics),
    logisticsShare: Number(row.logisticsFromSalesPercent),
    storage: Number(row.storageFee),
    storageShare: Number(row.storageFromSalesPercent),
    costPrice: Number(row.costPrice),
    returns: row.returns,
    returnRate: productReturnRate(row),
    status,
  }
}

function productReturnRate(row: Pick<ReportRow, 'returns' | 'boughtWithoutReturns'>): number {
  return row.boughtWithoutReturns > 0 ? (row.returns / row.boughtWithoutReturns) * 100 : 0
}

function statusFromCoverage(isCovered: boolean, rowCount: number): DashboardValueStatus {
  if (isCovered) return 'ready'
  if (rowCount > 0) return 'partial'
  return 'missing'
}

function mergeStatus(a: DashboardValueStatus, b: DashboardValueStatus): DashboardValueStatus {
  if (a === 'missing' || b === 'missing') return 'missing'
  if (a === 'partial' || b === 'partial') return 'partial'
  if (a === 'not_applicable' || b === 'not_applicable') return 'not_applicable'
  return 'ready'
}

function mergeReportAdvertisingSummary(
  advertising: DashboardAdvertisingSummary,
  reportAdSpend: number | null,
  reportDrr: number | null,
  status: DashboardValueStatus,
): DashboardAdvertisingSummary {
  const spend = reportAdSpend ?? advertising.spend

  return {
    ...advertising,
    spend,
    drr: reportDrr,
    cpc: spend !== null && advertising.clicks && advertising.clicks > 0
      ? spend / advertising.clicks
      : advertising.cpc,
    status,
    source: reportAdSpend !== null
      ? `${advertising.source} + Report calculator`
      : advertising.source,
  }
}

function reportHint(status: DashboardValueStatus): string | null {
  if (status === 'missing') return 'Синхронизируйте финансовый отчет за выбранный период.'
  if (status === 'partial') return 'В базе есть часть строк, но период не закрыт покрытием синхронизации.'
  return null
}

function freshnessHint(key: string): string {
  if (key === 'products') return 'Обновите карточки товаров.'
  if (key === 'stocks') return 'Синхронизируйте текущие остатки WB.'
  if (key === 'reports') return 'Синхронизируйте финансовый отчет.'
  if (key === 'sales-plan') return 'Синхронизируйте продажи, заказы и воронку.'
  return 'Синхронизируйте рекламную статистику.'
}

function staleFreshnessHint(staleAfterHours: number | null): string {
  if (!staleAfterHours) return 'Источник давно не обновлялся.'
  return `Последняя успешная синхронизация старше ${staleAfterHours} ч.`
}

function parseDateKey(value: string): Date {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : formatDateKey(new Date())
  return new Date(`${safe}T00:00:00.000Z`)
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b
}

function inclusiveDays(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}
