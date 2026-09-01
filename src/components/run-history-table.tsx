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

export const RUN_HISTORY_TABLE_CLASS_NAME = 'min-w-[1120px] w-full table-fixed [&_th]:overflow-hidden [&_th]:px-2 [&_th]:text-[10px] [&_th]:tracking-normal [&_th]:[overflow-wrap:anywhere]'

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

export function RunHistoryMobileCard({
  title,
  status,
  children,
  actions,
}: {
  title: ReactNode
  status?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <article className="rounded-md border bg-card p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 break-words text-sm font-semibold leading-5">{title}</h3>
        {status && <div className="shrink-0">{status}</div>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">{children}</dl>
      {actions && <div className="mt-3 border-t pt-3">{actions}</div>}
    </article>
  )
}

export function RunHistoryMobileField({
  label,
  children,
  fullWidth = false,
  expandable = false,
  valueClassName,
}: {
  label: string
  children: ReactNode
  fullWidth?: boolean
  expandable?: boolean
  valueClassName?: string
}) {
  return (
    <div className={cn('min-w-0', fullWidth && 'col-span-2')}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 min-w-0 break-words leading-5 text-foreground', valueClassName)}>
        {expandable ? (
          <details className="group min-w-0">
            <summary className="min-w-0 cursor-pointer list-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="line-clamp-2 whitespace-pre-wrap break-words group-open:hidden">{children}</span>
              <span className="mt-1 block text-xs font-medium text-muted-foreground group-open:hidden">
                Показать полностью
              </span>
              <span className="hidden text-xs font-medium text-muted-foreground group-open:block">Свернуть</span>
            </summary>
            <div className="mt-2 whitespace-pre-wrap break-words">{children}</div>
          </details>
        ) : children}
      </dd>
    </div>
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
    <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
      <span>{loading ? 'Загрузка…' : `Показано ${from}–${to} из ${total}`}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as RunHistoryPageSize)}
        >
          <SelectTrigger className="col-span-3 h-11 w-full sm:h-8 sm:w-28">
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
        <span className="whitespace-nowrap text-center">{page} / {pageCount}</span>
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
