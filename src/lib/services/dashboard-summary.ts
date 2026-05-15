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
  DashboardPeriod,
  DashboardPeriodPreset,
  DashboardPlanSummary,
  DashboardProductSnapshot,
  DashboardSalesAnalytics,
  DashboardSummary,
  DashboardSummaryRequest,
  DashboardValueStatus,
} from '@/types/dashboard'

const DASHBOARD_SUMMARY_CACHE_TTL_MS = 60_000
const HIGH_LOGISTICS_SHARE_PERCENT = 15
const HIGH_STORAGE_SHARE_PERCENT = 5
const HIGH_RETURN_RATE_PERCENT = 20
const HIGH_RETURN_RATE_MIN_RETURNS = 2
const ACTIVE_AD_STATUS = 9
const RECENT_AD_STATS_DAYS = 3
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
      : calculateReport(account.id, period.dateFrom, period.dateTo, { preferPersistedAdStats: true }),
    comparisonFinancialStatus === 'missing'
      ? Promise.resolve(null)
      : calculateReport(account.id, comparisonPeriod.dateFrom, comparisonPeriod.dateTo, { preferPersistedAdStats: true }),
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
    advertising,
    stocks,
    feedback,
    freshnessItems: freshness.items,
    generatedAt,
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
    advertising: {
      ...advertising,
      drr,
      status: mergeStatus(advertising.status, advertisingCoverage.isCovered ? 'ready' : advertising.status),
    },
    stocks,
    feedback,
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
    .filter((campaign) => campaign.spend > 0 && campaign.orders === 0)
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

function inclusiveDays(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
}
