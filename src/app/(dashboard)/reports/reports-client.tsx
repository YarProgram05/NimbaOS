'use client'

import { useState, useTransition, useMemo } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import type { VisibilityState } from '@tanstack/react-table'
import { RefreshCw, Download, Columns3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { DateRangePicker } from '@/components/date-range-picker'
import { syncReportsAction, getReportData, exportReportXlsx } from '@/lib/actions/reports'
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

const GROUP_LABELS: Record<string, string> = {
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

  // ── Filters and grouping ──────────────────────────────────────────────────
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [groupBy, setGroupBy] = useState<GroupBy>('')

  // Unique values for filter dropdowns
  const { brands, categories, tags } = useMemo(() => {
    const rows = data?.rows ?? []
    const brands = Array.from(new Set(rows.map((r) => r.brandName).filter(Boolean))).sort()
    const categories = Array.from(new Set(rows.map((r) => r.subjectName).filter(Boolean))).sort()
    const tags = Array.from(new Set(rows.map((r) => r.tags).filter(Boolean))).sort()
    return { brands, categories, tags }
  }, [data])

  // Filtered rows based on active filters
  const filteredRows = useMemo(() => {
    let rows = data?.rows ?? []
    if (selectedBrand) rows = rows.filter((r) => r.brandName === selectedBrand)
    if (selectedCategory) rows = rows.filter((r) => r.subjectName === selectedCategory)
    if (selectedTag) rows = rows.filter((r) => r.tags === selectedTag)
    return rows
  }, [data, selectedBrand, selectedCategory, selectedTag])

  // When grouping is active, compute group summary rows and interleave them
  // Group summary = sum of numeric fields + empty strings for identity
  const { displayRows, groupSummaries } = useMemo(() => {
    if (!groupBy) return { displayRows: filteredRows, groupSummaries: new Map<string, ReportRow>() }

    // Group filtered rows by the groupBy field
    const grouped = new Map<string, ReportRow[]>()
    for (const row of filteredRows) {
      const key = row[groupBy as keyof ReportRow] as string || '—'
      const arr = grouped.get(key) ?? []
      arr.push(row)
      grouped.set(key, arr)
    }

    const summaries = new Map<string, ReportRow>()
    const display: ReportRow[] = []

    for (const [key, rows] of Array.from(grouped.entries())) {
      // Aggregate a summary row for this group
      const groupSum = aggregateRows(rows, key, groupBy)
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

  const hasFilters = selectedBrand || selectedCategory || selectedTag

  return (
    <div className="space-y-3">
      {/* Toolbar row 1: dates + actions */}
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

      {/* Toolbar row 2: filters + grouping */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Brand filter */}
          <FilterDropdown
            label="Бренд"
            value={selectedBrand}
            options={brands}
            onChange={setSelectedBrand}
          />

          {/* Category filter */}
          <FilterDropdown
            label="Категория"
            value={selectedCategory}
            options={categories}
            onChange={setSelectedCategory}
          />

          {/* Tag filter */}
          {tags.length > 0 && (
            <FilterDropdown
              label="Ярлык"
              value={selectedTag}
              options={tags}
              onChange={setSelectedTag}
            />
          )}

          {/* Clear filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-8 text-muted-foreground"
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

          {/* Grouping */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8">
                  Группировка
                  {groupBy && (
                    <span className="text-primary font-semibold">{GROUP_LABELS[groupBy]}</span>
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

      {/* Last sync info */}
      {data?.lastSyncAt && (
        <p className="text-xs text-muted-foreground">
          Последняя синхронизация:{' '}
          {format(new Date(data.lastSyncAt), 'd MMM yyyy HH:mm', { locale: ru })}
          {filteredRows.length !== (data?.rows.length ?? 0) && (
            <span className="ml-2">
              · Показано {filteredRows.length} из {data.rows.length} строк
            </span>
          )}
        </p>
      )}

      {/* Table */}
      {data ? (
        <ReportTable
          rows={displayRows}
          summary={data.summary}
          columnVisibility={columnVisibility}
          groupBy={groupBy}
          groupSummaries={groupSummaries}
        />
      ) : (
        <div className="rounded-md border py-16 text-center text-muted-foreground text-sm">
          Нет данных за выбранный период. Нажмите «Синхронизировать».
        </div>
      )}
    </div>
  )
}

// ── Filter dropdown ───────────────────────────────────────────────────────────

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
              <X className="h-3 w-3 mr-1" /> Все {label.toLowerCase()}ы
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

// ── Group row aggregation ─────────────────────────────────────────────────────

function sumStr(rows: ReportRow[], key: keyof ReportRow): string {
  return rows.reduce((s, r) => s + parseFloat(String(r[key]) || '0'), 0).toFixed(2)
}

function sumNum(rows: ReportRow[], key: keyof ReportRow): number {
  return rows.reduce((s, r) => s + Number(r[key]), 0)
}

function aggregateRows(rows: ReportRow[], groupKey: string, groupBy: string): ReportRow {
  const count = rows.length
  const totalSale = rows.reduce((s, r) => s + parseFloat(r.sale), 0)
  const totalOP = rows.reduce((s, r) => s + parseFloat(r.operatingProfit), 0)
  const totalBought = sumNum(rows, 'boughtWithReturns')
  const totalDelivered = sumNum(rows, 'delivered')

  return {
    // Identity — show group name
    nmId: -1, // sentinel for group row rendering
    subjectName: groupBy === 'subjectName' ? `${groupKey} (${count})` : '',
    vendorCode: groupBy === 'brandName' ? `${groupKey} (${count})` : '',
    brandName: groupBy === 'brandName' ? `${groupKey} (${count})` : '',

    // Aggregated sums
    sale: sumStr(rows, 'sale'),
    toTransfer: sumStr(rows, 'toTransfer'),
    totalToPay: sumStr(rows, 'totalToPay'),
    operatingProfit: sumStr(rows, 'operatingProfit'),
    operatingProfitUnit: totalBought > 0 ? (totalOP / totalBought).toFixed(2) : '0.00',
    operatingProfitShare: sumStr(rows, 'operatingProfitShare'),
    avgPrice: totalSale > 0 ? (totalSale / sumNum(rows, 'boughtWithoutReturns') || 0).toFixed(2) : '0.00',

    boughtWithReturns: totalBought,
    buyoutPercent: totalDelivered > 0 ? (totalBought * 100 / totalDelivered).toFixed(2) : '0.00',
    boughtWithoutReturns: sumNum(rows, 'boughtWithoutReturns'),
    returns: sumNum(rows, 'returns'),

    marginality: totalSale > 0 ? (totalOP * 100 / totalSale).toFixed(2) : '0.00',
    rentability: sumStr(rows, 'rentability'),

    adBalance: sumStr(rows, 'adBalance'),
    adAll: sumStr(rows, 'adAll'),
    drr: '0.00',

    logistics: sumStr(rows, 'logistics'),
    logisticsUnit: totalBought > 0 ? (parseFloat(sumStr(rows, 'logistics')) / totalBought).toFixed(2) : '0.00',
    delivered: totalDelivered,
    logisticsFromSalesPercent: totalSale > 0 ? (parseFloat(sumStr(rows, 'logistics')) * 100 / totalSale).toFixed(2) : '0.00',

    externalAd: sumStr(rows, 'externalAd'),
    selfPurchaseCost: sumStr(rows, 'selfPurchaseCost'),
    cashbackDistributions: sumStr(rows, 'cashbackDistributions'),
    selfPurchaseAmount: sumStr(rows, 'selfPurchaseAmount'),

    storageFromSalesPercent: totalSale > 0 ? (parseFloat(sumStr(rows, 'storageFee')) * 100 / totalSale).toFixed(2) : '0.00',
    costPrice: sumStr(rows, 'costPrice'),
    storageFee: sumStr(rows, 'storageFee'),
    acceptance: sumStr(rows, 'acceptance'),
    additionalPayment: sumStr(rows, 'additionalPayment'),
    penalty: sumStr(rows, 'penalty'),
    taxes: sumStr(rows, 'taxes'),
    commission: sumStr(rows, 'commission'),
    selfPurchases: sumStr(rows, 'selfPurchases'),
    acquiringFee: sumStr(rows, 'acquiringFee'),

    cancellations: sumNum(rows, 'cancellations'),

    salesReturnsNoSpp: sumStr(rows, 'salesReturnsNoSpp'),
    salesWithSpp: sumStr(rows, 'salesWithSpp'),
    returnsWithSpp: sumStr(rows, 'returnsWithSpp'),
    salesNoSpp: sumStr(rows, 'salesNoSpp'),
    returnsNoSpp: sumStr(rows, 'returnsNoSpp'),
    commissionOnSale: sumStr(rows, 'commissionOnSale'),
    commissionOnReturn: sumStr(rows, 'commissionOnReturn'),
    deductions: sumStr(rows, 'deductions'),
    salesToTransfer: sumStr(rows, 'salesToTransfer'),
    returnsToTransfer: sumStr(rows, 'returnsToTransfer'),
    acquiringOnSale: sumStr(rows, 'acquiringOnSale'),
    tags: '',
    acquiringOnReturn: sumStr(rows, 'acquiringOnReturn'),
  }
}
