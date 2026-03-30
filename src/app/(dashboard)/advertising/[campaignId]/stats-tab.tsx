'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Download, Loader2, RefreshCw } from 'lucide-react'
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
  exportAdStatsXlsxAction,
  getCampaignStatsAction,
  syncCampaignStatsAction,
} from '@/lib/actions/advertising'
import type { AdStatRow } from '@/types/advertising'
import { AdStatsGrid } from './ad-stats-grid'
import { buildCampaignMetrics, toDateString } from './ad-metrics-utils'

interface StatsTabProps {
  campaignId: string
}

export function StatsTab({ campaignId }: StatsTabProps) {
  const [range, setRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  })
  const [rows, setRows] = useState<AdStatRow[]>([])
  const [isLoading, startLoading] = useTransition()
  const [isSyncing, startSync] = useTransition()
  const [isExporting, startExport] = useTransition()

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

  function handleSync() {
    if (!dateFrom || !dateTo) {
      toast.error('Укажите период')
      return
    }

    startSync(async () => {
      const syncResult = await syncCampaignStatsAction(campaignId, dateFrom, dateTo)
      if (!syncResult.success) {
        toast.error(syncResult.error)
        return
      }

      const dataResult = await getCampaignStatsAction(campaignId, dateFrom, dateTo)
      if (!dataResult.success) {
        toast.error(dataResult.error)
        return
      }

      setRows(dataResult.data)
      toast.success(
        `Статистика синхронизирована: ${syncResult.data.upserted} строк` +
        (syncResult.data.errors > 0 ? `, ошибок ${syncResult.data.errors}` : '') +
        ` (${(syncResult.data.durationMs / 1000).toFixed(1)}с)`,
      )
    })
  }

  function handleExport() {
    if (!dateFrom || !dateTo) {
      toast.error('Укажите период')
      return
    }

    startExport(async () => {
      const result = await exportAdStatsXlsxAction(campaignId, dateFrom, dateTo)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      const { base64, filename } = result.data
      const byteChars = atob(base64)
      const byteArr = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)

      const blob = new Blob([byteArr], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <CardTitle className="text-base">Статистика кампании</CardTitle>
          <CardDescription>
            Ежедневные рекламные метрики по кампании за выбранный период
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
          <Button variant="outline" onClick={handleExport} disabled={isExporting || !dateFrom || !dateTo}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Экспорт Excel
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка статистики...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-base font-semibold">Нет данных за выбранный период</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Выполните синхронизацию, чтобы загрузить статистику кампании из WB.
            </p>
          </div>
        ) : (
          <AdStatsGrid daily={metrics.daily} totals={metrics.totals} />
        )}
      </CardContent>
    </Card>
  )
}
