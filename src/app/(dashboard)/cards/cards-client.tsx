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
import { WbArticleLink } from '@/components/wb-article-link'
import { getProductColumns } from './columns'
import { PriceCell } from './price-cell'
import { syncProductsAction } from '@/lib/actions/products'
import type { PaginatedProducts, ProductRow } from '@/types/products'
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

  function handleMobileSort(value: string) {
    const [sortBy, sortDir] = value.split(':')
    router.push(buildUrl({ sortBy, sortDir, page: 1 }))
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(data.total / data.pageSize)

  // ── Sync ────────────────────────────────────────────────────────────────────

  function handleSync() {
    startSync(async () => {
      const result = await syncProductsAction(wbAccountId)
      if (result.success) {
        toast.success(`Задача синхронизации поставлена в фон: ${result.data.id}`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar */}
      <div className="old-money-panel flex shrink-0 flex-wrap items-center gap-3 rounded-md p-3">
        <form onSubmit={handleSearchSubmit} className="flex w-full flex-wrap gap-2 lg:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Артикул или название..."
              className="w-full pl-8 sm:w-64"
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
          <SelectTrigger className="w-full sm:w-40">
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
          <SelectTrigger className="w-full sm:w-44">
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

        <div className="w-full sm:ml-auto sm:w-auto">
          <Button onClick={handleSync} disabled={syncing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </div>

      {/* Row count */}
      <p className="shrink-0 text-sm text-muted-foreground">
        Всего:{' '}
        <span className="font-medium text-foreground">
          {data.total.toLocaleString('ru-RU')}
        </span>{' '}
        товаров
      </p>

      <div className="lg:hidden">
        <Select
          value={`${currentSortBy || 'nmId'}:${currentSortDir === 'desc' ? 'desc' : 'asc'}`}
          onValueChange={handleMobileSort}
        >
          <SelectTrigger className="w-full" aria-label="Сортировка товаров">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nmId:asc">WB артикул: по возрастанию</SelectItem>
            <SelectItem value="nmId:desc">WB артикул: по убыванию</SelectItem>
            <SelectItem value="vendorCode:asc">Артикул продавца: А–Я</SelectItem>
            <SelectItem value="vendorCode:desc">Артикул продавца: Я–А</SelectItem>
            <SelectItem value="brand:asc">Бренд: А–Я</SelectItem>
            <SelectItem value="brand:desc">Бренд: Я–А</SelectItem>
            <SelectItem value="category:asc">Категория: А–Я</SelectItem>
            <SelectItem value="category:desc">Категория: Я–А</SelectItem>
            <SelectItem value="price:asc">Цена: сначала ниже</SelectItem>
            <SelectItem value="price:desc">Цена: сначала выше</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 lg:hidden">
        {data.rows.map((row) => (
          <ProductMobileCard
            key={row.id}
            row={row}
            wbAccountId={wbAccountId}
            lastSyncAt={data.lastSyncAt}
          />
        ))}
        {data.rows.length === 0 && (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            Нет товаров по выбранным фильтрам
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden min-h-0 flex-1 overflow-auto rounded-md lg:block">
        <DataTable
          columns={getProductColumns(wbAccountId, data.lastSyncAt)}
          data={data.rows}
          sorting={sorting}
          onSortingChange={handleSortingChange}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
          >
            Назад
          </Button>
          <span className="order-first w-full text-center text-sm text-muted-foreground sm:order-none sm:w-auto">
            Страница {currentPage} из {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
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

function ProductMobileCard({
  row,
  wbAccountId,
  lastSyncAt,
}: {
  row: ProductRow
  wbAccountId: string
  lastSyncAt: string | null
}) {
  return (
    <article className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-sm font-semibold">{row.vendorCode}</h2>
          {row.vendorCodeLocal && (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              Локальный: {row.vendorCodeLocal}
            </p>
          )}
        </div>
        <WbArticleLink nmId={row.nmId} photoUrl={row.photoUrl} />
      </div>

      {row.title && <p className="mt-2 break-words text-sm">{row.title}</p>}
      <p className="mt-1 break-words text-xs text-muted-foreground">
        {[row.brand, row.category].filter(Boolean).join(' · ') || 'Без бренда и категории'}
      </p>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-md border bg-secondary/25 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Цена</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Нажмите, чтобы изменить</p>
        </div>
        <div className="shrink-0">
          <PriceCell row={row} wbAccountId={wbAccountId} lastSyncAt={lastSyncAt} />
        </div>
      </div>
    </article>
  )
}
