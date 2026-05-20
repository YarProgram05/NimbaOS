'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface ArticleChartOption {
  nmId: number
  vendorCode: string
  brandName: string
  subjectName: string
  photoUrl: string | null
  revenue: number
}

export interface ArticleChartMetrics {
  revenue: number
  operatingProfit: number
  orders: number
  buyouts: number
  adSpend: number
}

export interface ArticleChartPoint {
  label: string
  dateFrom: string
  dateTo: string
  values: Record<string, ArticleChartMetrics>
}

interface ArticleComparisonChartProps {
  options: ArticleChartOption[]
  selectedNmIds: number[]
  points: ArticleChartPoint[]
}

type MetricKey = keyof ArticleChartMetrics
type MetricKind = 'money' | 'count'
type MetricChart = 'line' | 'bar'

const METRICS: Array<{ key: MetricKey; label: string; kind: MetricKind; color: string; chart: MetricChart }> = [
  { key: 'revenue', label: 'Выручка', kind: 'money', color: 'var(--primary)', chart: 'line' },
  { key: 'operatingProfit', label: 'ОП', kind: 'money', color: 'oklch(0.55 0.13 145)', chart: 'line' },
  { key: 'orders', label: 'Заказы', kind: 'count', color: 'oklch(0.56 0.11 55)', chart: 'line' },
  { key: 'buyouts', label: 'Выкупы', kind: 'count', color: 'oklch(0.48 0.09 245)', chart: 'line' },
  { key: 'adSpend', label: 'Реклама', kind: 'money', color: 'oklch(0.62 0.12 78)', chart: 'bar' },
]

type MetricDef = (typeof METRICS)[number]

export function ArticleComparisonChart({
  options,
  selectedNmIds: initialSelectedNmIds,
  points,
}: ArticleComparisonChartProps) {
  const [selectedNmIds, setSelectedNmIds] = useState<number[]>(initialSelectedNmIds)
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['buyouts', 'adSpend'])
  const [query, setQuery] = useState('')

  useEffect(() => {
    setSelectedNmIds(initialSelectedNmIds)
  }, [initialSelectedNmIds])

  const optionsByNmId = useMemo(
    () => new Map(options.map((option) => [option.nmId, option])),
    [options],
  )
  const selected = useMemo(
    () => selectedNmIds
      .map((nmId) => optionsByNmId.get(nmId))
      .filter((option): option is ArticleChartOption => Boolean(option)),
    [optionsByNmId, selectedNmIds],
  )
  const selectedSet = useMemo(() => new Set(selected.map((option) => option.nmId)), [selected])
  const selectedMetricDefs = useMemo(
    () => selectedMetrics
      .map((key) => METRICS.find((item) => item.key === key))
      .filter((item): item is MetricDef => Boolean(item)),
    [selectedMetrics],
  )
  const hasMoneyAxis = selectedMetricDefs.some((item) => item.kind === 'money')
  const hasCountAxis = selectedMetricDefs.some((item) => item.kind === 'count')

  const chartData = useMemo(() => points.map((point) => {
    const row: Record<string, string | number> = { label: point.label }
    for (const option of selected) {
      for (const metricKey of selectedMetrics) {
        row[seriesKey(option.nmId, metricKey)] = point.values[String(option.nmId)]?.[metricKey] ?? 0
      }
    }
    return row
  }), [points, selected, selectedMetrics])

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options.slice(0, 40)
    return options
      .filter((option) =>
        String(option.nmId).includes(normalized)
        || option.vendorCode.toLowerCase().includes(normalized)
        || option.brandName.toLowerCase().includes(normalized)
        || option.subjectName.toLowerCase().includes(normalized)
      )
      .slice(0, 40)
  }, [options, query])

  function toggleArticle(nmId: number) {
    if (selectedSet.has(nmId)) {
      setSelectedNmIds((current) => current.filter((item) => item !== nmId))
      return
    }

    setSelectedNmIds((current) => [...current, nmId].slice(-6))
  }

  function toggleMetric(metricKey: MetricKey) {
    setSelectedMetrics((current) => {
      if (current.includes(metricKey)) {
        const next = current.filter((item) => item !== metricKey)
        return next.length > 0 ? next : current
      }
      return [...current, metricKey]
    })
  }

  if (options.length === 0) {
    return (
      <div className="rounded-md border bg-secondary/25 p-4 text-sm text-muted-foreground">
        Нет артикулов для сравнения за выбранный период.
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти артикул"
            className="pl-8"
          />
        </div>
        <div className="max-h-[428px] space-y-1.5 overflow-y-auto pr-1">
          {filteredOptions.map((option) => {
            const isSelected = selectedSet.has(option.nmId)
            return (
              <button
                key={option.nmId}
                type="button"
                onClick={() => toggleArticle(option.nmId)}
                className={[
                  'flex w-full min-w-0 items-center gap-2 rounded-md border p-2 text-left transition-colors',
                  isSelected ? 'border-primary bg-primary/10' : 'bg-card hover:bg-secondary',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                {option.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-md border object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-secondary text-xs text-muted-foreground">
                    WB
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{option.vendorCode || `WB ${option.nmId}`}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    WB {option.nmId} · {formatMoney(option.revenue)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((item) => {
              const isSelected = selectedMetrics.includes(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleMetric(item.key)}
                  className={[
                    'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <MetricMarker metric={item} />
                  {item.label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {selected.map((option) => (
              <button
                key={option.nmId}
                type="button"
                onClick={() => toggleArticle(option.nmId)}
                className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md border bg-card px-2 text-xs font-semibold"
              >
                <span className="truncate">{option.vendorCode || `WB ${option.nmId}`}</span>
                <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {selected.length > 0 && (
          <SeriesLegend selected={selected} metrics={selectedMetricDefs} />
        )}

        <div className="h-[420px] min-w-[1px] rounded-md border bg-secondary/25 p-3">
          {selected.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Выберите один или несколько артикулов слева.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 16, right: 14, bottom: 4, left: 0 }}>
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
                />
                {hasMoneyAxis && (
                  <YAxis
                    yAxisId="money"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickFormatter={shortMoney}
                    width={48}
                    padding={{ top: 8, bottom: 4 }}
                  />
                )}
                {hasCountAxis && (
                  <YAxis
                    yAxisId="count"
                    orientation={hasMoneyAxis ? 'right' : 'left'}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickFormatter={shortNumber}
                    width={42}
                    allowDecimals={false}
                    padding={{ top: 8, bottom: 4 }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                        <p className="mb-1 font-semibold">{label}</p>
                        {payload.map((entry) => (
                          <p key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">{entry.name}</span>
                            <span className="font-semibold">
                              {metricKindByKey(String(entry.dataKey)) === 'money'
                                ? formatMoney(Number(entry.value ?? 0))
                                : formatNumber(Number(entry.value ?? 0))}
                            </span>
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                {selected.flatMap((option, articleIndex) => selectedMetricDefs.map((metricDef) => {
                  const key = seriesKey(option.nmId, metricDef.key)
                  const articleLabel = option.vendorCode || `WB ${option.nmId}`

                  if (metricDef.chart === 'bar') {
                    return (
                      <Bar
                        key={key}
                        yAxisId="money"
                        dataKey={key}
                        name={`${articleLabel}: ${metricDef.label}`}
                        fill={barColor(metricDef.color)}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={22}
                      />
                    )
                  }

                  return (
                    <Line
                      key={key}
                      yAxisId={metricDef.kind === 'money' ? 'money' : 'count'}
                      type="monotone"
                      dataKey={key}
                      name={`${articleLabel}: ${metricDef.label}`}
                      stroke={metricDef.color}
                      strokeWidth={2}
                      strokeDasharray={lineDash(articleIndex)}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )
                }))}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricMarker({ metric }: { metric: MetricDef }) {
  if (metric.chart === 'bar') {
    return <span className="h-3 w-2.5 rounded-[2px]" style={{ backgroundColor: barColor(metric.color) }} />
  }

  return <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: metric.color }} />
}

function SeriesLegend({ selected, metrics }: { selected: ArticleChartOption[]; metrics: MetricDef[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {selected.flatMap((option, articleIndex) => metrics.map((metric) => {
        const label = `${option.vendorCode || `WB ${option.nmId}`}: ${metric.label}`
        return (
          <span
            key={`${option.nmId}-${metric.key}`}
            className="inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border bg-card px-2 text-[11px] font-semibold"
            title={label}
          >
            {metric.chart === 'bar' ? (
              <span className="h-3 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: barColor(metric.color) }} />
            ) : (
              <span
                className="h-0.5 w-5 shrink-0 rounded-full"
                style={{
                  backgroundColor: metric.color,
                  backgroundImage: lineLegendImage(metric.color, articleIndex),
                }}
              />
            )}
            <span className="truncate">{label}</span>
          </span>
        )
      }))}
    </div>
  )
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

function shortMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${formatCompact(value / 1_000_000)} млн`
  if (abs >= 1_000) return `${formatCompact(value / 1_000)} тыс`
  return formatCompact(value)
}

function shortNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000) return `${formatCompact(value / 1_000)} тыс`
  return formatCompact(value)
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)
}

function seriesKey(nmId: number, metric: MetricKey): string {
  return `nm${nmId}_${metric}`
}

function metricKindByKey(key: string): MetricKind {
  const metricKey = key.split('_').at(-1) as MetricKey | undefined
  return METRICS.find((item) => item.key === metricKey)?.kind ?? 'count'
}

function barColor(color: string): string {
  return `color-mix(in oklch, ${color} 32%, transparent)`
}

function lineDash(articleIndex: number): string | undefined {
  if (articleIndex === 0) return undefined
  if (articleIndex === 1) return '5 4'
  if (articleIndex === 2) return '2 4'
  return '8 3 2 3'
}

function lineLegendImage(color: string, articleIndex: number): string | undefined {
  if (articleIndex === 0) return undefined
  const transparent = 'transparent'
  if (articleIndex === 1) return `repeating-linear-gradient(to right, ${color} 0 5px, ${transparent} 5px 9px)`
  if (articleIndex === 2) return `repeating-linear-gradient(to right, ${color} 0 2px, ${transparent} 2px 6px)`
  return `repeating-linear-gradient(to right, ${color} 0 8px, ${transparent} 8px 11px, ${color} 11px 13px, ${transparent} 13px 16px)`
}
