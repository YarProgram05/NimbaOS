import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  LineChart,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getDashboardSummary } from '@/lib/services/dashboard-summary'
import type {
  DashboardMetric,
  DashboardPeriodPreset,
  DashboardProductSnapshot,
  DashboardSummary,
  DashboardValueStatus,
} from '@/types/dashboard'

interface DashboardPageProps {
  searchParams: Promise<{
    account?: string
    period?: DashboardPeriodPreset
    dateFrom?: string
    dateTo?: string
  }>
}

const PERIODS: { value: DashboardPeriodPreset; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'last7', label: '7 дней' },
  { value: 'currentMonth', label: 'Месяц' },
  { value: 'previousMonth', label: 'Прошлый' },
]

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getServerSession(authOptions)
  const params = await searchParams
  const summary = await getDashboardSummary({
    accountId: params.account,
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
            Дашборд строится только по локально сохраненным данным выбранного кабинета. Подключите кабинет в настройках, затем запустите синхронизацию.
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
  const reportsHref = `/reports?${accountQuery}&dateFrom=${summary.period.dateFrom}&dateTo=${summary.period.dateTo}`
  const salesPlanHref = `/sales-plan?${accountQuery}`
  const advertisingHref = `/advertising?${accountQuery}`
  const syncHref = `/sync?${accountQuery}`

  return (
    <div className="dashboard-page">
      <section className="old-money-panel shrink-0 rounded-md p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <LineChart className="h-4 w-4 text-primary" />
              Командный центр WB
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Добро пожаловать, {name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.account.name}
              {summary.account.sellerName ? ` - ${summary.account.sellerName}` : ''}. Период: {formatPeriod(summary)}.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((period) => (
                <Link
                  key={period.value}
                  href={`/?${accountQuery}&period=${period.value}`}
                  className={[
                    'rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                    summary.period.preset === period.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-secondary',
                  ].join(' ')}
                >
                  {period.label}
                </Link>
              ))}
            </div>
            <form
              key={`${summary.period.dateFrom}-${summary.period.dateTo}`}
              action="/"
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="account" value={summary.account.id} />
              <input type="hidden" name="period" value="custom" />
              <input
                type="date"
                name="dateFrom"
                defaultValue={summary.period.dateFrom}
                className="h-9 rounded-md border bg-card px-2 text-xs"
                aria-label="Дата начала"
              />
              <input
                type="date"
                name="dateTo"
                defaultValue={summary.period.dateTo}
                className="h-9 rounded-md border bg-card px-2 text-xs"
                aria-label="Дата окончания"
              />
              <button type="submit" className="h-9 rounded-md border bg-secondary px-3 text-xs font-semibold hover:bg-accent">
                Применить
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard metric={summary.kpis.revenue} href={reportsHref} />
        <KpiCard metric={summary.kpis.operatingProfit} href={reportsHref} />
        <KpiCard metric={summary.kpis.marginality} href={reportsHref} />
        <KpiCard metric={summary.kpis.drr} href={reportsHref} />
        <KpiCard metric={summary.kpis.orders} href={salesPlanHref} />
        <KpiCard metric={summary.kpis.returns} href={reportsHref} />
      </section>

      <section className="dashboard-scroll grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid content-start gap-3">
          <section className="old-money-panel rounded-md p-4">
            <PanelHeader
              label="План-факт"
              title="Активные планы продаж"
              href={salesPlanHref}
              icon={<Target className="h-5 w-5 text-primary" />}
            />
            <StatusLine status={summary.plan.status} hint={summary.plan.hint} />
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <MiniMetric label="План, шт." value={formatOptionalNumber(summary.plan.plannedUnits, 0)} />
              <MiniMetric label="Факт, шт." value={formatOptionalNumber(summary.plan.factUnits, 0)} />
              <MiniMetric label="Прогресс" value={formatOptionalPercent(summary.plan.progressPercent)} />
              <MiniMetric label="Планов" value={String(summary.plan.activePlans)} />
            </div>
            <ProgressBar value={summary.plan.progressPercent} />
          </section>

          <section className="old-money-panel rounded-md p-4">
            <PanelHeader
              label="Реклама"
              title="Сводка по сохраненной статистике"
              href={advertisingHref}
              icon={<BarChart3 className="h-5 w-5 text-primary" />}
            />
            <StatusLine status={summary.advertising.status} hint={summary.advertising.hint} />
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <MiniMetric label="Расход" value={formatOptionalRub(summary.advertising.spend)} />
              <MiniMetric label="CTR" value={formatOptionalPercent(summary.advertising.ctr)} />
              <MiniMetric label="CPC" value={formatOptionalRub(summary.advertising.cpc)} />
              <MiniMetric label="Заказы" value={formatOptionalNumber(summary.advertising.orders, 0)} />
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <ProductPanel
              title="Лидеры по прибыли"
              rows={summary.products.topProfit}
              href={reportsHref}
              empty={summary.products.hint ?? 'Прибыльных товаров за период нет.'}
            />
            <ProductPanel
              title="Зоны риска"
              rows={summary.products.risks}
              href={reportsHref}
              empty={summary.products.hint ?? 'Критичных товаров по текущим правилам нет.'}
              risk
            />
          </section>
        </div>

        <div className="grid content-start gap-3">
          <section className="old-money-panel rounded-md p-4">
            <PanelHeader
              label="Фокус"
              title="Что проверить сейчас"
              href={syncHref}
              icon={<AlertTriangle className="h-5 w-5 text-primary" />}
            />
            <div className="mt-3 space-y-2">
              {buildFocusItems(summary).map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-md border bg-secondary/40 p-3 text-sm transition-colors hover:bg-secondary"
                >
                  <span>
                    <span className="block font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.caption}</span>
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>

          <section className="old-money-panel rounded-md p-4">
            <PanelHeader
              label="Свежесть"
              title="Покрытие данных"
              href={syncHref}
              icon={<RefreshCw className="h-5 w-5 text-primary" />}
            />
            <div className="mt-3 divide-y">
              {summary.freshness.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={item.status} />
                      <p className="truncate text-sm font-medium">{item.label}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.lastCoverageSyncedAt || item.lastSuccessAt
                        ? `обновлено ${formatDateTime(item.lastCoverageSyncedAt ?? item.lastSuccessAt)}`
                        : item.hint ?? 'нет истории синхронизации'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.activeJobs > 0 ? `${item.activeJobs} в работе` : item.failedJobs > 0 ? `${item.failedJobs} ошибок` : statusText(item.status)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="old-money-panel rounded-md p-4">
            <PanelHeader
              label="Товары"
              title="Лидеры по выручке"
              href={reportsHref}
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
            />
            <div className="mt-3">
              <ProductRows rows={summary.products.topRevenue} empty={summary.products.hint ?? 'Выручки по товарам за период нет.'} />
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ metric, href }: { metric: DashboardMetric; href: string }) {
  const isPositive = (metric.changePercent ?? 0) >= 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  return (
    <Link href={href} className="old-money-panel rounded-md p-3 transition-colors hover:bg-secondary/60">
      <div className="flex items-start justify-between gap-2">
        <p className="metric-label">{metric.label}</p>
        <StatusDot status={metric.status} />
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{formatMetricValue(metric)}</p>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        {metric.changePercent === null ? (
          <span>{metric.status === 'missing' ? 'нет данных' : 'без сравнения'}</span>
        ) : (
          <>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{formatSignedPercent(metric.changePercent)} к прошлому периоду</span>
          </>
        )}
      </div>
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
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="metric-label">{label}</p>
        <h2 className="mt-1 text-base font-semibold">{title}</h2>
      </div>
      <Link href={href} className="flex items-center gap-2 text-xs font-semibold text-primary">
        {icon}
      </Link>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function ProductPanel({
  title,
  rows,
  href,
  empty,
  risk = false,
}: {
  title: string
  rows: DashboardProductSnapshot[]
  href: string
  empty: string
  risk?: boolean
}) {
  return (
    <section className="old-money-panel rounded-md p-4">
      <PanelHeader
        label={risk ? 'Анти-топ' : 'Топ'}
        title={title}
        href={href}
        icon={risk ? <AlertTriangle className="h-5 w-5 text-primary" /> : <TrendingUp className="h-5 w-5 text-primary" />}
      />
      <div className="mt-3">
        <ProductRows rows={rows} empty={empty} risk={risk} />
      </div>
    </section>
  )
}

function ProductRows({
  rows,
  empty,
  risk = false,
}: {
  rows: DashboardProductSnapshot[]
  empty: string
  risk?: boolean
}) {
  if (rows.length === 0) {
    return <p className="rounded-md border bg-secondary/40 p-3 text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div key={`${row.nmId}-${row.vendorCode}`} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.vendorCode || row.nmId}</p>
            <p className="truncate text-xs text-muted-foreground">{row.brandName || row.subjectName || `WB ${row.nmId}`}</p>
          </div>
          <div className="text-right">
            <p className={risk ? 'text-sm font-semibold text-destructive' : 'text-sm font-semibold'}>
              {formatRub(row.operatingProfit)}
            </p>
            <p className="text-xs text-muted-foreground">ДРР {formatPercent(row.drr)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusLine({ status, hint }: { status: DashboardValueStatus; hint: string | null }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
      {status === 'ready' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" /> : <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />}
      <span>{hint ?? statusText(status)}</span>
    </div>
  )
}

function ProgressBar({ value }: { value: number | null }) {
  const width = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="mt-4 h-2 rounded-full bg-secondary">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
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

function buildFocusItems(summary: DashboardSummary) {
  const items: { title: string; caption: string; href: string }[] = []
  const accountQuery = `account=${summary.account.id}`

  if (summary.kpis.revenue.status !== 'ready') {
    items.push({
      title: 'Закрыть финансовые данные',
      caption: summary.kpis.revenue.hint ?? 'Период не полностью покрыт отчетом реализации.',
      href: `/sync?${accountQuery}`,
    })
  }

  if (summary.plan.status === 'missing' || summary.plan.status === 'not_applicable') {
    items.push({
      title: 'Проверить план продаж',
      caption: summary.plan.hint ?? 'Нужен активный план и продажи за период.',
      href: `/sales-plan?${accountQuery}`,
    })
  }

  if (summary.advertising.status !== 'ready') {
    items.push({
      title: 'Обновить рекламную статистику',
      caption: summary.advertising.hint ?? 'ДРР рекламы может быть неполным.',
      href: `/advertising?${accountQuery}`,
    })
  }

  if (summary.products.risks.length > 0) {
    items.push({
      title: 'Разобрать товары с риском',
      caption: `${summary.products.risks.length} позиций с отрицательной прибылью, высоким ДРР или без себестоимости.`,
      href: `/reports?${accountQuery}&dateFrom=${summary.period.dateFrom}&dateTo=${summary.period.dateTo}`,
    })
  }

  if (items.length === 0) {
    items.push({
      title: 'Данные выглядят спокойно',
      caption: 'Критичных пробелов по текущим источникам не найдено.',
      href: `/sync?${accountQuery}`,
    })
  }

  return items.slice(0, 4)
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
