'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import type { VisibilityState } from '@tanstack/react-table'
import { RefreshCw, Download, Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DateRangePicker } from '@/components/date-range-picker'
import { syncReportsAction, getReportData, exportReportXlsx } from '@/lib/actions/reports'
import type { ReportData } from '@/types/reports'
import { columnGroups } from './columns'
import { ReportTable } from './report-table'

interface ReportsClientProps {
  initialData: ReportData | null
  wbAccountId: string
  initialDateFrom: string
  initialDateTo: string
}

export function ReportsClient({
  initialData,
  wbAccountId,
  initialDateFrom,
  initialDateTo,
}: ReportsClientProps) {
  const [data, setData] = useState<ReportData | null>(initialData)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(initialDateFrom),
    to: new Date(initialDateTo),
  })
  const [isSyncing, startSync] = useTransition()
  const [isExporting, startExport] = useTransition()

  const [groupVisibility, setGroupVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const g of columnGroups) init[g.id] = g.defaultVisible
    return init
  })

  const columnVisibility: VisibilityState = {}
  for (const g of columnGroups) {
    for (const colId of g.columnIds) {
      columnVisibility[colId] = groupVisibility[g.id] ?? false
    }
  }

  const dateFrom = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : initialDateFrom
  const dateTo = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : initialDateTo

  function handleSync() {
    startSync(async () => {
      const syncResult = await syncReportsAction(wbAccountId, dateFrom, dateTo)
      if (!syncResult.success) {
        toast.error(syncResult.error)
        return
      }
      const { totalRows, upserted, pages, durationMs } = syncResult.data
      toast.success(
        `Синхронизировано: ${upserted} из ${totalRows} строк (${pages} стр., ${Math.round(durationMs / 1000)}с)`,
      )
      const dataResult = await getReportData(wbAccountId, dateFrom, dateTo)
      if (dataResult.success) setData(dataResult.data)
      else toast.error(dataResult.error)
    })
  }

  function handleExport() {
    startExport(async () => {
      const result = await exportReportXlsx(wbAccountId, dateFrom, dateTo)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const { base64, filename } = result.data
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />

        <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Синхронизация…' : 'Синхронизировать'}
        </Button>

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || !data?.rows.length}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Экспорт…' : 'Excel'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 ml-auto">
              <Columns3 className="h-4 w-4" />
              Столбцы
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columnGroups.map((group) => (
              <DropdownMenuCheckboxItem
                key={group.id}
                checked={groupVisibility[group.id] ?? false}
                onCheckedChange={(checked) =>
                  setGroupVisibility((prev) => ({ ...prev, [group.id]: checked }))
                }
                disabled={group.id === 'identity'}
              >
                {group.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Last sync info */}
      {data?.lastSyncAt && (
        <p className="text-xs text-muted-foreground">
          Последняя синхронизация:{' '}
          {format(new Date(data.lastSyncAt), 'd MMM yyyy HH:mm', { locale: ru })}
        </p>
      )}

      {/* Table */}
      {data ? (
        <ReportTable
          rows={data.rows}
          summary={data.summary}
          columnVisibility={columnVisibility}
        />
      ) : (
        <div className="rounded-md border py-16 text-center text-muted-foreground text-sm">
          Нет данных за выбранный период. Нажмите «Синхронизировать».
        </div>
      )}
    </div>
  )
}
