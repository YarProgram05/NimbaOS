'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { getProductColumns } from './columns'
import { syncProductsAction } from '@/lib/actions/products'
import type { PaginatedProducts, SyncResult } from '@/types/products'
import type { SortingState } from '@tanstack/react-table'

interface CardsClientProps {
  data: PaginatedProducts
  wbAccountId: string
  currentSearch: string
  currentBrand: string
  currentCategory: string
  currentPage: number
  currentSortBy: string
  currentSortDir: string
}

export function CardsClient({
  data,
  wbAccountId,
  currentSearch,
  currentBrand,
  currentCategory,
  currentPage,
  currentSortBy,
  currentSortDir,
}: CardsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [syncing, startSync] = useTransition()
  const [search, setSearch] = useState(currentSearch)

  // ── URL param helpers ───────────────────────────────────────────────────────

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === '') {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    }
    return `${pathname}?${params.toString()}`
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ search: search || undefined, page: 1 }))
  }

  function handleSearchClear() {
    setSearch('')
    router.push(buildUrl({ search: undefined, page: 1 }))
  }

  // ── Filters ─────────────────────────────────────────────────────────────────

  function handleBrandChange(value: string) {
    router.push(buildUrl({ brand: value === '__all__' ? undefined : value, page: 1 }))
  }

  function handleCategoryChange(value: string) {
    router.push(buildUrl({ category: value === '__all__' ? undefined : value, page: 1 }))
  }

  // ── Sorting ─────────────────────────────────────────────────────────────────

  const sorting: SortingState = currentSortBy
    ? [{ id: currentSortBy, desc: currentSortDir === 'desc' }]
    : []

  function handleSortingChange(updater: SortingState | ((prev: SortingState) => SortingState)) {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    if (!first) {
      router.push(buildUrl({ sortBy: undefined, sortDir: undefined, page: 1 }))
    } else {
      router.push(
        buildUrl({ sortBy: first.id, sortDir: first.desc ? 'desc' : 'asc', page: 1 }),
      )
    }
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(data.total / data.pageSize)

  // ── Sync ────────────────────────────────────────────────────────────────────

  function handleSync() {
    startSync(async () => {
      const result = await syncProductsAction(wbAccountId)
      if (result.success) {
        const r = result.data as SyncResult
        toast.success(
          `Синхронизировано: +${r.created} новых, обновлено ${r.updated}, ` +
          `цен ${r.priceRows}` +
          (r.errors > 0 ? `, ошибок ${r.errors}` : '') +
          ` (${(r.durationMs / 1000).toFixed(1)}с)`,
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Артикул или название..."
              className="pl-8 w-64"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Найти
          </Button>
          {currentSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSearchClear}
            >
              Сбросить
            </Button>
          )}
        </form>

        <Select value={currentBrand || '__all__'} onValueChange={handleBrandChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Бренд" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все бренды</SelectItem>
            {data.brands.filter(Boolean).map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentCategory || '__all__'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все категории</SelectItem>
            {data.categories.filter(Boolean).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={handleSync} disabled={syncing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </div>

      {/* Row count */}
      <p className="text-sm text-muted-foreground">
        Всего:{' '}
        <span className="font-medium text-foreground">
          {data.total.toLocaleString('ru-RU')}
        </span>{' '}
        товаров
      </p>

      {/* Table */}
      <DataTable
        columns={getProductColumns(wbAccountId, data.lastSyncAt)}
        data={data.rows}
        sorting={sorting}
        onSortingChange={handleSortingChange}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
          </span>
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
