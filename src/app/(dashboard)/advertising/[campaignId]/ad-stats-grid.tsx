'use client'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { AdCampaignMetrics, AdDailyMetrics } from '@/types/advertising'
import { AD_METRIC_ROWS, formatAdMetricValue } from './ad-metrics-rows'

interface AdStatsGridProps {
  daily: AdDailyMetrics[]
  totals: AdCampaignMetrics['totals']
}

export function AdStatsGrid({ daily, totals }: AdStatsGridProps) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="overflow-x-auto rounded-md border bg-muted/20">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="min-w-[120px] border-r bg-muted/80 px-3 py-2 text-left font-medium backdrop-blur sm:sticky sm:left-0 sm:z-20 sm:min-w-[160px]">
              Метрика
            </th>
            {daily.map((item) => (
              <th
                key={item.date}
                className={`min-w-[88px] px-3 py-2 text-center font-medium whitespace-nowrap ${
                  item.date === today ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                }`}
              >
                {format(new Date(item.date), 'dd.MM', { locale: ru })}
              </th>
            ))}
            <th className="min-w-[96px] border-l bg-muted/80 px-3 py-2 text-center font-medium backdrop-blur sm:sticky sm:right-0 sm:z-20">
              Итого
            </th>
          </tr>
        </thead>
        <tbody>
          {AD_METRIC_ROWS.map((row) => (
            <tr key={row.key} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="border-r bg-background/95 px-3 py-1.5 font-medium whitespace-nowrap backdrop-blur sm:sticky sm:left-0 sm:z-10">
                {row.label}
              </td>
              {daily.map((item) => (
                <td
                  key={`${row.key}-${item.date}`}
                  className={`px-3 py-1.5 text-center tabular-nums whitespace-nowrap ${
                    item.date === today ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {formatAdMetricValue(row.accessor(item), row.formatter)}
                </td>
              ))}
              <td className="border-l bg-background/95 px-3 py-1.5 text-center font-medium tabular-nums whitespace-nowrap backdrop-blur sm:sticky sm:right-0 sm:z-10">
                {formatAdMetricValue(row.totalAccessor(totals), row.formatter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
