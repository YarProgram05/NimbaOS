import {
  AnalyticsEmptyState,
  AnalyticsShell,
  DetailPanel,
  MetricGrid,
  ProductList,
  detailIcons,
  formatOptionalPercent,
  formatOptionalRub,
  loadAnalyticsDetail,
  metricFromDashboard,
  type AnalyticsPageProps,
} from '../analytics-shared'

export default async function AnalyticsFinancePage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { summary } = detail
  const finance = summary.financialBreakdown

  return (
    <AnalyticsShell
      detail={detail}
      active="finance"
      title="Финансовая детализация"
      description="P&L, расходы, возвраты и товары, которые сильнее всего влияют на результат."
    >
      <MetricGrid
        metrics={[
          metricFromDashboard(summary.kpis.revenue),
          metricFromDashboard(summary.kpis.operatingProfit),
          metricFromDashboard(summary.kpis.marginality),
          metricFromDashboard(summary.kpis.drr),
        ]}
      />
      <section className="grid gap-3 xl:grid-cols-3">
        <DetailPanel label="P&L" title="Ключевые суммы" icon={detailIcons.finance}>
          <div className="grid gap-2">
            {[
              ['К перечислению', formatOptionalRub(finance.toTransfer)],
              ['Себестоимость и самовыкупы', formatOptionalRub(finance.selfPurchases)],
              ['Налоги', formatOptionalRub(finance.taxes)],
              ['Возвраты', formatOptionalRub(finance.returnAmount)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md border bg-secondary/25 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </DetailPanel>
        <DetailPanel label="Расходы" title="Операционные удержания" icon={detailIcons.risks}>
          <div className="grid gap-2">
            {[
              ['Логистика', formatOptionalRub(finance.logistics)],
              ['Хранение', formatOptionalRub(finance.storage)],
              ['Приёмка', formatOptionalRub(finance.acceptance)],
              ['Штрафы', formatOptionalRub(finance.penalties)],
              ['WB реклама', formatOptionalRub(finance.wbAds)],
              ['Внешняя реклама', formatOptionalRub(finance.externalAds)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md border bg-secondary/25 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </DetailPanel>
        <DetailPanel label="Качество" title="Маржинальность и возвраты" icon={detailIcons.products}>
          <div className="grid gap-2">
            {[
              ['Рентабельность', formatOptionalPercent(finance.rentability)],
              ['Маржинальность', formatOptionalPercent(finance.marginality)],
              ['Доля возвратов', formatOptionalPercent(finance.returnRate)],
              ['ОП', formatOptionalRub(finance.operatingProfit)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md border bg-secondary/25 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </DetailPanel>
      </section>
      <section className="grid gap-3 xl:grid-cols-3">
        <DetailPanel label="ТОП" title="По выручке" icon={detailIcons.products}>
          <ProductList rows={detail.products.topRevenue.slice(0, 10)} value={(row) => formatOptionalRub(row.revenue)} />
        </DetailPanel>
        <DetailPanel label="ТОП" title="По операционной прибыли" icon={detailIcons.products}>
          <ProductList rows={detail.products.topProfit.slice(0, 10)} value={(row) => formatOptionalRub(row.operatingProfit)} />
        </DetailPanel>
        <DetailPanel label="Анти-топ" title="Отрицательная прибыль" icon={detailIcons.risks}>
          <ProductList rows={detail.products.negativeProfit.slice(0, 10)} value={(row) => formatOptionalRub(row.operatingProfit)} />
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}
