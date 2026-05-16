import {
  AnalyticsEmptyState,
  AnalyticsShell,
  DetailPanel,
  ProductList,
  detailIcons,
  formatOptionalPercent,
  formatOptionalRub,
  loadAnalyticsDetail,
  type AnalyticsPageProps,
} from '../analytics-shared'

export default async function AnalyticsProductsPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  return (
    <AnalyticsShell
      detail={detail}
      active="products"
      title="ТОП и анти-топ товаров"
      description="Карточки показывают артикулы, которые сильнее всего помогают или вредят результату периода."
    >
      <section className="grid gap-3 xl:grid-cols-2">
        <DetailPanel label="ТОП" title="Выручка" icon={detailIcons.products}>
          <ProductList rows={detail.products.topRevenue} value={(row) => formatOptionalRub(row.revenue)} />
        </DetailPanel>
        <DetailPanel label="ТОП" title="Операционная прибыль" icon={detailIcons.products}>
          <ProductList rows={detail.products.topProfit} value={(row) => formatOptionalRub(row.operatingProfit)} />
        </DetailPanel>
        <DetailPanel label="Анти-топ" title="Отрицательная прибыль" icon={detailIcons.risks}>
          <ProductList rows={detail.products.negativeProfit} value={(row) => formatOptionalRub(row.operatingProfit)} />
        </DetailPanel>
        <DetailPanel label="Анти-топ" title="Высокий DRR" icon={detailIcons.risks}>
          <ProductList rows={detail.products.highDrr} value={(row) => formatOptionalPercent(row.drr)} />
        </DetailPanel>
        <DetailPanel label="Риски" title="Высокая логистика" icon={detailIcons.risks}>
          <ProductList rows={detail.products.highLogisticsShare} value={(row) => formatOptionalPercent(row.logisticsShare)} />
        </DetailPanel>
        <DetailPanel label="Риски" title="Высокое хранение" icon={detailIcons.risks}>
          <ProductList rows={detail.products.highStorageShare} value={(row) => formatOptionalPercent(row.storageShare)} />
        </DetailPanel>
        <DetailPanel label="Риски" title="Нет себестоимости" icon={detailIcons.risks}>
          <ProductList rows={detail.products.missingCostPrice} value={(row) => formatOptionalRub(row.revenue)} />
        </DetailPanel>
        <DetailPanel label="Риски" title="Высокий возврат" icon={detailIcons.risks}>
          <ProductList rows={detail.products.highReturnRate} value={(row) => formatOptionalPercent(row.returnRate)} />
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}
