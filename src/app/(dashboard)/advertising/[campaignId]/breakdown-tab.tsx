'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Loader2 } from 'lucide-react'
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
import { getCampaignStatsAction } from '@/lib/actions/advertising'
import type { AdStatRow } from '@/types/advertising'
import { buildCampaignMetrics, toDateString } from './ad-metrics-utils'
import { AdBreakdownGrid } from './ad-breakdown-grid'

interface BreakdownTabProps {
  campaignId: string
}

export function BreakdownTab({ campaignId }: BreakdownTabProps) {
  const [range, setRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  })
  const [rows, setRows] = useState<AdStatRow[]>([])
  const [isLoading, startLoading] = useTransition()

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
      const result = await getCampaignStatsAction(campaignId, dateFrom, dateTo)
      if (result.success) {
        setRows(result.data)
      } else {
        toast.error(result.error)
      }
    })
  }, [campaignId, dateFrom, dateTo])

  const metrics = useMemo(() => buildCampaignMetrics(rows), [rows])

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <CardTitle className="text-base">Разбивка Поиск / Рекомендации</CardTitle>
          <CardDescription>
            Двойные колонки по дням с распределением трафика между поиском и рекомендациями
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <Button variant="outline" disabled>
            Используются данные из статистики
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка разбивки...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-base font-semibold">Нет данных для разбивки</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Сначала синхронизируйте статистику кампании за выбранный период.
            </p>
          </div>
        ) : (
          <AdBreakdownGrid daily={metrics.daily} totals={metrics.totals} />
        )}
      </CardContent>
    </Card>
  )
}
