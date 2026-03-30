'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { createPortal } from 'react-dom'
import type { AdCampaignMetrics, AdDailyMetrics } from '@/types/advertising'
import { formatAdMetricValue, type AdMetricFormatter } from './ad-metrics-rows'

interface BreakdownMetricRow {
  key: string
  label: string
  formatter: AdMetricFormatter
  showTooltip: boolean
  searchAccessor: (m: AdDailyMetrics) => string | number | null
  recoAccessor: (m: AdDailyMetrics) => string | number | null
  totalSearchAccessor: (m: AdCampaignMetrics['totals']) => string | number | null
  totalRecoAccessor: (m: AdCampaignMetrics['totals']) => string | number | null
}

const BREAKDOWN_METRIC_ROWS: BreakdownMetricRow[] = [
  {
    key: 'spend',
    label: 'Затраты',
    formatter: 'rub',
    showTooltip: true,
    searchAccessor: (m) => m.searchSpend,
    recoAccessor: (m) => m.recoSpend,
    totalSearchAccessor: (m) => m.searchSpend,
    totalRecoAccessor: (m) => m.recoSpend,
  },
  {
    key: 'cpo',
    label: 'CPO',
    formatter: 'rub',
    showTooltip: false,
    searchAccessor: (m) => m.searchCpo,
    recoAccessor: (m) => m.recoCpo,
    totalSearchAccessor: (m) => m.searchCpo,
    totalRecoAccessor: (m) => m.recoCpo,
  },
  {
    key: 'bid',
    label: 'Ставка',
    formatter: 'rub',
    showTooltip: false,
    searchAccessor: (m) => m.searchBid,
    recoAccessor: (m) => m.recoBid,
    totalSearchAccessor: (m) => m.searchBid,
    totalRecoAccessor: (m) => m.recoBid,
  },
  {
    key: 'views',
    label: 'Просмотры',
    formatter: 'number',
    showTooltip: true,
    searchAccessor: (m) => m.searchViews,
    recoAccessor: (m) => m.recoViews,
    totalSearchAccessor: (m) => m.searchViews,
    totalRecoAccessor: (m) => m.recoViews,
  },
  {
    key: 'ctr',
    label: 'CTR',
    formatter: 'percent',
    showTooltip: false,
    searchAccessor: (m) => m.searchCtr,
    recoAccessor: (m) => m.recoCtr,
    totalSearchAccessor: (m) => m.searchCtr,
    totalRecoAccessor: (m) => m.recoCtr,
  },
  {
    key: 'clicks',
    label: 'Переходы',
    formatter: 'number',
    showTooltip: true,
    searchAccessor: (m) => m.searchClicks,
    recoAccessor: (m) => m.recoClicks,
    totalSearchAccessor: (m) => m.searchClicks,
    totalRecoAccessor: (m) => m.recoClicks,
  },
  {
    key: 'cartAdds',
    label: 'Корзины',
    formatter: 'number',
    showTooltip: true,
    searchAccessor: (m) => m.searchCartAdds,
    recoAccessor: (m) => m.recoCartAdds,
    totalSearchAccessor: (m) => m.searchCartAdds,
    totalRecoAccessor: (m) => m.recoCartAdds,
  },
  {
    key: 'orders',
    label: 'Заказы',
    formatter: 'number',
    showTooltip: true,
    searchAccessor: (m) => m.searchOrders,
    recoAccessor: (m) => m.recoOrders,
    totalSearchAccessor: (m) => m.searchOrders,
    totalRecoAccessor: (m) => m.recoOrders,
  },
  {
    key: 'cpc',
    label: 'CPC',
    formatter: 'rub',
    showTooltip: false,
    searchAccessor: (m) => m.searchCpc,
    recoAccessor: (m) => m.recoCpc,
    totalSearchAccessor: (m) => m.searchCpc,
    totalRecoAccessor: (m) => m.recoCpc,
  },
]

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'string' ? parseFloat(value) || 0 : value
}

function shareText(searchValue: string | number | null | undefined, recoValue: string | number | null | undefined) {
  const search = toNumber(searchValue)
  const reco = toNumber(recoValue)
  const total = search + reco
  if (total <= 0) return 'П: 0% / Р: 0%'

  const searchShare = (search / total) * 100
  const recoShare = (reco / total) * 100

  return `П: ${searchShare.toFixed(0)}% / Р: ${recoShare.toFixed(0)}%`
}

function BreakdownCell({
  value,
  formatter,
  tooltipText,
  highlighted,
}: {
  value: string | number | null | undefined
  formatter: AdMetricFormatter
  tooltipText?: string | null
  highlighted?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const cellRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleMouseEnter() {
    if (!tooltipText || !cellRef.current) return
    const rect = cellRef.current.getBoundingClientRect()
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  function handleMouseLeave() {
    setPos(null)
  }

  return (
    <>
      <td
        ref={cellRef}
        className={`px-3 py-1.5 text-center tabular-nums whitespace-nowrap ${
          highlighted ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
        } ${tooltipText ? 'cursor-help' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {formatAdMetricValue(value, formatter)}
      </td>
      {mounted && pos && tooltipText &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
            className="rounded-md border bg-background px-3 py-1.5 text-xs shadow-lg"
          >
            {tooltipText}
          </div>,
          document.body,
        )}
    </>
  )
}

interface AdBreakdownGridProps {
  daily: AdDailyMetrics[]
  totals: AdCampaignMetrics['totals']
}

export function AdBreakdownGrid({ daily, totals }: AdBreakdownGridProps) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="overflow-x-auto rounded-md border bg-muted/20">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-20 min-w-[160px] border-r bg-muted/80 px-3 py-2 text-left font-medium backdrop-blur">
              Метрика
            </th>
            <th colSpan={2} className="border-r px-3 py-2 text-center font-medium">Итого</th>
            {daily.map((item) => (
              <th
                key={item.date}
                colSpan={2}
                className={`border-r px-3 py-2 text-center font-medium whitespace-nowrap ${
                  item.date === today ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                }`}
              >
                {format(new Date(item.date), 'dd.MM', { locale: ru })}
              </th>
            ))}
          </tr>
          <tr className="border-b bg-muted/30">
            <th className="sticky left-0 z-20 border-r bg-muted/80 px-3 py-2 text-left font-medium backdrop-blur" />
            <th className="border-r px-3 py-2 text-center font-medium">П</th>
            <th className="border-r px-3 py-2 text-center font-medium">Р</th>
            {daily.map((item) => (
              <Fragment key={item.date}>
                <th
                  key={`${item.date}-search`}
                  className={`border-r px-3 py-2 text-center font-medium ${
                    item.date === today ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  П
                </th>
                <th
                  key={`${item.date}-reco`}
                  className={`border-r px-3 py-2 text-center font-medium ${
                    item.date === today ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  Р 
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {BREAKDOWN_METRIC_ROWS.map((row) => (
            <tr key={row.key} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="sticky left-0 z-10 border-r bg-background/95 px-3 py-1.5 font-medium whitespace-nowrap backdrop-blur">
                {row.label}
              </td>
              <BreakdownCell
                value={row.totalSearchAccessor(totals)}
                formatter={row.formatter}
                tooltipText={row.showTooltip ? shareText(row.totalSearchAccessor(totals), row.totalRecoAccessor(totals)) : null}
              />
              <BreakdownCell
                value={row.totalRecoAccessor(totals)}
                formatter={row.formatter}
                tooltipText={row.showTooltip ? shareText(row.totalSearchAccessor(totals), row.totalRecoAccessor(totals)) : null}
              />
              {daily.map((item) => (
                <Fragment key={`${row.key}-${item.date}`}>
                  <BreakdownCell
                    key={`${row.key}-${item.date}-search`}
                    value={row.searchAccessor(item)}
                    formatter={row.formatter}
                    tooltipText={row.showTooltip ? shareText(row.searchAccessor(item), row.recoAccessor(item)) : null}
                    highlighted={item.date === today}
                  />
                  <BreakdownCell
                    key={`${row.key}-${item.date}-reco`}
                    value={row.recoAccessor(item)}
                    formatter={row.formatter}
                    tooltipText={row.showTooltip ? shareText(row.searchAccessor(item), row.recoAccessor(item)) : null}
                    highlighted={item.date === today}
                  />
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
