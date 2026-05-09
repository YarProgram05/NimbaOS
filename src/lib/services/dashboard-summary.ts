import { prisma } from '@/lib/db'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { buildDashboardProblemCenter } from '@/lib/services/dashboard-problem-center'
import { calculateReport } from '@/lib/services/report-calculator'
import { SYNC_JOB_KINDS, type SyncJobKind } from '@/types/sync'
import type {
  DashboardAdvertisingSummary,
  DashboardFreshnessDomain,
  DashboardFreshnessItem,
  DashboardIssueSeverity,
  DashboardMetric,
  DashboardPeriod,
  DashboardPeriodPreset,
  DashboardPlanSummary,
  DashboardProductSnapshot,
  DashboardSummary,
  DashboardSummaryRequest,
  DashboardValueStatus,
} from '@/types/dashboard'

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
    prismaKind: null,
    href: '/sync',
    implemented: false,
    staleAfterHours: null,
  },
  {
    key: 'reviews',
    label: 'Отзывы',
    source: 'reviews',
    prismaKind: null,
    href: '/sync',
    implemented: false,
    staleAfterHours: null,
  },
  {
    key: 'questions',
    label: 'Вопросы',
    source: 'questions',
    prismaKind: null,
    href: '/sync',
    implemented: false,
    staleAfterHours: null,
  },
]

export async function getDashboardSummary(
  request: DashboardSummaryRequest = {},
): Promise<DashboardSummary | null> {
  const account = request.accountId
    ? await prisma.wbAccount.findFirst({
        where: { id: request.accountId, isActive: true },
        select: { id: true, name: true, sellerName: true, lastSyncAt: true },
      })
    : await prisma.wbAccount.findFirst({
        where: { isActive: true },
        select: { id: true, name: true, sellerName: true, lastSyncAt: true },
        orderBy: { createdAt: 'asc' },
      })

  if (!account) return null

  const period = resolveDashboardPeriod(request)
  const comparisonPeriod = resolveComparisonPeriod(period)
  const dateFrom = parseDateKey(period.dateFrom)
  const dateTo = parseDateKey(period.dateTo)

  const [
    reportCoverage,
    advertisingCoverage,
    reportRowsCount,
    report,
    comparisonReport,
    plan,
    advertising,
    freshness,
  ] = await Promise.all([
    getSyncCoverage(account.id, SYNC_JOB_KINDS.REPORTS_PERIOD, period.dateFrom, period.dateTo),
    getSyncCoverage(account.id, SYNC_JOB_KINDS.ADVERTISING_STATS, period.dateFrom, period.dateTo),
    countReportRows(account.id, dateFrom, dateTo),
    calculateReport(account.id, period.dateFrom, period.dateTo),
    calculateReport(account.id, comparisonPeriod.dateFrom, comparisonPeriod.dateTo),
    getPlanSummary(account.id, period.dateFrom, period.dateTo),
    getAdvertisingSummary(account.id, period.dateFrom, period.dateTo),
    getFreshnessSummary(account.id, period.dateFrom, period.dateTo),
  ])

  const financialStatus = statusFromCoverage(reportCoverage.isCovered, reportRowsCount)
  const comparisonFinancialStatus = statusFromCoverage(
    comparisonReport.coverage.isCovered,
    comparisonReport.rows.length,
  )

  const revenue = numberOrNull(report.summary.sale, financialStatus)
  const operatingProfit = numberOrNull(report.summary.operatingProfit, financialStatus)
  const marginality = numberOrNull(report.summary.marginality, financialStatus)
  const drr = numberOrNull(report.summary.drr, financialStatus)
  const orders = numberOrNull(report.summary.delivered, financialStatus)
  const returns = numberOrNull(report.summary.returns, financialStatus)

  const comparisonRevenue = numberOrNull(comparisonReport.summary.sale, comparisonFinancialStatus)
  const comparisonOperatingProfit = numberOrNull(comparisonReport.summary.operatingProfit, comparisonFinancialStatus)
  const comparisonMarginality = numberOrNull(comparisonReport.summary.marginality, comparisonFinancialStatus)
  const comparisonDrr = numberOrNull(comparisonReport.summary.drr, comparisonFinancialStatus)
  const comparisonOrders = numberOrNull(comparisonReport.summary.delivered, comparisonFinancialStatus)
  const comparisonReturns = numberOrNull(comparisonReport.summary.returns, comparisonFinancialStatus)

  const productStatus = financialStatus
  const productRows = productStatus === 'missing' ? [] : report.rows
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
  const risks = productRows
    .filter((row) => Number(row.operatingProfit) < 0 || Number(row.drr) >= 20 || (Number(row.costPrice) === 0 && row.boughtWithReturns > 0))
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
    freshnessItems: freshness.items,
    generatedAt,
  })

  return {
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
      returns: metric('Возвраты', returns, comparisonReturns, 'count', financialStatus, 'RealizationReport', reportHint(financialStatus)),
    },
    plan,
    advertising: {
      ...advertising,
      drr,
      status: mergeStatus(advertising.status, advertisingCoverage.isCovered ? 'ready' : advertising.status),
    },
    products: {
      status: productStatus,
      topProfit,
      topRevenue,
      risks,
      source: 'Report calculator output from persisted data',
      hint: productStatus === 'missing' ? 'Синхронизируйте финансовый отчет за выбранный период.' : null,
    },
    freshness,
    problemCenter,
    sourceMap: SOURCE_MAP,
  }
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
      formatDateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))),
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
  const coverage = await getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.ADVERTISING_STATS, dateFrom, dateTo)
  const rows = await prisma.adCampaignStat.findMany({
    where: {
      date: { gte: parseDateKey(dateFrom), lte: parseDateKey(dateTo) },
      campaign: { wbAccountId },
    },
    select: {
      campaignId: true,
      source: true,
      views: true,
      clicks: true,
      spend: true,
      orders: true,
      cartAdds: true,
    },
  })

  const totalRows = rows.filter((row) => row.source === 'total')
  const rowsForTotals = totalRows.length > 0 ? totalRows : rows.filter((row) => row.source !== 'total')
  const status = statusFromCoverage(coverage.isCovered, rowsForTotals.length)

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
      source: 'AdCampaignStat',
      hint: 'Синхронизируйте статистику рекламы за выбранный период.',
    }
  }

  const views = rowsForTotals.reduce((sum, row) => sum + row.views, 0)
  const clicks = rowsForTotals.reduce((sum, row) => sum + row.clicks, 0)
  const spend = rowsForTotals.reduce((sum, row) => sum + Number(row.spend), 0)
  const orders = rowsForTotals.reduce((sum, row) => sum + row.orders, 0)
  const cartAdds = rowsForTotals.reduce((sum, row) => sum + row.cartAdds, 0)

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
    campaigns: new Set(rowsForTotals.map((row) => row.campaignId)).size,
    source: 'AdCampaignStat',
    hint: status === 'partial' ? 'Есть сохраненная статистика, но покрытие периода неполное.' : null,
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
      lastRunAt: null,
      lastSuccessAt: null,
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

  const [lastRun, lastSuccess, activeJobs, failedJobs, coverage, rowCount] = await Promise.all([
    prisma.syncJobRun.findFirst({
      where: { wbAccountId, kind: domain.prismaKind },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.syncJobRun.findFirst({
      where: { wbAccountId, kind: domain.prismaKind, status: 'SUCCEEDED' },
      orderBy: { finishedAt: 'desc' },
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

  return {
    key: domain.key,
    label: domain.label,
    status,
    severity,
    lastRunAt: lastRun?.createdAt.toISOString() ?? null,
    lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    lastCoverageSyncedAt: coverage.syncedAt,
    checkedFrom: dateFrom,
    checkedTo: dateTo,
    staleAfterHours: domain.staleAfterHours,
    activeJobs,
    failedJobs,
    source: domain.source,
    href: withAccount(domain.href, wbAccountId),
    implemented: domain.implemented,
    hint: status === 'ready' ? null : freshnessHint(domain.key),
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
  return 0
}

function freshnessStatus(
  source: DashboardFreshnessDomain,
  isCovered: boolean,
  rowCount: number,
  lastSuccessAt: Date | null,
): DashboardValueStatus {
  if (source === 'products') return rowCount > 0 ? 'ready' : lastSuccessAt ? 'partial' : 'missing'
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

function withAccount(href: string, wbAccountId: string): string {
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}account=${wbAccountId}`
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
  row: {
    nmId: number
    vendorCode: string
    brandName: string
    subjectName: string
    photoUrl: string | null
    sale: string
    operatingProfit: string
    marginality: string
    drr: string
    returns: number
  },
  status: DashboardValueStatus,
): DashboardProductSnapshot {
  return {
    nmId: row.nmId,
    vendorCode: row.vendorCode,
    brandName: row.brandName,
    subjectName: row.subjectName,
    photoUrl: row.photoUrl,
    revenue: Number(row.sale),
    operatingProfit: Number(row.operatingProfit),
    marginality: Number(row.marginality),
    drr: Number(row.drr),
    returns: row.returns,
    status,
  }
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

function numberOrNull(value: unknown, status: DashboardValueStatus): number | null {
  if (status === 'missing') return null
  return Number(value ?? 0)
}

function reportHint(status: DashboardValueStatus): string | null {
  if (status === 'missing') return 'Синхронизируйте финансовый отчет за выбранный период.'
  if (status === 'partial') return 'В базе есть часть строк, но период не закрыт покрытием синхронизации.'
  return null
}

function freshnessHint(key: string): string {
  if (key === 'products') return 'Обновите карточки товаров.'
  if (key === 'reports') return 'Синхронизируйте финансовый отчет.'
  if (key === 'sales-plan') return 'Синхронизируйте продажи, заказы и воронку.'
  return 'Синхронизируйте рекламную статистику.'
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
