'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getCampaignClustersAction,
  syncCampaignClustersAction,
} from '@/lib/actions/advertising'
import type { AdClusterRow } from '@/types/advertising'

interface ClustersTabProps {
  campaignId: string
}

type SortColumn = 'cluster' | 'ctr' | 'position' | 'views' | 'clicks' | 'cartAdds' | 'orders' | 'cpm'

function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNumber(value: number): string {
  return value.toLocaleString('ru-RU')
}

function formatDecimal(value: string, suffix = ''): string {
  return `${Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}${suffix}`
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean
  direction: 'asc' | 'desc'
}) {
  if (!active) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40 shrink-0" />
  return direction === 'asc'
    ? <ArrowUp className="ml-1 h-3.5 w-3.5 shrink-0" />
    : <ArrowDown className="ml-1 h-3.5 w-3.5 shrink-0" />
}

export function ClustersTab({ campaignId }: ClustersTabProps) {
  const [range, setRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  })
  const [rows, setRows] = useState<AdClusterRow[]>([])
  const [sortColumn, setSortColumn] = useState<SortColumn>('clicks')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isLoading, startLoading] = useTransition()
  const [isSyncing, startSync] = useTransition()

  const dateFrom = useMemo(
    () => (range.from ? toDateString(range.from) : null),
    [range.from],
  )
  const dateTo = useMemo(
    () => (range.to ? toDateString(range.to) : dateFrom),
    [range.to, dateFrom],
  )

  useEffect(() => {
    if (!dateFrom || !dateTo) return

    startLoading(async () => {
      const result = await getCampaignClustersAction(campaignId, dateFrom, dateTo)
      if (result.success) {
        setRows(result.data)
      } else {
        toast.error(result.error)
      }
    })
  }, [campaignId, dateFrom, dateTo])

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection(column === 'cluster' ? 'asc' : 'desc')
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let left: string | number = ''
      let right: string | number = ''

      switch (sortColumn) {
        case 'cluster':
          left = a.cluster.toLowerCase()
          right = b.cluster.toLowerCase()
          break
        case 'ctr':
          left = parseFloat(a.ctr)
          right = parseFloat(b.ctr)
          break
        case 'position':
          left = parseFloat(a.position)
          right = parseFloat(b.position)
          break
        case 'views':
          left = a.views
          right = b.views
          break
        case 'clicks':
          left = a.clicks
          right = b.clicks
          break
        case 'cartAdds':
          left = a.cartAdds
          right = b.cartAdds
          break
        case 'orders':
          left = a.orders
          right = b.orders
          break
        case 'cpm':
          left = parseFloat(a.cpm)
          right = parseFloat(b.cpm)
          break
      }

      const comparison = left < right ? -1 : left > right ? 1 : 0
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [rows, sortColumn, sortDirection])

  function handleSync() {
    if (!dateFrom || !dateTo) {
      toast.error('Укажите период')
      return
    }

    startSync(async () => {
      const syncResult = await syncCampaignClustersAction(campaignId, dateFrom, dateTo)
      if (!syncResult.success) {
        toast.error(syncResult.error)
        return
      }

      const dataResult = await getCampaignClustersAction(campaignId, dateFrom, dateTo)
      if (!dataResult.success) {
        toast.error(dataResult.error)
        return
      }

      setRows(dataResult.data)
      toast.success(
        `Кластеры синхронизированы: ${syncResult.data.created} строк` +
        (syncResult.data.errors > 0 ? `, ошибок ${syncResult.data.errors}` : '') +
        ` (${(syncResult.data.durationMs / 1000).toFixed(1)}с)`,
      )
    })
  }

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <CardTitle className="text-base">Поисковые кластеры</CardTitle>
          <CardDescription>
            Эффективность кластеров по выбранному периоду с сортировкой по метрикам
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <Button variant="outline" onClick={handleSync} disabled={isSyncing || !dateFrom || !dateTo}>
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка кластеров...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-base font-semibold">Нет данных по кластерам</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Выполните синхронизацию, чтобы загрузить поисковые кластеры кампании из WB.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium"
                    onClick={() => handleSort('cluster')}
                  >
                    <span className="flex items-center">
                      Кластер
                      <SortIcon active={sortColumn === 'cluster'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('ctr')}
                  >
                    <span className="flex items-center justify-end">
                      CTR
                      <SortIcon active={sortColumn === 'ctr'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('position')}
                  >
                    <span className="flex items-center justify-end">
                      Поз.
                      <SortIcon active={sortColumn === 'position'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('views')}
                  >
                    <span className="flex items-center justify-end">
                      Показы
                      <SortIcon active={sortColumn === 'views'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('clicks')}
                  >
                    <span className="flex items-center justify-end">
                      Клики
                      <SortIcon active={sortColumn === 'clicks'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('cartAdds')}
                  >
                    <span className="flex items-center justify-end">
                      Корзины
                      <SortIcon active={sortColumn === 'cartAdds'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('orders')}
                  >
                    <span className="flex items-center justify-end">
                      Заказы
                      <SortIcon active={sortColumn === 'orders'} direction={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right font-medium"
                    onClick={() => handleSort('cpm')}
                  >
                    <span className="flex items-center justify-end">
                      CPM
                      <SortIcon active={sortColumn === 'cpm'} direction={sortDirection} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.cluster}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(row.ctr, '%')}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(row.position)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.views)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.clicks)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.cartAdds)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.orders)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(row.cpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
