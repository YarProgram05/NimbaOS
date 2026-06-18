import { DashboardOverviewChartsPanel } from '../../dashboard-overview-charts'
import { calculateReport, REPORT_CALCULATION_OPTIONS } from '@/lib/services/report-calculator'
import type { DashboardPeriod } from '@/types/dashboard'
import type { ReportData } from '@/types/reports'
import {
  AnalyticsEmptyState,
  AnalyticsShell,
  DetailPanel,
  MetricGrid,
  formatNumber,
  formatOptionalRub,
  formatRub,
  loadAnalyticsDetail,
  metricFromDashboard,
  statusText,
  type AnalyticsPageProps,
} from '../analytics-shared'
import {
  ArticleComparisonChart,
  type ArticleChartMetrics,
  type ArticleChartOption,
  type ArticleChartPoint,
} from './article-comparison-chart'

export default async function AnalyticsChartPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { summary } = detail
  const params = await searchParams
  const requestedArticleKeys = parseSelectedArticles(params.articles)
  const articleChart = await buildArticleChart(summary.account.id, summary.period, requestedArticleKeys)

  return (
    <AnalyticsShell
      detail={detail}
      active="chart"
      title="Полная динамика"
      description="График использует те же расчёты, что главный экран и финансовый отчёт."
    >
      <MetricGrid
        metrics={[
          metricFromDashboard(summary.kpis.revenue),
          metricFromDashboard(summary.kpis.operatingProfit),
          metricFromDashboard(summary.kpis.orders),
          metricFromDashboard(summary.kpis.buyouts),
        ]}
      />
      <DetailPanel label={summary.overviewCharts.granularity === 'week' ? 'По неделям' : 'По дням'} title="Выручка, ОП, заказы, выкупы и реклама">
        <DashboardOverviewChartsPanel charts={summary.overviewCharts} variant="full" />
      </DetailPanel>
      <DetailPanel label="Артикулы" title="Сравнение выбранных артикулов">
        <ArticleComparisonChart
          options={articleChart.options}
          selectedArticleKeys={articleChart.selectedArticleKeys}
          points={articleChart.points}
        />
      </DetailPanel>
      <DetailPanel label="Проверка данных" title="Значения точек графика">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Период</th>
                <th className="px-3 py-2 text-right">Выручка</th>
                <th className="px-3 py-2 text-right">ОП</th>
                <th className="px-3 py-2 text-right">Заказы</th>
                <th className="px-3 py-2 text-right">Выкупы</th>
                <th className="px-3 py-2 text-right">Реклама</th>
                <th className="px-3 py-2 text-left">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-card/70">
              {summary.overviewCharts.trend.map((point) => (
                <tr key={`${point.dateFrom}-${point.dateTo}`}>
                  <td className="px-3 py-2 font-medium">{point.label}</td>
                  <td className="px-3 py-2 text-right">{formatOptionalRub(point.revenue)}</td>
                  <td className="px-3 py-2 text-right">{formatOptionalRub(point.operatingProfit)}</td>
                  <td className="px-3 py-2 text-right">{point.orders === null ? 'Нет данных' : formatNumber(point.orders)}</td>
                  <td className="px-3 py-2 text-right">{point.buyouts === null ? 'Нет данных' : formatNumber(point.buyouts)}</td>
                  <td className="px-3 py-2 text-right">{point.adSpend === null ? 'Нет данных' : formatRub(point.adSpend)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{statusText(point.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailPanel>
    </AnalyticsShell>
  )
}

async function buildArticleChart(
  accountId: string,
  period: DashboardPeriod,
  requestedArticleKeys: string[],
): Promise<{
  options: ArticleChartOption[]
  selectedArticleKeys: string[]
  points: ArticleChartPoint[]
}> {
  const report = await calculateReport(accountId, period.dateFrom, period.dateTo, REPORT_CALCULATION_OPTIONS)
  const rows = report.rows.filter((row) => row.nmId > 0 && !row.isSizeRow)
  const options = rows
    .map((row) => ({
      key: articleKey(row.nmId, row.vendorCode),
      nmId: row.nmId,
      vendorCode: row.vendorCode,
      brandName: row.brandName,
      subjectName: row.subjectName,
      photoUrl: row.photoUrl,
      revenue: Number(row.sale),
    }))
    .sort((a, b) => b.revenue - a.revenue || a.vendorCode.localeCompare(b.vendorCode, 'ru', { sensitivity: 'base' }))

  const availableKeys = new Set(options.map((option) => option.key))
  const normalizedRequestedKeys = requestedArticleKeys.flatMap((key) => {
    if (availableKeys.has(key)) return [key]
    const legacyNmId = Number(key)
    if (!Number.isInteger(legacyNmId) || legacyNmId <= 0) return []
    return options.filter((option) => option.nmId === legacyNmId).slice(0, 1).map((option) => option.key)
  })
  const selectedArticleKeys = (normalizedRequestedKeys.length > 0 ? normalizedRequestedKeys : options.slice(0, 1).map((option) => option.key))
    .filter((key, index, list) => availableKeys.has(key) && list.indexOf(key) === index)
    .slice(0, 6)

  const buckets = buildBuckets(period)
  const bucketReports = await Promise.all(
    buckets.map((bucket) => calculateReport(accountId, bucket.dateFrom, bucket.dateTo, REPORT_CALCULATION_OPTIONS)),
  )

  const points = buckets.map((bucket, index) => ({
    label: bucket.label,
    dateFrom: bucket.dateFrom,
    dateTo: bucket.dateTo,
    values: metricsByArticles(bucketReports[index]),
  }))

  return { options, selectedArticleKeys, points }
}

function metricsByArticles(report: ReportData): Record<string, ArticleChartMetrics> {
  return Object.fromEntries(report.rows
    .filter((row) => row.nmId > 0 && !row.isSizeRow)
    .map((row) => {
    return [
      articleKey(row.nmId, row.vendorCode),
      {
        revenue: Number(row.sale),
        operatingProfit: Number(row.operatingProfit),
        orders: Number(row.delivered),
        buyouts: Number(row.boughtWithReturns),
        adSpend: Number(row.adAll),
      },
    ]
  }))
}

function parseSelectedArticles(value?: string): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => decodeURIComponent(item.trim()))
    .filter(Boolean)
}

function articleKey(nmId: number, vendorCode: string): string {
  return `${nmId}::${vendorCode}`
}

function buildBuckets(period: DashboardPeriod): Array<{ dateFrom: string; dateTo: string; label: string }> {
  const from = parseDateKey(period.dateFrom)
  const to = parseDateKey(period.dateTo)
  const useWeeks = period.days > 31
  const buckets: Array<{ dateFrom: string; dateTo: string; label: string }> = []
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

  return buckets
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b
}
