import {
  AnalyticsEmptyState,
  AnalyticsShell,
  DetailPanel,
  MetricGrid,
  StockList,
  detailIcons,
  formatNumber,
  formatOptionalNumber,
  formatOptionalRub,
  loadAnalyticsDetail,
  type AnalyticsPageProps,
} from '../analytics-shared'

export default async function AnalyticsStocksPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { stocks, forecasts } = detail.summary

  return (
    <AnalyticsShell
      detail={detail}
      active="stocks"
      title="Детализация остатков"
      description="Складские риски, товары без остатка, низкий запас и прогноз потребности."
    >
      <MetricGrid
        metrics={[
          { label: 'Всего, шт.', value: formatNumber(stocks.totalUnits), status: stocks.status },
          { label: 'Стоимость остатков', value: formatOptionalRub(stocks.stockValue), status: stocks.status },
          { label: 'Нет остатка', value: formatNumber(stocks.outOfStockCount), status: stocks.status },
          { label: 'Низкий остаток', value: formatNumber(stocks.lowStockCount), status: stocks.status },
          { label: 'Избыток', value: formatNumber(stocks.overstockCount), status: stocks.status },
          { label: 'В пути к клиенту', value: formatNumber(stocks.inWayToClient), status: stocks.status },
          { label: 'В пути от клиента', value: formatNumber(stocks.inWayFromClient), status: stocks.status },
          { label: 'Нужно запаса', value: formatOptionalNumber(forecasts.stockNeeded.value, 0), status: forecasts.stockNeeded.status },
        ]}
      />
      <section className="grid gap-3 xl:grid-cols-2">
        <DetailPanel label="Риски" title="Нет остатка" icon={detailIcons.stocks}>
          <StockList rows={stocks.items.filter((row) => row.risk === 'out_of_stock')} />
        </DetailPanel>
        <DetailPanel label="Риски" title="Низкий остаток" icon={detailIcons.risks}>
          <StockList rows={stocks.items.filter((row) => row.risk === 'low_stock')} />
        </DetailPanel>
        <DetailPanel label="Прогноз" title="Товары, которые могут закончиться" icon={detailIcons.risks}>
          <div className="grid gap-2">
            {forecasts.stockDepletion.productsAtRisk.length > 0 ? forecasts.stockDepletion.productsAtRisk.map((row) => (
              <div key={row.nmId} className="grid gap-2 rounded-md border bg-secondary/25 p-2.5 sm:grid-cols-[minmax(0,1fr)_repeat(2,minmax(80px,auto))] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.vendorCode || `WB ${row.nmId}`}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.title || 'Название не указано'}</p>
                </div>
                <div className="text-sm font-semibold">{formatNumber(row.quantity)} шт.</div>
                <div className="text-sm font-semibold">{row.daysUntilZero === null ? 'нет темпа' : `${formatNumber(row.daysUntilZero, 0)} дн.`}</div>
              </div>
            )) : (
              <div className="rounded-md border bg-secondary/25 p-4 text-sm text-muted-foreground">Нет товаров с прогнозом исчерпания.</div>
            )}
          </div>
        </DetailPanel>
        <DetailPanel label="Риски" title="Избыток или нет продаж" icon={detailIcons.risks}>
          <StockList rows={stocks.items.filter((row) => row.risk === 'overstock' || row.risk === 'no_sales')} />
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}
