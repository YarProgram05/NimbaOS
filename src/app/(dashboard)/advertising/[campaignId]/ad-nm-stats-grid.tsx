'use client'

import type { AdNmStatRow } from '@/types/advertising'

interface AdNmStatsGridProps {
  rows: AdNmStatRow[]
}

const NUMBER_FORMAT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const MONEY_FORMAT = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function AdNmStatsGrid({ rows }: AdNmStatsGridProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Нет сохраненной детализации по артикулам за выбранный период.
      </div>
    )
  }

  const totals = rows.reduce(
    (sum, row) => ({
      spend: sum.spend + parseMoney(row.spend),
      views: sum.views + row.views,
      clicks: sum.clicks + row.clicks,
      cartAdds: sum.cartAdds + row.cartAdds,
      adOrders: sum.adOrders + row.orders,
      sales: sum.sales + row.sales,
      salesRevenue: sum.salesRevenue + parseMoney(row.salesRevenue),
    }),
    {
      spend: 0,
      views: 0,
      clicks: 0,
      cartAdds: 0,
      adOrders: 0,
      sales: 0,
      salesRevenue: 0,
    },
  )

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Затраты" value={formatMoney(totals.spend)} />
        <Metric label="Корзины" value={formatNumber(totals.cartAdds)} />
        <Metric label="Рекламные заказы" value={formatNumber(totals.adOrders)} />
        <Metric label="Продажи" value={formatMoney(totals.salesRevenue)} />
      </div>

      <div className="overflow-x-auto rounded-md border bg-muted/20">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 min-w-[240px] border-r bg-muted/80 px-3 py-2 text-left font-medium backdrop-blur">
                Артикул
              </th>
              <Head>Затраты</Head>
              <Head>Показы</Head>
              <Head>Переходы</Head>
              <Head>CTR</Head>
              <Head>CPC</Head>
              <Head>Корзины</Head>
              <Head>Рекл. заказы</Head>
              <Head>CPO</Head>
              <Head>Заказы WB</Head>
              <Head>Сумма заказов</Head>
              <Head>Продажи</Head>
              <Head>Выручка</Head>
              <Head>Возвраты</Head>
              <Head>Открытия</Head>
              <Head>Корзины WB</Head>
              <Head>Заказы воронки</Head>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.nmId} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="sticky left-0 z-10 border-r bg-background/95 px-3 py-2 backdrop-blur">
                  <div className="flex min-w-0 items-center gap-2">
                    {row.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-md border object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card text-xs text-muted-foreground">
                        WB
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.vendorCode || `WB ${row.nmId}`}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        WB {row.nmId}
                        {row.brandName ? ` · ${row.brandName}` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <Cell>{formatMoney(row.spend)}</Cell>
                <Cell>{formatNumber(row.views)}</Cell>
                <Cell>{formatNumber(row.clicks)}</Cell>
                <Cell>{formatPercent(row.ctr)}</Cell>
                <Cell>{formatMoney(row.cpc)}</Cell>
                <Cell>{formatNumber(row.cartAdds)}</Cell>
                <Cell>{formatNumber(row.orders)}</Cell>
                <Cell>{formatMoney(row.cpo)}</Cell>
                <Cell>{formatNumber(row.wbOrders)}</Cell>
                <Cell>{formatMoney(row.wbOrderRevenue)}</Cell>
                <Cell>{formatNumber(row.sales)}</Cell>
                <Cell>{formatMoney(row.salesRevenue)}</Cell>
                <Cell>{formatNumber(row.returns)}</Cell>
                <Cell>{formatNumber(row.funnelOpenCount)}</Cell>
                <Cell>{formatNumber(row.funnelCartCount)}</Cell>
                <Cell>{formatNumber(row.funnelOrdersCount)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold">{value}</p>
    </div>
  )
}

function Head({ children }: { children: string }) {
  return <th className="min-w-[92px] px-3 py-2 text-right font-medium whitespace-nowrap">{children}</th>
}

function Cell({ children }: { children: string }) {
  return <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{children}</td>
}

function parseMoney(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: string | number): string {
  return MONEY_FORMAT.format(typeof value === 'number' ? value : parseMoney(value))
}

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value)
}

function formatPercent(value: string): string {
  return `${parseMoney(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}
