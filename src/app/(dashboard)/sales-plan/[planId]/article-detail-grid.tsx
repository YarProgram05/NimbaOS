'use client'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ArticleDetailData, DailyMetrics } from '@/types/sales-plan'
import { METRIC_ROWS, formatMetricValue } from './plan-metrics-rows'

interface ArticleDetailGridProps {
  article: ArticleDetailData
}

export function ArticleDetailGrid({ article }: ArticleDetailGridProps) {
  const { summary, dailyBreakdown } = article

  // Build a map date → DailyMetrics for quick access
  const metricsMap = new Map<string, DailyMetrics>()
  for (const d of dailyBreakdown) {
    metricsMap.set(d.date, d)
  }

  // Date column headers
  const dates = dailyBreakdown.map((d) => d.date)

  // Determine "today" for color comparison
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="space-y-2 md:hidden">
        {METRIC_ROWS.map((row) => {
          const planMonth = row.summaryPlanMonth?.(summary) ?? null
          const factMonth = row.summaryFactMonth?.(summary) ?? null
          const planDay = row.summaryPlanDay?.(summary) ?? null
          const factDay = row.summaryFactDay?.(summary) ?? null
          const hasPlanComparison = planMonth !== null && factMonth !== null

          return (
            <details key={row.key} className="group rounded-md border bg-background">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium marker:content-none">
                <span>{row.label}</span>
                <span className={`shrink-0 tabular-nums ${
                  hasPlanComparison
                    ? Number(factMonth) >= Number(planMonth)
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground'
                }`}>
                  {formatMetricValue(factMonth, row.formatter)}
                </span>
              </summary>
              <div className="space-y-3 border-t p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MobileSummaryValue label="План / месяц" value={formatMetricValue(planMonth, row.formatter)} />
                  <MobileSummaryValue label="Факт / месяц" value={formatMetricValue(factMonth, row.formatter)} />
                  <MobileSummaryValue label="План / день" value={formatMetricValue(planDay, row.formatter)} />
                  <MobileSummaryValue label="Факт / день" value={formatMetricValue(factDay, row.formatter)} />
                </div>
                {dates.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    {dates.map((date) => {
                      const metrics = metricsMap.get(date)
                      const value = metrics ? row.accessor(metrics) : null
                      return (
                        <div
                          key={date}
                          className={`flex min-h-10 items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0 ${
                            date === today ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <span className="text-muted-foreground">{format(new Date(date), 'dd.MM', { locale: ru })}</span>
                          <span className="font-medium tabular-nums">{formatMetricValue(value, row.formatter)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-md border bg-muted/20 md:block">
      <table className="text-sm border-collapse w-max min-w-full">
        <thead>
          <tr className="border-b bg-muted/40">
            {/* Frozen: metric label */}
            <th
              className="sticky left-0 z-20 bg-muted/80 backdrop-blur px-3 py-2 text-left font-medium whitespace-nowrap min-w-[140px] border-r"
            >
              Метрика
            </th>
            {/* 4 summary columns — sticky after metric label */}
            <th className="sticky z-10 bg-muted/80 backdrop-blur px-3 py-2 text-center font-medium whitespace-nowrap min-w-[90px] border-r" style={{ left: 140 }}>
              ПЛАН/МЕС
            </th>
            <th className="sticky z-10 bg-muted/80 backdrop-blur px-3 py-2 text-center font-medium whitespace-nowrap min-w-[90px] border-r" style={{ left: 230 }}>
              ФАКТ/МЕС
            </th>
            <th className="sticky z-10 bg-muted/80 backdrop-blur px-3 py-2 text-center font-medium whitespace-nowrap min-w-[90px] border-r" style={{ left: 320 }}>
              ПЛАН/ДЕНЬ
            </th>
            <th className="sticky z-10 bg-muted/80 backdrop-blur px-3 py-2 text-center font-medium whitespace-nowrap min-w-[90px] border-r" style={{ left: 410 }}>
              ФАКТ/ДЕНЬ
            </th>
            {/* Date columns */}
            {dates.map((date) => (
              <th
                key={date}
                className={`px-3 py-2 text-center font-medium whitespace-nowrap min-w-[75px] ${
                  date === today ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                }`}
              >
                {format(new Date(date), 'dd.MM', { locale: ru })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map((row) => {
            // Summary cells
            const planMonth = row.summaryPlanMonth?.(summary) ?? null
            const factMonth = row.summaryFactMonth?.(summary) ?? null
            const planDay = row.summaryPlanDay?.(summary) ?? null
            const factDay = row.summaryFactDay?.(summary) ?? null

            // Color logic for fact vs plan (only for boughtQty row which has plan data)
            const hasPlanComparison = planMonth !== null && factMonth !== null

            return (
              <tr key={row.key} className="border-b last:border-b-0 hover:bg-muted/20">
                {/* Metric label — frozen */}
                <td className="sticky left-0 z-20 bg-background/95 backdrop-blur px-3 py-1.5 font-medium whitespace-nowrap border-r">
                  {row.label}
                </td>
                {/* ПЛАН/МЕС */}
                <td className="sticky z-10 bg-background/95 backdrop-blur px-3 py-1.5 text-center whitespace-nowrap border-r tabular-nums" style={{ left: 140 }}>
                  {formatMetricValue(planMonth, row.formatter)}
                </td>
                {/* ФАКТ/МЕС */}
                <td
                  className={`sticky z-10 bg-background/95 backdrop-blur px-3 py-1.5 text-center whitespace-nowrap border-r tabular-nums ${
                    hasPlanComparison
                      ? Number(factMonth) >= Number(planMonth)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                      : ''
                  }`}
                  style={{ left: 230 }}
                >
                  {formatMetricValue(factMonth, row.formatter)}
                </td>
                {/* ПЛАН/ДЕНЬ */}
                <td className="sticky z-10 bg-background/95 backdrop-blur px-3 py-1.5 text-center whitespace-nowrap border-r tabular-nums" style={{ left: 320 }}>
                  {formatMetricValue(planDay, row.formatter)}
                </td>
                {/* ФАКТ/ДЕНЬ */}
                <td
                  className={`sticky z-10 bg-background/95 backdrop-blur px-3 py-1.5 text-center whitespace-nowrap border-r tabular-nums ${
                    planDay !== null && factDay !== null
                      ? Number(factDay) >= Number(planDay)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                      : ''
                  }`}
                  style={{ left: 410 }}
                >
                  {formatMetricValue(factDay, row.formatter)}
                </td>
                {/* Daily values */}
                {dates.map((date) => {
                  const m = metricsMap.get(date)
                  const val = m ? row.accessor(m) : null
                  return (
                    <td
                      key={date}
                      className={`px-3 py-1.5 text-center whitespace-nowrap tabular-nums ${
                        date === today ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {formatMetricValue(val, row.formatter)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </>
  )
}

function MobileSummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
