'use client'

import { useState, type ReactNode } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { RunHistoryPageSize, RunHistorySortDirection } from '@/types/run-history'

export const RUN_HISTORY_TABLE_CLASS_NAME = 'w-full table-fixed [&_th]:overflow-hidden [&_th]:px-2 [&_th]:text-[10px] [&_th]:tracking-normal [&_th]:[overflow-wrap:anywhere]'

export function RunHistoryColumnLayout({ widths }: { widths: readonly number[] }) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={`${index}-${width}`} style={{ width: `${width}%` }} />
      ))}
    </colgroup>
  )
}

export function RunHistoryCell({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TableCell className={cn('h-16 p-0 align-top', className)}>
      <button
        type="button"
        aria-expanded={expanded}
        title={expanded ? 'Свернуть ячейку' : 'Показать содержимое полностью'}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          'flex min-h-16 w-full cursor-pointer items-center px-3 py-2 text-left leading-5 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          expanded ? 'h-auto items-start' : 'h-16 overflow-hidden',
          contentClassName,
        )}
      >
        <span
          className={cn(
            'block min-w-0 w-full [overflow-wrap:anywhere]',
            expanded ? 'whitespace-pre-wrap' : 'line-clamp-2',
          )}
        >
          {children}
        </span>
      </button>
    </TableCell>
  )
}

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
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden text-left font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        <ChevronsUpDown className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'opacity-100' : 'opacity-40'}`} />
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
