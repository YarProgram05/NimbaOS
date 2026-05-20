import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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
  formatRub,
  loadAnalyticsDetail,
  type AnalyticsPageProps,
} from '../analytics-shared'
import type { DashboardAnalyticsDetail } from '@/lib/services/dashboard-analytics-detail'
import type { DashboardAdvertisingCampaignSnapshot } from '@/types/dashboard'

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
        <DetailPanel label="Активность" title="Кампании с активностью в выбранном периоде" icon={detailIcons.advertising}>
          <ActiveCampaignList detail={detail} rows={advertising.activeCampaigns} />
        </DetailPanel>
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

function ActiveCampaignList({
  detail,
  rows,
}: {
  detail: DashboardAnalyticsDetail
  rows: DashboardAdvertisingCampaignSnapshot[]
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-secondary/25 p-4 text-sm text-muted-foreground">
        Нет кампаний с активностью в выбранном периоде.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={campaignHref(detail, row)}
          className="grid gap-2 rounded-md border bg-secondary/25 p-2.5 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(80px,auto))_auto] sm:items-center"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.name}</p>
            <p className="text-xs text-muted-foreground">
              ID {row.advertId}{row.lastStatDate ? ` · последняя статистика ${formatDateShort(row.lastStatDate)}` : ''}
            </p>
          </div>
          <MiniMetric label="Расход" value={formatRub(row.spend)} />
          <MiniMetric label="Заказы" value={formatNumber(row.orders)} />
          <MiniMetric label="Клики" value={formatNumber(row.clicks)} />
          <span className="flex items-center justify-end gap-1 text-xs font-semibold text-primary">
            Статистика <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      ))}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-card/70 px-2 py-1.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function campaignHref(detail: DashboardAnalyticsDetail, row: DashboardAdvertisingCampaignSnapshot) {
  const { summary } = detail
  const params = new URLSearchParams({
    account: summary.account.id,
    period: summary.period.preset,
    dateFrom: summary.period.dateFrom,
    dateTo: summary.period.dateTo,
  })

  return `/advertising/${row.id}?${params.toString()}`
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value))
}
