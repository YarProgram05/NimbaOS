import type { DailyMetrics, ArticleSummary } from '@/types/sales-plan'

export type MetricFormatter = 'rub' | 'number' | 'percent'

export interface MetricRowDef {
  key: string
  label: string
  accessor: (m: DailyMetrics) => string | number
  formatter: MetricFormatter
  /** For summary columns: how to aggregate from plan/article data */
  summaryPlanMonth?: (s: ArticleSummary) => string | number | null
  summaryFactMonth?: (s: ArticleSummary) => string | number | null
  summaryPlanDay?: (s: ArticleSummary) => string | number | null
  summaryFactDay?: (s: ArticleSummary) => string | number | null
}

export const METRIC_ROWS: MetricRowDef[] = [
  {
    key: 'revenueOrders',
    label: 'Выр. заказы',
    accessor: (m) => m.revenueOrders,
    formatter: 'rub',
    summaryPlanMonth: () => null,
    summaryFactMonth: (s) => s.revenueOrdersTotal,
    summaryPlanDay: () => null,
    summaryFactDay: () => null,
  },
  {
    key: 'ordersCount',
    label: 'Кол-во заказов',
    accessor: (m) => m.ordersCount,
    formatter: 'number',
    summaryPlanMonth: () => null,
    summaryFactMonth: (s) => s.ordersCountTotal,
    summaryPlanDay: () => null,
    summaryFactDay: () => null,
  },
  {
    key: 'revenueSales',
    label: 'Выр. продажи',
    accessor: (m) => m.revenueSales,
    formatter: 'rub',
    summaryPlanMonth: () => null,
    summaryFactMonth: (s) => s.revenueSalesTotal,
    summaryPlanDay: () => null,
    summaryFactDay: () => null,
  },
  {
    key: 'boughtQty',
    label: 'Выкупили, шт.',
    accessor: (m) => m.boughtQty,
    formatter: 'number',
    summaryPlanMonth: (s) => s.planMonth,
    summaryFactMonth: (s) => s.factMonth,
    summaryPlanDay: (s) => s.planDay,
    summaryFactDay: (s) => s.factDay,
  },
  {
    key: 'visits',
    label: 'Переходы, шт.',
    accessor: (m) => m.visits,
    formatter: 'number',
  },
  {
    key: 'cartPercent',
    label: 'Корзина, %',
    accessor: (m) => m.cartPercent,
    formatter: 'percent',
  },
  {
    key: 'cartQty',
    label: 'Корзина, шт.',
    accessor: (m) => m.cartQty,
    formatter: 'number',
  },
  {
    key: 'orderPercent',
    label: 'Заказ, %',
    accessor: (m) => m.orderPercent,
    formatter: 'percent',
  },
  {
    key: 'avgPrice',
    label: 'Ср. цена',
    accessor: (m) => m.avgPrice,
    formatter: 'rub',
  },
]

/** Format a value according to its formatter */
export function formatMetricValue(
  value: string | number | null | undefined,
  formatter: MetricFormatter,
): string {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'

  switch (formatter) {
    case 'rub':
      return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    case 'number':
      return num.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
    case 'percent':
      return (num * 100).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
    default:
      return String(value)
  }
}
