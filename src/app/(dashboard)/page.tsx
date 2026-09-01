import Link from 'next/link'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  LineChart,
  MessageSquareText,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getDashboardSummary } from '@/lib/services/dashboard-summary'
import type {
  ActionRecommendation,
  DashboardIssueSeverity,
  DashboardMetric,
  DashboardPeriodPreset,
  DashboardProductSnapshot,
  DashboardSummary,
  DashboardValueStatus,
} from '@/types/dashboard'
import { DashboardOverviewChartsPanel } from './dashboard-overview-charts'
import { DashboardPeriodControls } from './dashboard-period-controls'

interface DashboardPageProps {
  searchParams: Promise<{
    account?: string
    period?: DashboardPeriodPreset
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getServerSession(authOptions)
  const params = await searchParams
  const storedAccountId = cookies().get('wb_selected_account')?.value
  const summary = await getDashboardSummary({
    accountId: params.account ?? storedAccountId,
    period: params.period,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  })

  if (!summary) {
    return (
      <div className="dashboard-page">
        <section className="old-money-panel rounded-md p-6">
          <p className="metric-label">NimbaOS</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Добавьте кабинет WB</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Дашборд строится только по локально сохранённым данным выбранного кабинета. Подключите кабинет в настройках, затем запустите синхронизацию.
          </p>
          <Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Открыть настройки <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    )
  }

  const name = session?.user?.name ?? 'Пользователь'
  const accountQuery = `account=${summary.account.id}`
  const analyticsQuery = `${accountQuery}&period=${summary.period.preset}&dateFrom=${summary.period.dateFrom}&dateTo=${summary.period.dateTo}`
  const analyticsHref = `/analytics?${analyticsQuery}`
  const chartHref = `/analytics/chart?${analyticsQuery}`
  const financeHref = `/analytics/finance?${analyticsQuery}`
  const advertisingHref = `/analytics/advertising?${analyticsQuery}`
  const stocksHref = `/analytics/stocks?${analyticsQuery}`
  const reviewsHref = `/analytics/feedback?${analyticsQuery}`
  const dataHref = `/analytics/data?${analyticsQuery}`
  const exportRequest = {
    accountId: summary.account.id,
    period: summary.period.preset,
    dateFrom: summary.period.dateFrom,
    dateTo: summary.period.dateTo,
  }

  return (
    <div className="dashboard-page h-auto !gap-2 [@media(min-height:1000px)]:!gap-3 xl:h-full">
      <section className="old-money-panel shrink-0 rounded-md p-3 sm:p-4 [@media(max-height:999px)]:!p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <LineChart className="h-4 w-4 text-primary" />
              Командный центр WB
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Добро пожаловать, {name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {summary.account.name}
                {summary.account.sellerName ? ` - ${summary.account.sellerName}` : ''}. {formatPeriod(summary)}
              </p>
            </div>
          </div>

          <DashboardPeriodControls accountId={summary.account.id} period={summary.period} exportRequest={exportRequest} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CommandPill label="Сформировано" value={formatDateTime(summary.generatedAt)} />
          <CommandPill label="Активные синхронизации" value={String(summary.freshness.activeJobs)} tone={summary.freshness.activeJobs > 0 ? 'active' : 'calm'} />
          <CommandPill label="Критичные сигналы" value={String(summary.problemCenter.criticalCount)} tone={summary.problemCenter.criticalCount > 0 ? 'critical' : 'calm'} />
          <CommandPill label="Предупреждения" value={String(summary.problemCenter.warningCount)} tone={summary.problemCenter.warningCount > 0 ? 'warning' : 'calm'} />
        </div>
      </section>

      <section className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard metric={summary.kpis.revenue} href={financeHref} />
        <KpiCard metric={summary.kpis.operatingProfit} href={financeHref} />
        <KpiCard metric={summary.kpis.marginality} href={financeHref} />
        <KpiCard metric={summary.kpis.drr} href={financeHref} inverseTrend />
        <KpiCard metric={summary.kpis.orders} href={chartHref} />
        <KpiCard metric={summary.kpis.buyouts} href={chartHref} />
      </section>

      <section className="grid min-h-0 gap-2 [@media(min-height:1000px)]:gap-3 xl:flex-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="old-money-panel flex min-h-0 min-w-0 flex-col rounded-md p-3 sm:p-4 [@media(max-height:999px)]:!p-3">
          <PanelHeader
            label={summary.overviewCharts.granularity === 'week' ? 'Динамика по неделям' : 'Динамика по дням'}
            title="Выручка, прибыль, заказы и реклама"
            href={chartHref}
            icon={<LineChart className="h-5 w-5 text-primary" />}
          />
          <div className="mt-2 min-h-0 [@media(min-height:1000px)]:mt-3 xl:flex-1">
            <DashboardOverviewChartsPanel charts={summary.overviewCharts} />
          </div>
        </section>

        <ActionCenterPanel summary={summary} syncHref={dataHref} />
      </section>

      <section className="grid shrink-0 gap-3 xl:grid-cols-6">
        <OverviewCard
          href={financeHref}
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Финансы"
          title="P&L и товары"
          status={summary.financialBreakdown.status}
          metrics={[
            { label: 'К перечислению', value: formatOptionalRub(summary.financialBreakdown.toTransfer) },
            { label: 'Рентабельность', value: formatOptionalPercent(summary.financialBreakdown.rentability) },
            { label: 'Логистика', value: formatOptionalRub(summary.financialBreakdown.logistics) },
            { label: 'Товаров в риске', value: formatNumber(summary.products.risks.length, 0) },
          ]}
          rows={productRows(summary.products.topProfit, 'profit').slice(0, 2)}
        />
        <OverviewCard
          href={analyticsHref}
          icon={<Target className="h-4 w-4" />}
          label="План"
          title="План, прогноз и продажи"
          status={summary.plan.status}
          metrics={[
            { label: 'Прогресс', value: formatOptionalPercent(summary.plan.progressPercent) },
            { label: 'Факт, шт.', value: formatOptionalNumber(summary.plan.factUnits, 0) },
            { label: 'Нужно/день', value: formatOptionalNumber(summary.forecasts.unitsNeeded.dailyAverage, 1) },
            { label: 'Планов', value: String(summary.plan.activePlans) },
          ]}
          rows={[
            compactRow('Прогноз плана', formatOptionalPercent(summary.forecasts.planCompletion.forecastCompletionPercent)),
            compactRow('Темп продаж', `${formatOptionalNumber(summary.forecasts.dailySalesPace.value, 1)} шт./день`),
          ]}
        />
        <OverviewCard
          href={advertisingHref}
          icon={<BarChart3 className="h-4 w-4" />}
          label="Реклама"
          title="Расходы и эффективность"
          status={summary.advertising.status}
          metrics={[
            { label: 'Расход', value: formatOptionalRub(summary.advertising.spend) },
            { label: 'DRR', value: formatOptionalPercent(summary.advertising.drr) },
            { label: 'CTR', value: formatOptionalPercent(summary.advertising.ctr) },
            { label: 'К проверке', value: String(summary.advertising.inefficientCampaigns.length + summary.advertising.campaignsWithoutRecentStats.length) },
          ]}
          rows={campaignRows(summary).slice(0, 2)}
        />
        <OverviewCard
          href={stocksHref}
          icon={<Warehouse className="h-4 w-4" />}
          label="Остатки"
          title="Складские риски"
          status={summary.stocks.status === 'ready' ? 'ready' : 'missing'}
          metrics={[
            { label: 'Всего, шт.', value: formatNumber(summary.stocks.totalUnits, 0) },
            { label: 'Нет остатка', value: String(summary.stocks.outOfStockCount) },
            { label: 'Низкий', value: String(summary.stocks.lowStockCount) },
            { label: 'В пути', value: formatNumber(summary.stocks.inWayToClient + summary.stocks.inWayFromClient, 0) },
          ]}
          rows={summary.forecasts.stockDepletion.productsAtRisk.slice(0, 2).map((item) => compactRow(
            item.vendorCode || `WB ${item.nmId}`,
            item.daysUntilZero === null ? 'нет темпа' : `${formatNumber(item.daysUntilZero, 0)} дн.`,
          ))}
        />
        <OverviewCard
          href={reviewsHref}
          icon={<MessageSquareText className="h-4 w-4" />}
          label="Клиенты"
          title="Отзывы и вопросы"
          status={summary.feedback.status === 'ready' ? 'ready' : 'missing'}
          metrics={[
            { label: 'Оценка', value: formatOptionalNumber(summary.feedback.averageRating, 2) },
            { label: 'Негатив', value: String(summary.feedback.negativeReviews) },
            { label: 'Отзывы без ответа', value: String(summary.feedback.unansweredReviews) },
            { label: 'Вопросы без ответа', value: String(summary.feedback.unansweredQuestions) },
          ]}
          rows={summary.feedback.urgentItems.slice(0, 2).map((item) => compactRow(
            item.vendorCode ?? `WB ${item.nmId}`,
            item.rating ? `${item.rating}/5` : 'вопрос',
          ))}
        />
        <OverviewCard
          href={dataHref}
          icon={<RefreshCw className="h-4 w-4" />}
          label="Данные"
          title="Свежесть и покрытие"
          status={summary.freshness.criticalCount > 0 ? 'missing' : summary.freshness.warningCount > 0 ? 'partial' : 'ready'}
          metrics={[
            { label: 'Готово', value: String(summary.freshness.items.filter((item) => item.status === 'ready').length) },
            { label: 'Частично', value: String(summary.freshness.items.filter((item) => item.status === 'partial').length) },
            { label: 'Нет данных', value: String(summary.freshness.items.filter((item) => item.status === 'missing').length) },
            { label: 'Ошибки', value: String(summary.freshness.failedJobs) },
          ]}
          rows={summary.freshness.items
            .filter((item) => item.status !== 'ready' || item.failedJobs > 0 || item.isStale)
            .slice(0, 2)
            .map((item) => compactRow(item.label, item.failedJobs > 0 ? `${item.failedJobs} ошибок` : statusText(item.status)))}
        />
      </section>
    </div>
  )
}

function CommandPill({
  label,
  value,
  tone = 'calm',
}: {
  label: string
  value: string
  tone?: 'calm' | 'active' | 'warning' | 'critical'
}) {
  const toneClass = {
    calm: 'border-border bg-secondary/35 text-muted-foreground',
    active: 'border-primary/30 bg-primary/10 text-primary',
    warning: 'border-amber-600/30 bg-amber-600/10 text-amber-700',
    critical: 'border-destructive/30 bg-destructive/10 text-destructive',
  }[tone]

  return (
    <span className={`inline-flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${toneClass}`}>
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold text-foreground">{value}</span>
    </span>
  )
}

function KpiCard({
  metric,
  href,
  inverseTrend = false,
}: {
  metric: DashboardMetric
  href: string
  inverseTrend?: boolean
}) {
  const change = metric.changePercent
  const isGood = change === null ? true : inverseTrend ? change <= 0 : change >= 0
  const TrendIcon = (change ?? 0) >= 0 ? TrendingUp : TrendingDown

  return (
    <Link href={href} className="old-money-panel min-w-0 rounded-md p-3 transition-colors hover:bg-secondary/60">
      <div className="flex items-start justify-between gap-2">
        <p className="metric-label truncate">{metric.label}</p>
        <StatusDot status={metric.status} />
      </div>
      <p className="mt-2 truncate text-lg font-semibold tracking-tight xl:text-xl">{formatMetricValue(metric)}</p>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        {change === null ? (
          <span className="truncate">{metric.status === 'missing' ? 'нет данных' : 'без сравнения'}</span>
        ) : (
          <>
            <TrendIcon className={`h-3.5 w-3.5 ${isGood ? 'text-primary' : 'text-destructive'}`} />
            <span className={isGood ? 'truncate text-primary' : 'truncate text-destructive'}>
              {formatSignedPercent(change)}
            </span>
          </>
        )}
      </div>
    </Link>
  )
}

function ActionCenterPanel({ summary, syncHref }: { summary: DashboardSummary; syncHref: string }) {
  const visibleRecommendations = summary.recommendations.slice(0, 3)
  const hiddenCount = Math.max(0, summary.recommendations.length - visibleRecommendations.length)

  return (
    <section className="old-money-panel rounded-md p-3 sm:p-4 [@media(max-height:999px)]:!p-3 xl:h-full">
      <PanelHeader
        label="Фокус"
        title="Что проверить сейчас"
        href={syncHref}
        icon={<AlertTriangle className="h-5 w-5 text-primary" />}
      />
      <div className="mt-3 grid gap-2">
        {visibleRecommendations.length === 0 ? (
          <ActionRow
            item={{
              id: 'calm',
              severity: 'info',
              category: 'data_stale',
              title: 'Критичных сигналов нет',
              description: 'По текущим правилам дашборда срочных действий не найдено.',
              metric: null,
              href: syncHref,
              createdAt: summary.generatedAt,
            }}
          />
        ) : visibleRecommendations.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
        {hiddenCount > 0 && (
          <Link href={syncHref} className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
            Ещё {hiddenCount} рекомендаций <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  )
}

function ActionRow({ item }: { item: ActionRecommendation }) {
  return (
    <Link
      href={item.href}
      className="flex min-h-[50px] items-start justify-between gap-3 rounded-md border bg-secondary/35 p-2.5 text-sm transition-colors hover:bg-secondary/70"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-semibold">
          <SeverityDot severity={item.severity} />
          <span className="truncate">{item.title}</span>
        </span>
        <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
        {item.metric}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

function PanelHeader({
  label,
  title,
  href,
  icon,
}: {
  label: string
  title: string
  href: string
  icon: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="metric-label truncate">{label}</p>
        <h2 className="mt-1 truncate text-base font-semibold">{title}</h2>
      </div>
      <Link href={href} className="flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
        {icon}
        <span>Детализация</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function OverviewCard({
  href,
  icon,
  label,
  title,
  status,
  metrics,
  rows,
}: {
  href: string
  icon: ReactNode
  label: string
  title: string
  status: DashboardValueStatus
  metrics: Array<{ label: string; value: string }>
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <Link href={href} className="old-money-panel flex min-h-[118px] flex-col rounded-md p-3 transition-colors hover:bg-secondary/60 2xl:min-h-[168px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 rounded-md border bg-secondary/50 p-1.5 text-primary">{icon}</span>
          <span className="min-w-0">
            <span className="metric-label block truncate">{label}</span>
            <span className="mt-1 block truncate text-sm font-semibold">{title}</span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          <span className="hidden 2xl:inline">Детализация</span>
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.slice(0, 4).map((metric, index) => (
          <div key={metric.label} className={`min-w-0 rounded-md border bg-secondary/30 px-2 py-1.5 ${index > 1 ? 'hidden 2xl:block' : ''}`}>
            <p className="truncate text-[11px] text-muted-foreground">{metric.label}</p>
            <p className="mt-0.5 truncate text-sm font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 hidden min-h-[43px] divide-y 2xl:block">
        {rows.length > 0 ? rows.slice(0, 2).map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3 py-1.5 text-xs">
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="shrink-0 font-semibold">{row.value}</span>
          </div>
        )) : (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <StatusDot status={status} />
            <span>{statusText(status)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

function StatusDot({ status }: { status: DashboardValueStatus }) {
  const className = status === 'ready'
    ? 'bg-primary'
    : status === 'partial'
      ? 'bg-amber-600'
      : status === 'not_applicable'
        ? 'bg-muted-foreground'
        : 'bg-destructive'

  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} title={statusText(status)} />
}

function SeverityDot({ severity }: { severity: DashboardIssueSeverity }) {
  const className = severity === 'critical'
    ? 'bg-destructive'
    : severity === 'warning'
      ? 'bg-amber-600'
      : 'bg-primary'

  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
}

type ProductRowsMetric = 'profit' | 'revenue'

function productRows(rows: DashboardProductSnapshot[], metric: ProductRowsMetric) {
  return rows.map((row) => compactRow(
    row.vendorCode || `WB ${row.nmId}`,
    metric === 'revenue' ? formatRub(row.revenue) : formatRub(row.operatingProfit),
  ))
}

function campaignRows(summary: DashboardSummary) {
  return [
    ...summary.advertising.inefficientCampaigns.map((row) => compactRow(row.name, formatRub(row.spend))),
    ...summary.advertising.campaignsWithoutRecentStats.map((row) => compactRow(row.name, row.lastStatDate ? formatDate(row.lastStatDate) : 'нет статистики')),
  ]
}

function compactRow(label: string, value: string) {
  return { label, value }
}

function formatMetricValue(metric: DashboardMetric): string {
  if (metric.value === null) return 'Нет данных'
  if (metric.unit === 'rub') return formatRub(metric.value)
  if (metric.unit === 'percent') return formatPercent(metric.value)
  return formatNumber(metric.value, 0)
}

function formatPeriod(summary: DashboardSummary): string {
  return `${formatDate(summary.period.dateFrom)} - ${formatDate(summary.period.dateTo)}`
}

function formatOptionalRub(value: number | null): string {
  return value === null ? 'Нет данных' : formatRub(value)
}

function formatOptionalPercent(value: number | null): string {
  return value === null ? 'Нет данных' : formatPercent(value)
}

function formatOptionalNumber(value: number | null, digits = 1): string {
  return value === null ? 'Нет данных' : formatNumber(value, digits)
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value, 1)}%`
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value))
}

function formatDateTime(value: string | null): string {
  if (!value) return 'нет данных'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusText(status: DashboardValueStatus): string {
  if (status === 'ready') return 'данные готовы'
  if (status === 'partial') return 'частичное покрытие'
  if (status === 'not_applicable') return 'не применимо'
  return 'нет данных'
}
