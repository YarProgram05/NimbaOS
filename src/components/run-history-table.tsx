'use client'

import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableHead } from '@/components/ui/table'
import type { RunHistoryPageSize, RunHistorySortDirection } from '@/types/run-history'

export function RunHistorySortableHead<TSortKey extends string>({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  className,
}: {
  label: string
  sortKey: TSortKey
  activeSortKey: TSortKey
  direction: RunHistorySortDirection
  onSort: (sortKey: TSortKey) => void
  className?: string
}) {
  const isActive = activeSortKey === sortKey

  return (
    <TableHead
      className={className}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ChevronsUpDown className={`h-3.5 w-3.5 ${isActive ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </TableHead>
  )
}

export function RunHistoryPager({
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  page: number
  pageSize: RunHistoryPageSize
  loading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: RunHistoryPageSize) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total > 0 ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{loading ? 'Загрузка…' : `Показано ${from}–${to} из ${total}`}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as RunHistoryPageSize)}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 строк</SelectItem>
            <SelectItem value="50">50 строк</SelectItem>
            <SelectItem value="100">100 строк</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Назад
        </Button>
        <span>{page} / {pageCount}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  )
}
