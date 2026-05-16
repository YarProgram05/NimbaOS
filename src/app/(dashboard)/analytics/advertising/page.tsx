import {
  AnalyticsEmptyState,
  AnalyticsShell,
  CampaignList,
  DetailPanel,
  MetricGrid,
  detailIcons,
  formatNumber,
  formatOptionalPercent,
  formatOptionalRub,
  loadAnalyticsDetail,
  type AnalyticsPageProps,
} from '../analytics-shared'

export default async function AnalyticsAdvertisingPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { advertising } = detail.summary

  return (
    <AnalyticsShell
      detail={detail}
      active="advertising"
      title="Рекламная детализация"
      description="Расходы, эффективность и кампании, которые нужно проверить."
    >
      <MetricGrid
        metrics={[
          { label: 'Расход', value: formatOptionalRub(advertising.spend), status: advertising.status },
          { label: 'DRR', value: formatOptionalPercent(advertising.drr), status: advertising.status },
          { label: 'CTR', value: formatOptionalPercent(advertising.ctr), status: advertising.status },
          { label: 'CPC', value: formatOptionalRub(advertising.cpc), status: advertising.status },
          { label: 'Показы', value: formatNumber(advertising.views ?? 0), status: advertising.status },
          { label: 'Клики', value: formatNumber(advertising.clicks ?? 0), status: advertising.status },
          { label: 'Заказы из рекламы', value: formatNumber(advertising.orders ?? 0), status: advertising.status },
          { label: 'В корзину', value: formatNumber(advertising.cartAdds ?? 0), status: advertising.status },
        ]}
      />
      <section className="grid gap-3 xl:grid-cols-2">
        <DetailPanel label="Анти-топ" title="Кампании с расходом без заказов" icon={detailIcons.risks}>
          <CampaignList rows={advertising.inefficientCampaigns} />
        </DetailPanel>
        <DetailPanel label="Свежесть" title="Активные кампании без свежей статистики" icon={detailIcons.advertising}>
          <CampaignList rows={advertising.campaignsWithoutRecentStats} />
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}
