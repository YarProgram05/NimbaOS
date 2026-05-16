import { DashboardOverviewChartsPanel } from '../../dashboard-overview-charts'
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

export default async function AnalyticsChartPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { summary } = detail

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
