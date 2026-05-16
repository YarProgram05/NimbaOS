'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  DashboardOverviewCharts,
  DashboardOverviewDistributionItem,
} from '@/types/dashboard'

interface DashboardOverviewChartsProps {
  charts: DashboardOverviewCharts
  variant?: 'compact' | 'full'
}

type TrendSeriesKey = 'revenue' | 'operatingProfit' | 'orders' | 'buyouts' | 'adSpend'

const TREND_SERIES: Array<{
  key: TrendSeriesKey
  label: string
  kind: 'money' | 'count'
  color: string
  chart: 'line' | 'bar'
}> = [
  { key: 'revenue', label: 'Выручка', kind: 'money', color: 'var(--primary)', chart: 'line' },
  { key: 'operatingProfit', label: 'ОП', kind: 'money', color: 'oklch(0.55 0.13 145)', chart: 'line' },
  { key: 'orders', label: 'Заказы', kind: 'count', color: 'oklch(0.56 0.11 55)', chart: 'line' },
  { key: 'buyouts', label: 'Выкупы', kind: 'count', color: 'oklch(0.48 0.09 245)', chart: 'line' },
  { key: 'adSpend', label: 'Реклама', kind: 'money', color: 'oklch(0.62 0.12 78)', chart: 'bar' },
]

const TONE_COLORS: Record<DashboardOverviewDistributionItem['tone'], string> = {
  positive: 'var(--primary)',
  neutral: 'color-mix(in oklch, var(--foreground) 38%, transparent)',
  warning: 'oklch(0.62 0.12 78)',
  critical: 'var(--destructive)',
}

export function DashboardOverviewChartsPanel({ charts, variant = 'compact' }: DashboardOverviewChartsProps) {
  const [isReady, setIsReady] = useState(false)
  const [hiddenSeries, setHiddenSeries] = useState<Set<TrendSeriesKey>>(() => new Set())
  const [trendRef, trendSize] = useElementSize()
  const hasTrend = charts.trend.some((point) =>
    TREND_SERIES.some((series) => point[series.key] !== null)
  )
  const showDistributions = variant === 'compact'
  const chartHeightClass = variant === 'full' ? 'h-[432px]' : 'h-[260px]'

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function toggleSeries(key: TrendSeriesKey) {
    setHiddenSeries((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className={showDistributions ? 'grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]' : 'min-h-0'}>
      <div className={`${chartHeightClass} min-w-[1px] rounded-md border bg-secondary/25 p-3`}>
        <div className="flex h-full min-w-[1px] flex-col">
          <TrendLegend hiddenSeries={hiddenSeries} onToggle={toggleSeries} />
          <div ref={trendRef} className="min-h-0 min-w-[1px] flex-1">
          {isReady && hasTrend && trendSize.width > 0 && trendSize.height > 0 ? (
            <ComposedChart
              width={trendSize.width}
              height={trendSize.height}
              data={charts.trend}
              margin={{ top: 18, right: 10, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                stroke="color-mix(in oklch, var(--border) 60%, transparent)"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="money"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickFormatter={shortRub}
                width={44}
                padding={{ top: 8, bottom: 4 }}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickFormatter={formatNumber}
                width={34}
                allowDecimals={false}
                padding={{ top: 8, bottom: 4 }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                      <p className="mb-1 font-semibold">{label}</p>
                      {payload
                        .filter((entry) => !hiddenSeries.has(String(entry.dataKey) as TrendSeriesKey))
                        .map((entry) => (
                          <p key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">{entry.name}</span>
                            <span className="font-semibold">
                              {formatTooltipValue(String(entry.dataKey), Number(entry.value ?? 0))}
                            </span>
                          </p>
                        ))}
                    </div>
                  )
                }}
              />
              {TREND_SERIES.map((series) => {
                const isHidden = hiddenSeries.has(series.key)
                if (series.chart === 'bar') {
                  return (
                    <Bar
                      key={series.key}
                      yAxisId="money"
                      dataKey={series.key}
                      name={series.label}
                      fill="color-mix(in oklch, oklch(0.62 0.12 78) 28%, transparent)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                      hide={isHidden}
                    />
                  )
                }

                return (
                  <Line
                    key={series.key}
                    yAxisId={series.kind === 'money' ? 'money' : 'count'}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={series.key === 'revenue' ? 2.2 : 1.9}
                    dot={false}
                    activeDot={series.key === 'revenue' ? { r: 4 } : undefined}
                    hide={isHidden}
                  />
                )
              })}
            </ComposedChart>
          ) : (
            <EmptyChartState />
          )}
          </div>
        </div>
      </div>

      {showDistributions && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <DistributionChart title="Финансы" items={charts.finance} valueKind="money" isReady={isReady} />
          <DistributionChart title="Данные" items={charts.dataQuality} valueKind="count" isReady={isReady} />
          <DistributionChart title="Риски" items={charts.risks} valueKind="count" isReady={isReady} />
        </div>
      )}
    </div>
  )
}

function TrendLegend({
  hiddenSeries,
  onToggle,
}: {
  hiddenSeries: Set<TrendSeriesKey>
  onToggle: (key: TrendSeriesKey) => void
}) {
  return (
    <div className="shrink-0 pb-2">
      <div className="flex flex-wrap gap-1.5">
      {TREND_SERIES.map((series) => {
        const isHidden = hiddenSeries.has(series.key)
        return (
          <button
            key={series.key}
            type="button"
            onClick={() => onToggle(series.key)}
            className={[
              'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors',
              isHidden ? 'bg-card text-muted-foreground opacity-55' : 'bg-card text-foreground hover:bg-secondary',
            ].join(' ')}
            aria-pressed={!isHidden}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
            <span>{series.label}</span>
          </button>
        )
      })}
      </div>
    </div>
  )
}

function DistributionChart({
  title,
  items,
  valueKind,
  isReady,
}: {
  title: string
  items: DashboardOverviewDistributionItem[]
  valueKind: 'money' | 'count'
  isReady: boolean
}) {
  const visibleItems = items.filter((item) => item.value > 0)
  const total = visibleItems.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="h-[74px] min-w-[1px] rounded-md border bg-card/70 p-2">
      <div className="grid h-full grid-cols-[58px_minmax(0,1fr)] items-center gap-2">
        <div className="relative h-[54px] w-[58px]">
          {isReady && total > 0 ? (
            <PieChart width={58} height={54}>
              <Pie
                data={visibleItems}
                dataKey="value"
                nameKey="label"
                innerRadius={18}
                outerRadius={26}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {visibleItems.map((item) => (
                  <Cell key={item.key} fill={TONE_COLORS[item.tone]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <div className="mx-auto h-[54px] w-[54px] rounded-full border bg-secondary/50" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          <p className="truncate text-sm font-semibold">{valueKind === 'money' ? shortRub(total) : formatNumber(total)}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {visibleItems.slice(0, 2).map((item) => item.label).join(', ') || 'без сигналов'}
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
      Нет сохранённых данных для динамики за выбранный период
    </div>
  )
}

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const update = () => {
      const rect = node.getBoundingClientRect()
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      })
    }
    update()

    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

function formatTooltipValue(key: string, value: number): string {
  if (key === 'orders' || key === 'buyouts') return formatNumber(value)
  return formatRub(value)
}

function shortRub(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${formatCompact(value / 1_000_000)} млн`
  if (abs >= 1_000) return `${formatCompact(value / 1_000)} тыс`
  return formatCompact(value)
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)
}
