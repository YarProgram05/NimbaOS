import type { AdCampaignMetrics, AdDailyMetrics } from '@/types/advertising'

export type AdMetricFormatter = 'rub' | 'number' | 'percent'

export interface AdMetricRowDef {
  key: string
  label: string
  accessor: (m: AdDailyMetrics) => string | number | null
  totalAccessor: (m: AdCampaignMetrics['totals']) => string | number | null
  formatter: AdMetricFormatter
}

export const AD_METRIC_ROWS: AdMetricRowDef[] = [
  {
    key: 'totalSpend',
    label: 'Затраты',
    accessor: (m) => m.totalSpend,
    totalAccessor: (m) => m.totalSpend,
    formatter: 'rub',
  },
  {
    key: 'totalCpo',
    label: 'CPO',
    accessor: (m) => m.totalCpo,
    totalAccessor: (m) => m.totalCpo,
    formatter: 'rub',
  },
  {
    key: 'totalBid',
    label: 'Ставка',
    accessor: (m) => m.totalBid,
    totalAccessor: (m) => m.totalBid,
    formatter: 'rub',
  },
  {
    key: 'totalViews',
    label: 'Просмотры',
    accessor: (m) => m.totalViews,
    totalAccessor: (m) => m.totalViews,
    formatter: 'number',
  },
  {
    key: 'totalCtr',
    label: 'CTR',
    accessor: (m) => m.totalCtr,
    totalAccessor: (m) => m.totalCtr,
    formatter: 'percent',
  },
  {
    key: 'totalClicks',
    label: 'Переходы',
    accessor: (m) => m.totalClicks,
    totalAccessor: (m) => m.totalClicks,
    formatter: 'number',
  },
  {
    key: 'totalCartAdds',
    label: 'Корзины',
    accessor: (m) => m.totalCartAdds,
    totalAccessor: (m) => m.totalCartAdds,
    formatter: 'number',
  },
  {
    key: 'totalOrders',
    label: 'Заказы',
    accessor: (m) => m.totalOrders,
    totalAccessor: (m) => m.totalOrders,
    formatter: 'number',
  },
  {
    key: 'totalCpc',
    label: 'CPC',
    accessor: (m) => m.totalCpc,
    totalAccessor: (m) => m.totalCpc,
    formatter: 'rub',
  },
]

export function formatAdMetricValue(
  value: string | number | null | undefined,
  formatter: AdMetricFormatter,
): string {
  if (value === null || value === undefined) return '—'

  const num = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(num)) return '—'

  switch (formatter) {
    case 'rub':
      return num.toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    case 'number':
      return num.toLocaleString('ru-RU', {
        maximumFractionDigits: 0,
      })
    case 'percent':
      return `${num.toLocaleString('ru-RU', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`
    default:
      return String(value)
  }
}
