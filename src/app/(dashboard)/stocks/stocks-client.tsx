'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronRight, PackageCheck, RefreshCw, Search, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WbArticleLink } from '@/components/wb-article-link'
import { syncStocksAction } from '@/lib/actions/stocks'
import { TOTAL_STOCK_WAREHOUSE_VALUE, type PaginatedStocks, type StockRisk, type StockSummaryItem } from '@/types/stocks'

interface StocksClientProps {
  data: PaginatedStocks
  wbAccountId: string
  currentSearch: string
  currentBrand: string
  currentCategory: string
  currentWarehouse: string
  currentRisk: StockRisk | 'all'
  currentPage: number
  currentSortBy: string
  currentSortDir: string
}

const RISK_LABELS: Record<StockRisk | 'all', string> = {
  all: 'Все риски',
  out_of_stock: 'Нет остатка',
  low_stock: 'Низкий остаток',
  overstock: 'Излишек',
  ok: 'Норма',
  no_sales: 'Нет продаж',
}

export function StocksClient({
  data,
  wbAccountId,
  currentSearch,
  currentBrand,
  currentCategory,
  currentWarehouse,
  currentRisk,
  currentPage,
  currentSortBy,
  currentSortDir,
}: StocksClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentSearch)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())
  const [syncing, startSync] = useTransition()
  const totalPages = Math.ceil(data.total / data.pageSize)

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === '') params.delete(key)
      else params.set(key, String(value))
    }
    return `${pathname}?${params.toString()}`
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    router.push(buildUrl({ search: search || undefined, page: 1 }))
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncStocksAction(wbAccountId)
      if (result.success) {
        toast.success(`Синхронизация остатков поставлена в фон: ${result.data.id}`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function toggleSort(sortBy: string) {
    const nextDir = currentSortBy === sortBy && currentSortDir === 'asc' ? 'desc' : 'asc'
    router.push(buildUrl({ sortBy, sortDir: nextDir, page: 1 }))
  }

  function toggleExpanded(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StockMetric label="Всего на складе" value={formatNumber(data.totalUnits)} />
        <StockMetric label="Стоимость" value={formatRub(data.stockValue)} />
        <StockMetric label="Нет остатка" value={formatNumber(data.outOfStockCount)} tone="bad" />
        <StockMetric label="Низкий остаток" value={formatNumber(data.lowStockCount)} tone="warn" />
        <StockMetric label="В пути" value={formatNumber(data.inWayToClient + data.inWayFromClient)} />
      </section>

      <div className="old-money-panel flex shrink-0 flex-wrap items-center gap-3 rounded-md p-3">
        <form onSubmit={submitSearch} className="flex w-full flex-wrap gap-2 lg:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Артикул или название..."
              className="w-full pl-8 sm:w-64"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Найти</Button>
          {currentSearch && (
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push(buildUrl({ search: undefined, page: 1 }))}>
              Сбросить
            </Button>
          )}
        </form>

        <FilterSelect
          value={currentBrand || '__all__'}
          placeholder="Бренд"
          allLabel="Все бренды"
          values={data.brands}
          onChange={(value) => router.push(buildUrl({ brand: value === '__all__' ? undefined : value, page: 1 }))}
        />
        <FilterSelect
          value={currentCategory || '__all__'}
          placeholder="Категория"
          allLabel="Все категории"
          values={data.categories}
          onChange={(value) => router.push(buildUrl({ category: value === '__all__' ? undefined : value, page: 1 }))}
        />
        <Select
          value={currentWarehouse || '__all__'}
          onValueChange={(value) =>
            router.push(buildUrl({ warehouse: value === '__all__' ? undefined : value, page: 1 }))
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Склад" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все склады</SelectItem>
            <SelectItem value={TOTAL_STOCK_WAREHOUSE_VALUE}>Общий остаток</SelectItem>
            {data.warehouseOptions.map((warehouse) => (
              <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseName}>
                {warehouse.warehouseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentRisk} onValueChange={(value) => router.push(buildUrl({ risk: value === 'all' ? undefined : value, page: 1 }))}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Риск" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RISK_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-full sm:ml-auto sm:w-auto">
          <Button onClick={handleSync} disabled={syncing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Всего строк: <span className="font-medium text-foreground">{formatNumber(data.total)}</span>
        </span>
        <span>{data.syncedAt ? `Синхронизировано ${formatDateTime(data.syncedAt)}` : 'Остатки еще не синхронизированы'}</span>
      </div>

      {data.status === 'missing' ? (
        <section className="old-money-panel flex flex-col items-center justify-center rounded-md p-10 text-center">
          <Warehouse className="mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Нет снимка остатков</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Запустите синхронизацию, чтобы увидеть актуальные остатки на складах WB.
          </p>
          <Button onClick={handleSync} disabled={syncing} className="mt-4">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Синхронизировать остатки
          </Button>
        </section>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-card">
          <table className="min-w-[1100px] w-full">
            <thead className="sticky top-0 z-20 border-b bg-muted">
              <tr>
                <SortableHead label="Артикул" sortBy="vendorCode" currentSortBy={currentSortBy} onClick={toggleSort} />
                <SortableHead label="WB" sortBy="nmId" currentSortBy={currentSortBy} onClick={toggleSort} />
                <SortableHead label="Бренд" sortBy="brand" currentSortBy={currentSortBy} onClick={toggleSort} />
                <SortableHead label="Категория" sortBy="category" currentSortBy={currentSortBy} onClick={toggleSort} />
                <th className="px-4 py-3 text-left font-medium">Склад</th>
                <SortableHead label="Остаток" sortBy="quantity" currentSortBy={currentSortBy} onClick={toggleSort} />
                <th className="px-4 py-3 text-left font-medium">В пути</th>
                <SortableHead label="Стоимость" sortBy="stockValue" currentSortBy={currentSortBy} onClick={toggleSort} />
                <SortableHead label="Риск" sortBy="risk" currentSortBy={currentSortBy} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {data.rows.flatMap((row) => {
                const key = `${row.nmId}-${row.warehouseName}`
                const isExpanded = expandedRows.has(key)
                const children = row.sizeRows ?? []

                return [
                  <StockRow
                    key={key}
                    row={row}
                    rowKey={key}
                    canExpand={children.length > 0}
                    isExpanded={isExpanded}
                    onToggle={toggleExpanded}
                  />,
                  ...(isExpanded
                    ? children.map((child) => (
                      <StockRow
                        key={`${key}-${child.sizeLabel ?? child.vendorCode}`}
                        row={child}
                        rowKey={`${key}-${child.sizeLabel ?? child.vendorCode}`}
                        isChild
                      />
                    ))
                    : []),
                ]
              })}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="h-24 text-center text-muted-foreground">Нет строк под выбранные фильтры</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">Страница {currentPage} из {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  )
}

function StockMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warn' | 'bad' }) {
  const Icon = tone === 'bad' ? AlertTriangle : tone === 'warn' ? PackageCheck : Warehouse
  return (
    <div className="old-money-panel rounded-md p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="metric-label">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function StockRow({
  row,
  rowKey,
  canExpand = false,
  isExpanded = false,
  isChild = false,
  onToggle,
}: {
  row: StockSummaryItem
  rowKey: string
  canExpand?: boolean
  isExpanded?: boolean
  isChild?: boolean
  onToggle?: (key: string) => void
}) {
  return (
    <tr className={`border-t hover:bg-muted/30 ${isChild ? 'bg-muted/25' : ''}`}>
      <td className={`px-4 py-2.5 font-medium ${isChild ? 'pl-9' : ''}`}>
        <span className="inline-flex items-center gap-1">
          {canExpand ? (
            <button
              type="button"
              onClick={() => onToggle?.(rowKey)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
              title={isExpanded ? 'Скрыть размеры' : 'Показать размеры'}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span>{row.vendorCode}</span>
        </span>
      </td>
      <td className="px-4 py-2.5"><WbArticleLink nmId={row.nmId} photoUrl={row.photoUrl} /></td>
      <td className="px-4 py-2.5 text-muted-foreground">{row.brand ?? '-'}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{row.category ?? '-'}</td>
      <td className="px-4 py-2.5">{row.warehouseName}</td>
      <td className="px-4 py-2.5 font-semibold tabular-nums">{formatNumber(row.quantity)}</td>
      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
        {formatNumber(row.inWayToClient + row.inWayFromClient)}
      </td>
      <td className="px-4 py-2.5 tabular-nums">{formatRub(row.stockValue)}</td>
      <td className="px-4 py-2.5"><RiskBadge risk={row.risk} /></td>
    </tr>
  )
}

function FilterSelect({
  value,
  placeholder,
  allLabel,
  values,
  onChange,
}: {
  value: string
  placeholder: string
  allLabel: string
  values: string[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{allLabel}</SelectItem>
        {values.map((item) => (
          <SelectItem key={item} value={item}>{item}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SortableHead({
  label,
  sortBy,
  currentSortBy,
  onClick,
}: {
  label: string
  sortBy: string
  currentSortBy: string
  onClick: (sortBy: string) => void
}) {
  return (
    <th className="px-4 py-3 text-left font-medium">
      <button className="inline-flex items-center gap-1" onClick={() => onClick(sortBy)}>
        {label}
        <span className="text-xs text-muted-foreground">{currentSortBy === sortBy ? '•' : ''}</span>
      </button>
    </th>
  )
}

function RiskBadge({ risk }: { risk: StockRisk }) {
  const className =
    risk === 'out_of_stock'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : risk === 'low_stock'
        ? 'border-amber-600/40 bg-amber-50 text-amber-700'
        : risk === 'overstock'
          ? 'border-blue-600/40 bg-blue-50 text-blue-700'
          : 'border-border bg-secondary text-secondary-foreground'

  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{RISK_LABELS[risk]}</span>
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
