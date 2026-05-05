'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import type { VisibilityState } from '@tanstack/react-table'
import { Columns3, Download, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DateRangePicker } from '@/components/date-range-picker'
import { syncReportsAction, exportReportXlsx } from '@/lib/actions/reports'
import { aggregateReportRows } from '@/lib/reports/aggregate-report-rows'
import type { ReportData, ReportRow } from '@/types/reports'
import { columnGroups } from './columns'
import { ReportTable } from './report-table'

interface ReportsClientProps {
  initialData: ReportData | null
  wbAccountId: string
  initialDateFrom: string
  initialDateTo: string
}

type GroupBy = '' | 'subjectName' | 'brandName'

const GROUP_LABELS: Record<GroupBy, string> = {
  '': 'Без группировки',
  subjectName: 'Категория',
  brandName: 'Бренд',
}

export function ReportsClient({
  initialData,
  wbAccountId,
  initialDateFrom,
  initialDateTo,
}: ReportsClientProps) {
  const data = initialData
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('')

  useEffect(() => {
    setDateRange({
      from: new Date(initialDateFrom),
      to: new Date(initialDateTo),
    })
  }, [initialDateFrom, initialDateTo])

  const { brands, categories, tags } = useMemo(() => {
    const rows = data?.rows ?? []
    const brands = Array.from(new Set(rows.map((r) => r.brandName).filter(Boolean))).sort()
    const categories = Array.from(new Set(rows.map((r) => r.subjectName).filter(Boolean))).sort()
    const tags = Array.from(new Set(rows.map((r) => r.tags).filter(Boolean))).sort()
    return { brands, categories, tags }
  }, [data])

  const filteredRows = useMemo(() => {
    let rows = data?.rows ?? []
    if (selectedBrand) rows = rows.filter((r) => r.brandName === selectedBrand)
    if (selectedCategory) rows = rows.filter((r) => r.subjectName === selectedCategory)
    if (selectedTag) rows = rows.filter((r) => r.tags === selectedTag)
    return rows
  }, [data, selectedBrand, selectedCategory, selectedTag])

  const tableSummary = useMemo(
    () => aggregateReportRows(filteredRows, { subjectName: 'Итого' }),
    [filteredRows],
  )

  const { displayRows, groupSummaries } = useMemo(() => {
    if (!groupBy) {
      return { displayRows: filteredRows, groupSummaries: new Map<string, ReportRow>() }
    }

    const grouped = new Map<string, ReportRow[]>()
    for (const row of filteredRows) {
      const key = ((row[groupBy as keyof ReportRow] as string) || '—').trim() || '—'
      const arr = grouped.get(key) ?? []
      arr.push(row)
      grouped.set(key, arr)
    }

    const summaries = new Map<string, ReportRow>()
    const display: ReportRow[] = []

    for (const [key, rows] of Array.from(grouped.entries())) {
      const count = rows.length
      const groupSum = aggregateReportRows(rows, {
        nmId: -1,
        subjectName: groupBy === 'subjectName' ? `${key} (${count})` : '',
        vendorCode: groupBy === 'brandName' ? `${key} (${count})` : '',
        brandName: groupBy === 'brandName' ? `${key} (${count})` : '',
      })
      summaries.set(key, groupSum)
      display.push(groupSum, ...rows)
    }

    return { displayRows: display, groupSummaries: summaries }
  }, [filteredRows, groupBy])

  const columnVisibility: VisibilityState = {}
  for (const g of columnGroups) {
    for (const colId of g.columnIds) {
      columnVisibility[colId] = groupVisibility[g.id] ?? false
    }
  }

  const dateFrom = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : initialDateFrom
  const dateTo = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : initialDateTo

  function handleDateRangeChange(range: DateRange) {
    setDateRange(range)
    if (!range.from) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('dateFrom', format(range.from, 'yyyy-MM-dd'))
    params.set('dateTo', format(range.to ?? range.from, 'yyyy-MM-dd'))
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSync() {
    startSync(async () => {
      const syncResult = await syncReportsAction(wbAccountId, dateFrom, dateTo)
      if (!syncResult.success) {
        toast.error(syncResult.error)
        return
      }

      toast.success(`Задача синхронизации поставлена в фон: ${syncResult.data.id}`)
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

  const hasFilters = selectedBrand || selectedCategory || selectedTag
  const totalArticles = data?.rows.length ?? 0
  const visibleArticles = filteredRows.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />

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
            <Button variant="outline" className="ml-auto gap-2">
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

      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Бренд"
            value={selectedBrand}
            options={brands}
            onChange={setSelectedBrand}
          />

          <FilterDropdown
            label="Категория"
            value={selectedCategory}
            options={categories}
            onChange={setSelectedCategory}
          />

          {tags.length > 0 && (
            <FilterDropdown
              label="Ярлык"
              value={selectedTag}
              options={tags}
              onChange={setSelectedTag}
            />
          )}

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground"
              onClick={() => {
                setSelectedBrand('')
                setSelectedCategory('')
                setSelectedTag('')
              }}
            >
              <X className="h-3 w-3" />
              Сбросить
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-md border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              Артикулов:{' '}
              <span className="font-medium text-foreground">{visibleArticles}</span>
              {visibleArticles !== totalArticles && (
                <span className="text-muted-foreground"> из {totalArticles}</span>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  Группировка
                  {groupBy && (
                    <span className="font-semibold text-primary">{GROUP_LABELS[groupBy]}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(GROUP_LABELS) as GroupBy[]).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setGroupBy(key)}
                    className={groupBy === key ? 'font-semibold text-primary' : ''}
                  >
                    {GROUP_LABELS[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {data?.lastSyncAt && (
        <p className="text-xs text-muted-foreground">
          Последняя синхронизация:{' '}
          {format(new Date(data.lastSyncAt), 'd MMM yyyy HH:mm', { locale: ru })}
        </p>
      )}

      {data && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            data.coverage.isCovered
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {data.coverage.isCovered
            ? `Период ${data.dateFrom} — ${data.dateTo} сохранён в базе. Данные открываются локально без повторного запроса WB.`
            : `Период ${data.dateFrom} — ${data.dateTo} ещё не отмечен как полностью синхронизированный. Нажмите «Синхронизировать», чтобы загрузить его в фон.`}
        </div>
      )}

      {data ? (
        <ReportTable
          rows={displayRows}
          summary={tableSummary}
          columnVisibility={columnVisibility}
          groupBy={groupBy}
          groupSummaries={groupSummaries}
        />
      ) : (
        <div className="rounded-md border py-16 text-center text-sm text-muted-foreground">
          Нет данных за выбранный период. Нажмите «Синхронизировать».
        </div>
      )}
    </div>
  )
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={value ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1"
        >
          {label}
          {value && <span className="max-w-[120px] truncate">{value}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {value && (
          <>
            <DropdownMenuItem onClick={() => onChange('')} className="text-muted-foreground">
              <X className="mr-1 h-3 w-3" /> Все {label.toLowerCase()}ы
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onChange(opt)}
            className={value === opt ? 'font-semibold text-primary' : ''}
          >
            {opt}
          </DropdownMenuItem>
        ))}
        {options.length === 0 && (
          <DropdownMenuItem disabled>Нет данных</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
