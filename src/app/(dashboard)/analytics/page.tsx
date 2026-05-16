import {
  AnalyticsEmptyState,
  AnalyticsOverviewCards,
  AnalyticsShell,
  DetailPanel,
  MetricGrid,
  ProductList,
  CampaignList,
  StockList,
  FeedbackList,
  detailIcons,
  formatOptionalNumber,
  formatOptionalPercent,
  formatOptionalRub,
  loadAnalyticsDetail,
  metricFromDashboard,
  type AnalyticsPageProps,
} from './analytics-shared'

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { summary } = detail

  return (
    <AnalyticsShell
      detail={detail}
      active="overview"
      title="Детализация сводных значений"
      description="Сводка собирает график, ТОПы, анти-топы, риски и метрики в одном аналитическом разделе."
    >
      <AnalyticsOverviewCards detail={detail} />
      <MetricGrid
        metrics={[
          metricFromDashboard(summary.kpis.revenue),
          metricFromDashboard(summary.kpis.operatingProfit),
          metricFromDashboard(summary.kpis.drr),
          metricFromDashboard(summary.kpis.orders),
        ]}
      />
      <section className="grid gap-3 xl:grid-cols-2">
        <DetailPanel label="ТОП" title="Товары по операционной прибыли" icon={detailIcons.products}>
          <ProductList rows={detail.products.topProfit.slice(0, 6)} value={(row) => formatOptionalRub(row.operatingProfit)} />
        </DetailPanel>
        <DetailPanel label="Анти-топ" title="Отрицательная прибыль и высокий DRR" icon={detailIcons.risks}>
          <ProductList
            rows={[...detail.products.negativeProfit, ...detail.products.highDrr].slice(0, 6)}
            value={(row) => row.operatingProfit < 0 ? formatOptionalRub(row.operatingProfit) : formatOptionalPercent(row.drr)}
          />
        </DetailPanel>
        <DetailPanel label="Реклама" title="Кампании без заказов" icon={detailIcons.advertising}>
          <CampaignList rows={summary.advertising.inefficientCampaigns} />
        </DetailPanel>
        <DetailPanel label="Остатки" title="Складские риски" icon={detailIcons.stocks}>
          <StockList rows={summary.stocks.items.slice(0, 6)} />
        </DetailPanel>
        <DetailPanel label="Клиенты" title="Срочные отзывы и вопросы" icon={detailIcons.feedback}>
          <FeedbackList rows={summary.feedback.urgentItems.slice(0, 6)} />
        </DetailPanel>
        <DetailPanel label="План" title="Прогноз и темп" icon={detailIcons.finance}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border bg-secondary/25 p-3">
              <p className="metric-label">Прогноз выполнения</p>
              <p className="mt-2 text-lg font-semibold">{formatOptionalPercent(summary.forecasts.planCompletion.forecastCompletionPercent)}</p>
            </div>
            <div className="rounded-md border bg-secondary/25 p-3">
              <p className="metric-label">Нужно в день</p>
              <p className="mt-2 text-lg font-semibold">{formatOptionalNumber(summary.forecasts.unitsNeeded.dailyAverage, 1)} шт.</p>
            </div>
          </div>
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}
