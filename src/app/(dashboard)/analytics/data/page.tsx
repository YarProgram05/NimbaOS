import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  AnalyticsEmptyState,
  AnalyticsShell,
  DetailPanel,
  MetricGrid,
  StatusDot,
  detailIcons,
  formatDate,
  formatNumber,
  loadAnalyticsDetail,
  statusText,
  type AnalyticsPageProps,
} from '../analytics-shared'

export default async function AnalyticsDataPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { summary } = detail

  return (
    <AnalyticsShell
      detail={detail}
      active="data"
      title="Свежесть данных и рекомендации"
      description="Покрытие источников, ошибки синхронизаций и действия, которые объясняют сигналы дашборда."
    >
      <MetricGrid
        metrics={[
          { label: 'Активные синхронизации', value: formatNumber(summary.freshness.activeJobs) },
          { label: 'Ошибки', value: formatNumber(summary.freshness.failedJobs) },
          { label: 'Критичные сигналы', value: formatNumber(summary.problemCenter.criticalCount) },
          { label: 'Предупреждения', value: formatNumber(summary.problemCenter.warningCount) },
        ]}
      />
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <DetailPanel label="Источники" title="Покрытие и свежесть" icon={detailIcons.data}>
          <div className="grid gap-2">
            {summary.freshness.items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="grid gap-2 rounded-md border bg-secondary/25 p-2.5 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,auto))] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot status={item.status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.hint || statusText(item.status)}</p>
                  </div>
                </div>
                <SmallStat label="Успех" value={item.lastSuccessAt ? formatDate(item.lastSuccessAt) : 'нет'} />
                <SmallStat label="Ошибки" value={formatNumber(item.failedJobs)} />
                <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-primary">
                  Открыть <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </DetailPanel>
        <DetailPanel label="Фокус" title="Рекомендации" icon={detailIcons.risks}>
          <div className="grid gap-2">
            {summary.recommendations.length > 0 ? summary.recommendations.map((item) => (
              <Link key={item.id} href={item.href} className="rounded-md border bg-secondary/25 p-2.5 transition-colors hover:bg-secondary/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-primary">{item.metric}</span>
                </div>
              </Link>
            )) : (
              <div className="rounded-md border bg-secondary/25 p-4 text-sm text-muted-foreground">
                Срочных рекомендаций нет.
              </div>
            )}
          </div>
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  )
}
