import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Database,
  LineChart,
  MessageSquareText,
  PackageSearch,
  Warehouse,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getDashboardAnalyticsDetail, type DashboardAnalyticsDetail } from '@/lib/services/dashboard-analytics-detail'
import type {
  DashboardAdvertisingCampaignSnapshot,
  DashboardMetric,
  DashboardPeriodPreset,
  DashboardProductSnapshot,
  DashboardValueStatus,
} from '@/types/dashboard'
import type { StockSummaryItem } from '@/types/stocks'
import type { FeedbackWorkloadItem } from '@/types/feedback'
import { AnalyticsPeriodPicker } from './analytics-period-picker'

export interface AnalyticsPageProps {
  searchParams: Promise<{
    account?: string
    period?: DashboardPeriodPreset
    dateFrom?: string
    dateTo?: string
  }>
}

export type AnalyticsSection =
  | 'overview'
  | 'chart'
  | 'finance'
  | 'products'
  | 'advertising'
  | 'stocks'
  | 'feedback'
  | 'data'

export async function loadAnalyticsDetail(
  searchParams: AnalyticsPageProps['searchParams'],
): Promise<DashboardAnalyticsDetail | null> {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams
  const storedAccountId = cookies().get('wb_selected_account')?.value
  return getDashboardAnalyticsDetail({
    accountId: params.account ?? storedAccountId,
    period: params.period,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  })
}

export function AnalyticsEmptyState() {
  return (
    <div className="dashboard-page">
      <section className="old-money-panel rounded-md p-6">
        <p className="metric-label">Аналитика</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Добавьте кабинет WB</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Детализация строится по локально сохранённым данным выбранного кабинета. Подключите кабинет и запустите синхронизацию.
        </p>
        <Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          Открыть настройки <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}

export function AnalyticsShell({
  detail,
  active,
  title,
  description,
  children,
}: {
  detail: DashboardAnalyticsDetail
  active: AnalyticsSection
  title: string
  description: string
  children: ReactNode
}) {
  const { summary } = detail
  const query = analyticsQuery(detail)
  const sections: Array<{ key: AnalyticsSection; label: string; href: string }> = [
    { key: 'overview', label: 'Обзор', href: `/analytics?${query}` },
    { key: 'chart', label: 'График', href: `/analytics/chart?${query}` },
    { key: 'finance', label: 'Финансы', href: `/analytics/finance?${query}` },
    { key: 'products', label: 'Товары', href: `/analytics/products?${query}` },
    { key: 'advertising', label: 'Реклама', href: `/analytics/advertising?${query}` },
    { key: 'stocks', label: 'Остатки', href: `/analytics/stocks?${query}` },
    { key: 'feedback', label: 'Клиенты', href: `/analytics/feedback?${query}` },
    { key: 'data', label: 'Данные', href: `/analytics/data?${query}` },
  ]

  return (
    <div className="dashboard-page gap-3">
      <section className="old-money-panel rounded-md p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="metric-label">Аналитика WB</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {summary.account.name}
              {summary.account.sellerName ? ` - ${summary.account.sellerName}` : ''}. {formatDate(summary.period.dateFrom)} - {formatDate(summary.period.dateTo)}. {description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <AnalyticsPeriodPicker accountId={summary.account.id} period={summary.period} />
            <Link href={`/?account=${summary.account.id}&period=${summary.period.preset}&dateFrom=${summary.period.dateFrom}&dateTo=${summary.period.dateTo}`} className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
              На главный экран <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {sections.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              className={[
                'shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                active === section.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary',
              ].join(' ')}
            >
              {section.label}
            </Link>
          ))}
        </div>
      </section>
      {children}
    </div>
  )
}

export function AnalyticsOverviewCards({ detail }: { detail: DashboardAnalyticsDetail }) {
  const query = analyticsQuery(detail)
  const { summary } = detail
  const cards = [
    {
      href: `/analytics/chart?${query}`,
      icon: <LineChart className="h-4 w-4" />,
      label: 'График',
      title: 'Полная динамика',
      metrics: [
        metricLine('Точек', String(summary.overviewCharts.trend.length)),
        metricLine('Выручка', formatOptionalRub(summary.financialBreakdown.revenue)),
      ],
    },
    {
      href: `/analytics/finance?${query}`,
      icon: <CircleDollarSign className="h-4 w-4" />,
      label: 'Финансы',
      title: 'P&L и структура расходов',
      metrics: [
        metricLine('ОП', formatOptionalRub(summary.financialBreakdown.operatingProfit)),
        metricLine('Маржа', formatOptionalPercent(summary.financialBreakdown.marginality)),
      ],
    },
    {
      href: `/analytics/products?${query}`,
      icon: <PackageSearch className="h-4 w-4" />,
      label: 'Товары',
      title: 'ТОП и анти-топ',
      metrics: [
        metricLine('В риске', String(detail.products.negativeProfit.length + detail.products.highDrr.length)),
        metricLine('Без себестоимости', String(detail.products.missingCostPrice.length)),
      ],
    },
    {
      href: `/analytics/advertising?${query}`,
      icon: <BarChart3 className="h-4 w-4" />,
      label: 'Реклама',
      title: 'Расходы и кампании',
      metrics: [
        metricLine('Расход', formatOptionalRub(summary.advertising.spend)),
        metricLine('Без заказов', String(summary.advertising.inefficientCampaigns.length)),
      ],
    },
    {
      href: `/analytics/stocks?${query}`,
      icon: <Warehouse className="h-4 w-4" />,
      label: 'Остатки',
      title: 'Складские риски',
      metrics: [
        metricLine('Нет остатка', String(summary.stocks.outOfStockCount)),
        metricLine('Низкий', String(summary.stocks.lowStockCount)),
      ],
    },
    {
      href: `/analytics/feedback?${query}`,
      icon: <MessageSquareText className="h-4 w-4" />,
      label: 'Клиенты',
      title: 'Отзывы и вопросы',
      metrics: [
        metricLine('Негатив', String(summary.feedback.negativeReviews)),
        metricLine('Без ответа', String(summary.feedback.unansweredReviews + summary.feedback.unansweredQuestions)),
      ],
    },
    {
      href: `/analytics/data?${query}`,
      icon: <Database className="h-4 w-4" />,
      label: 'Данные',
      title: 'Свежесть и действия',
      metrics: [
        metricLine('Ошибки', String(summary.freshness.failedJobs)),
        metricLine('Рекомендаций', String(summary.recommendations.length)),
      ],
    },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="old-money-panel min-w-0 rounded-md p-3 transition-colors hover:bg-secondary/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 rounded-md border bg-secondary/50 p-1.5 text-primary">{card.icon}</span>
              <span className="min-w-0">
                <span className="metric-label block truncate">{card.label}</span>
                <span className="mt-1 block truncate text-sm font-semibold">{card.title}</span>
              </span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {card.metrics.map((metric) => (
              <MetricMini key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>
        </Link>
      ))}
    </section>
  )
}

export function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: string; status?: DashboardValueStatus }> }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="old-money-panel rounded-md p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="metric-label truncate">{metric.label}</p>
            {metric.status && <StatusDot status={metric.status} />}
          </div>
          <p className="mt-2 truncate text-lg font-semibold tracking-tight">{metric.value}</p>
        </div>
      ))}
    </section>
  )
}

export function DetailPanel({
  title,
  label,
  children,
  icon,
}: {
  title: string
  label: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <section className="old-money-panel rounded-md p-3 sm:p-4">
      <div className="mb-3 flex items-start gap-2">
        {icon && <span className="mt-0.5 rounded-md border bg-secondary/50 p-1.5 text-primary">{icon}</span>}
        <div className="min-w-0">
          <p className="metric-label truncate">{label}</p>
          <h2 className="mt-1 truncate text-base font-semibold">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}

export function ProductList({
  rows,
  value,
  empty = '\u041d\u0435\u0442 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0431\u043b\u043e\u043a\u0430',
}: {
  rows: DashboardProductSnapshot[]
  value: (row: DashboardProductSnapshot) => string
  empty?: string
}) {
  if (rows.length === 0) return <EmptyPanel text={empty} />

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <ProductListItem key={`${row.nmId}-${row.vendorCode}`} row={row} value={value} />
      ))}
    </div>
  )
}

function ProductListItem({
  row,
  value,
}: {
  row: DashboardProductSnapshot
  value: (row: DashboardProductSnapshot) => string
}) {
  const content = (
    <div className={`flex min-w-0 items-center justify-between gap-3 rounded-md border bg-secondary/25 p-2.5 ${row.isSizeRow ? 'ml-4' : ''}`}>
      <div className="flex min-w-0 items-center gap-2">
        {row.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-card text-xs text-muted-foreground">
            WB
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{row.vendorCode || `WB ${row.nmId}`}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.brandName || '\u0411\u0440\u0435\u043d\u0434 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d'} · {row.subjectName || '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430'}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{value(row)}</p>
        <p className="text-[11px] text-muted-foreground">WB {row.nmId}</p>
      </div>
    </div>
  )

  if (!row.sizeRows?.length) return content

  return (
    <details>
      <summary className="list-none cursor-pointer marker:hidden">
        {content}
      </summary>
      <div className="mt-1 grid gap-1.5">
        {row.sizeRows.map((sizeRow) => (
          <ProductListItem key={`${sizeRow.nmId}-${sizeRow.vendorCode}`} row={sizeRow} value={value} />
        ))}
      </div>
    </details>
  )
}

export function CampaignList({ rows, empty = 'Нет кампаний для проверки' }: { rows: DashboardAdvertisingCampaignSnapshot[]; empty?: string }) {
  if (rows.length === 0) return <EmptyPanel text={empty} />

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-2 rounded-md border bg-secondary/25 p-2.5 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(80px,auto))] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.name}</p>
            <p className="text-xs text-muted-foreground">ID {row.advertId}{row.lastStatDate ? ` · ${formatDate(row.lastStatDate)}` : ''}</p>
          </div>
          <MetricMini label="Расход" value={formatRub(row.spend)} />
          <MetricMini label="Заказы" value={formatNumber(row.orders)} />
          <MetricMini label="CTR" value={formatPercent(row.ctr)} />
        </div>
      ))}
    </div>
  )
}

export function StockList({ rows, empty = 'Нет складских рисков' }: { rows: StockSummaryItem[]; empty?: string }) {
  if (rows.length === 0) return <EmptyPanel text={empty} />

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={`${row.nmId}-${row.warehouseName}`} className="grid gap-2 rounded-md border bg-secondary/25 p-2.5 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(80px,auto))] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.vendorCode || `WB ${row.nmId}`}</p>
            <p className="truncate text-xs text-muted-foreground">{row.warehouseName} · {stockRiskText(row.risk)}</p>
          </div>
          <MetricMini label="Остаток" value={formatNumber(row.quantity)} />
          <MetricMini label="В пути" value={formatNumber(row.inWayToClient + row.inWayFromClient)} />
          <MetricMini label="До нуля" value={row.daysUntilZero === null ? 'нет темпа' : `${formatNumber(row.daysUntilZero, 0)} дн.`} />
        </div>
      ))}
    </div>
  )
}

export function FeedbackList({ rows, empty = 'Нет срочных отзывов или вопросов' }: { rows: FeedbackWorkloadItem[]; empty?: string }) {
  if (rows.length === 0) return <EmptyPanel text={empty} />

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border bg-secondary/25 p-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.vendorCode || `WB ${row.nmId}`}</p>
              <p className="text-xs text-muted-foreground">{row.type === 'reviews' ? 'Отзыв' : 'Вопрос'} · {formatDate(row.createdDate)}{row.rating ? ` · ${row.rating}/5` : ''}</p>
            </div>
            <span className="shrink-0 rounded-md border bg-card px-2 py-1 text-[11px] font-semibold">
              {row.isAnswered ? 'есть ответ' : 'без ответа'}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.text || 'Без текста'}</p>
        </div>
      ))}
    </div>
  )
}

export function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-md border bg-secondary/25 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

export function StatusDot({ status }: { status: DashboardValueStatus }) {
  const className = status === 'ready'
    ? 'bg-primary'
    : status === 'partial'
      ? 'bg-amber-600'
      : status === 'not_applicable'
        ? 'bg-muted-foreground'
        : 'bg-destructive'

  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
}

export function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-card/70 px-2 py-1.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

export function metricLine(label: string, value: string) {
  return { label, value }
}

export function metricFromDashboard(metric: DashboardMetric) {
  return {
    label: metric.label,
    value: formatMetricValue(metric),
    status: metric.status,
  }
}

export function analyticsQuery(detail: DashboardAnalyticsDetail): string {
  const { summary } = detail
  return new URLSearchParams({
    account: summary.account.id,
    period: summary.period.preset,
    dateFrom: summary.period.dateFrom,
    dateTo: summary.period.dateTo,
  }).toString()
}

export function formatMetricValue(metric: DashboardMetric): string {
  if (metric.value === null) return 'Нет данных'
  if (metric.unit === 'rub') return formatRub(metric.value)
  if (metric.unit === 'percent') return formatPercent(metric.value)
  return formatNumber(metric.value)
}

export function formatOptionalRub(value: number | null): string {
  return value === null ? 'Нет данных' : formatRub(value)
}

export function formatOptionalPercent(value: number | null): string {
  return value === null ? 'Нет данных' : formatPercent(value)
}

export function formatOptionalNumber(value: number | null, digits = 0): string {
  return value === null ? 'Нет данных' : formatNumber(value, digits)
}

export function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value))
}

export function statusText(status: DashboardValueStatus): string {
  if (status === 'ready') return 'данные готовы'
  if (status === 'partial') return 'частичное покрытие'
  if (status === 'not_applicable') return 'не применимо'
  return 'нет данных'
}

function stockRiskText(risk: StockSummaryItem['risk']): string {
  if (risk === 'out_of_stock') return 'нет остатка'
  if (risk === 'low_stock') return 'низкий остаток'
  if (risk === 'overstock') return 'избыток'
  if (risk === 'no_sales') return 'нет продаж'
  return 'норма'
}

export const detailIcons = {
  finance: <CircleDollarSign className="h-4 w-4" />,
  products: <PackageSearch className="h-4 w-4" />,
  advertising: <BarChart3 className="h-4 w-4" />,
  stocks: <Warehouse className="h-4 w-4" />,
  feedback: <MessageSquareText className="h-4 w-4" />,
  data: <Database className="h-4 w-4" />,
  risks: <AlertTriangle className="h-4 w-4" />,
}
