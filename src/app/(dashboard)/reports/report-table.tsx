'use client'

import { useState, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender,
  type VisibilityState,
  type SortingState,
  type ColumnOrderState,
  type ExpandedState,
  type Cell,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { MobileSortControls } from '@/components/mobile-sort-controls'
import { saveReportColumnOrder } from '@/lib/actions/reports'
import type { ReportRow } from '@/types/reports'
import { reportColumns } from './columns'

const DEFAULT_ORDER = reportColumns.map((c) => c.id as string)

function normalizeColumnOrder(saved: string[] | null | undefined): ColumnOrderState {
  if (!saved) return DEFAULT_ORDER
  const known = saved.filter((id) => DEFAULT_ORDER.includes(id))
  const missing = DEFAULT_ORDER.filter((id) => !known.includes(id))
  return [...known, ...missing]
}

interface ReportTableProps {
  rows: ReportRow[]
  summary: ReportRow
  columnVisibility: VisibilityState
  groupBy?: string
  groupSummaries?: Map<string, ReportRow>
  initialColumnOrder?: string[] | null
}

const FROZEN_COUNT = 3 // nmId, subjectName, vendorCode
const MOBILE_PRIMARY_METRICS = new Set([
  'orderedRub',
  'sale',
  'operatingProfit',
  'marginality',
  'boughtWithReturns',
  'drr',
])
const IDENTITY_COLUMNS = new Set(['nmId', 'subjectName', 'vendorCode', 'brandName'])

export function ReportTable({ rows, summary, columnVisibility, groupBy, initialColumnOrder }: ReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => normalizeColumnOrder(initialColumnOrder))
  const didMount = useRef(false)

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    const timeout = window.setTimeout(() => {
      saveReportColumnOrder(columnOrder)
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [columnOrder])

  // Drag-and-drop state
  const dragColId = useRef<string | null>(null)

  const table = useReactTable({
    data: rows,
    columns: reportColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.sizeRows ?? [],
    state: { columnVisibility, sorting, columnOrder, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnOrderChange: setColumnOrder,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
  })

  const visibleLeafColumns = table.getVisibleLeafColumns()
  const mobileSort = sorting[0]
  const mobileSortOptions = [
    { value: '__none__', label: 'Без сортировки' },
    ...visibleLeafColumns
      .filter((column) => column.getCanSort())
      .map((column) => ({
        value: column.id,
        label: typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id,
      })),
  ]

  // Cumulative left offsets for frozen columns
  const frozenOffsets: number[] = []
  let offset = 0
  for (let i = 0; i < Math.min(FROZEN_COUNT, visibleLeafColumns.length); i++) {
    frozenOffsets.push(offset)
    offset += visibleLeafColumns[i].getSize()
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  function handleDragStart(colId: string) {
    dragColId.current = colId
  }

  function handleDragOver(e: React.DragEvent, colId: string, colIdx: number) {
    const from = dragColId.current
    if (!from || from === colId || colIdx < FROZEN_COUNT) return
    e.preventDefault()
    setColumnOrder((prev) => {
      const next = [...prev]
      const fromIdx = next.indexOf(from)
      const toIdx = next.indexOf(colId)
      if (fromIdx === -1 || toIdx === -1) return prev
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, from)
      return next
    })
  }

  function handleDragEnd() {
    dragColId.current = null
  }

  return (
    <>
      <div className="grid gap-3 pb-2 lg:hidden">
        <MobileSortControls
          value={mobileSort?.id ?? '__none__'}
          direction={mobileSort?.desc ? 'desc' : 'asc'}
          options={mobileSortOptions}
          onFieldChange={(value) => {
            setSorting(value === '__none__' ? [] : [{ id: value, desc: false }])
          }}
          onDirectionToggle={() => {
            if (mobileSort) setSorting([{ id: mobileSort.id, desc: !mobileSort.desc }])
          }}
          directionDisabled={!mobileSort}
        />
        <MobileReportSummary summary={summary} />
        {table.getRowModel().rows.length === 0 && (
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            Нет данных за выбранный период
          </div>
        )}
        {table.getRowModel().rows.map((row) => {
          const isGroupRow = Boolean(groupBy && row.original.nmId === -1)
          const identityCells = row.getVisibleCells().filter((cell) => IDENTITY_COLUMNS.has(cell.column.id))
          const metricCells = row.getVisibleCells().filter((cell) => !IDENTITY_COLUMNS.has(cell.column.id))
          const primaryCells = metricCells.filter((cell) => MOBILE_PRIMARY_METRICS.has(cell.column.id))
          const remainingCells = metricCells.filter((cell) => !MOBILE_PRIMARY_METRICS.has(cell.column.id))
          const nmCell = identityCells.find((cell) => cell.column.id === 'nmId')

          return (
            <article
              key={row.id}
              className={isGroupRow ? 'rounded-md border bg-secondary p-3' : 'rounded-md border bg-card p-3 shadow-sm'}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">
                    {row.original.vendorCode || row.original.subjectName || (isGroupRow ? 'Группа' : `WB ${row.original.nmId}`)}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {[row.original.subjectName, row.original.brandName].filter(Boolean).join(' · ') || 'Без категории'}
                  </p>
                </div>
                {!isGroupRow && nmCell && (
                  <div className="shrink-0 text-sm font-medium">
                    {flexRender(nmCell.column.columnDef.cell, nmCell.getContext())}
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {primaryCells.map((cell) => (
                  <MobileMetricCell key={cell.id} cell={cell} />
                ))}
              </div>

              {remainingCells.length > 0 && (
                <details className="mt-3 rounded-md border bg-secondary/25">
                  <summary className="flex min-h-11 cursor-pointer select-none items-center px-3 py-2 text-sm font-medium">
                    Все показатели
                  </summary>
                  <div className="grid grid-cols-2 gap-2 border-t p-2">
                    {remainingCells.map((cell) => (
                      <MobileMetricCell key={cell.id} cell={cell} />
                    ))}
                  </div>
                </details>
              )}
            </article>
          )
        })}
      </div>

      <div
        className="hidden h-full min-h-0 rounded-md border bg-card lg:block"
        style={{ overflowX: 'auto', overflowY: 'auto' }}
      >
      {/* border-separate + border-spacing-0 required for sticky columns */}
      <table
        className="text-sm"
        style={{
          width: table.getTotalSize(),
          borderCollapse: 'separate',
          borderSpacing: 0,
        }}
      >
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header, idx) => {
                const isFrozen = idx < FROZEN_COUNT
                const tooltip = header.column.columnDef.meta?.tooltip
                const canSort = header.column.getCanSort()
                const sortDir = header.column.getIsSorted()

                return (
                  <th
                    key={header.id}
                    title={tooltip}
                    draggable={!isFrozen}
                    onDragStart={() => handleDragStart(header.column.id)}
                    onDragOver={(e) => handleDragOver(e, header.column.id, idx)}
                    onDragEnd={handleDragEnd}
                    className={[
                      'relative whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground',
                      'sticky top-0 z-20 border-b border-r bg-secondary select-none',
                      isFrozen ? 'sticky z-30' : '',
                      canSort ? 'cursor-pointer hover:bg-accent/70' : '',
                    ].join(' ')}
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      left: isFrozen ? frozenOffsets[idx] : undefined,
                    }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="shrink-0 text-muted-foreground/60">
                          {sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sortDir === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </span>

                    {/* Resize handle */}
                    {header.column.getCanResize() && (
                      <div
                        className={[
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          'hover:bg-primary/40',
                          header.column.getIsResizing() ? 'bg-primary' : '',
                        ].join(' ')}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          header.getResizeHandler()(e)
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation()
                          header.getResizeHandler()(e)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={visibleLeafColumns.length}
                className="py-12 text-center text-muted-foreground border-b"
              >
                Нет данных. Выберите период и нажмите «Синхронизировать».
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, rowIdx) => {
              const isGroupRow = groupBy && row.original.nmId === -1
              const isSizeRow = row.original.isSizeRow
              // Sticky (frozen) cells use border-t so each row "owns" its top border.
              // Because sticky cells are painted in DOM order (later rows on top),
              // border-b on frozen cells gets covered by the next row's background.
              // border-t on the row below is painted after and stays visible.
              // Skip border-t on the very first data row (header border-b handles it).
              const frozenBorder = rowIdx === 0 ? 'border-r' : 'border-t border-r'

              return (
                <tr
                  key={row.id}
                  className={
                    isGroupRow
                      ? 'bg-secondary font-semibold'
                      : isSizeRow
                        ? 'bg-muted/25 transition-colors hover:bg-secondary/55'
                        : 'transition-colors hover:bg-secondary/55'
                  }
                >
                  {row.getVisibleCells().map((cell, idx) => {
                    const isFrozen = idx < FROZEN_COUNT
                    return (
                      <td
                        key={cell.id}
                        className={[
                          'whitespace-nowrap px-3 py-1.5',
                          isFrozen
                            ? `${frozenBorder} sticky z-10 ${isGroupRow ? 'bg-secondary' : isSizeRow ? 'bg-muted' : 'bg-card'}`
                            : `border-b border-r ${isGroupRow ? 'bg-secondary/80' : isSizeRow ? 'bg-muted/40' : 'bg-card'}`,
                        ].join(' ')}
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          left: isFrozen ? frozenOffsets[idx] : undefined,
                        }}
                      >
                        {/* Group rows: skip nmId cell rendering (shows -1 sentinel) */}
                        {isGroupRow && cell.column.id === 'nmId'
                          ? null
                          : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>

        {table.getRowModel().rows.length > 0 && (
          <tfoot>
            <tr>
              {visibleLeafColumns.map((col, idx) => {
                const isFrozen = idx < FROZEN_COUNT
                const colId = col.id as keyof ReportRow
                const value = summary[colId]

                // nmId column in footer: show "Итого" label instead of 0
                if (col.id === 'nmId') {
                  return (
                    <td
                      key={col.id}
                      className={[
                        'whitespace-nowrap px-3 py-2 border-t border-r font-semibold',
                        isFrozen ? 'sticky bottom-0 z-30 bg-secondary' : 'sticky bottom-0 z-20 bg-secondary',
                      ].join(' ')}
                      style={{
                        width: col.getSize(),
                        minWidth: col.getSize(),
                        left: isFrozen ? frozenOffsets[idx] : undefined,
                      }}
                    >
                      Итого
                    </td>
                  )
                }

                const cellFn = col.columnDef.cell
                const rendered =
                  typeof cellFn === 'function'
                    ? cellFn({
                        getValue: () => value as never,
                        row: { original: summary } as never,
                        column: col as never,
                        table: table as never,
                        cell: undefined as never,
                        renderValue: () => value as never,
                      })
                    : value

                return (
                  <td
                    key={col.id}
                    className={[
                      'whitespace-nowrap px-3 py-2 border-t border-r font-semibold',
                      isFrozen ? 'sticky bottom-0 z-30 bg-secondary' : 'sticky bottom-0 z-20 bg-secondary',
                    ].join(' ')}
                    style={{
                      width: col.getSize(),
                      minWidth: col.getSize(),
                      left: isFrozen ? frozenOffsets[idx] : undefined,
                    }}
                  >
                    {rendered as React.ReactNode}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </>
  )
}

function MobileMetricCell({ cell }: { cell: Cell<ReportRow, unknown> }) {
  const header = cell.column.columnDef.header
  const label = typeof header === 'string' ? header : cell.column.id

  return (
    <div className="min-w-0 rounded-md border bg-background/75 px-2.5 py-2">
      <p className="break-words text-[11px] leading-tight text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold tabular-nums">
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    </div>
  )
}

function MobileReportSummary({ summary }: { summary: ReportRow }) {
  const metrics = [
    ['Продажа', formatMobileRub(summary.sale)],
    ['Операционная прибыль', formatMobileRub(summary.operatingProfit)],
    ['К перечислению', formatMobileRub(summary.toTransfer)],
    ['Выкупы', Number(summary.boughtWithReturns ?? 0).toLocaleString('ru-RU')],
  ]

  return (
    <section className="rounded-md border bg-secondary p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Итого по отчёту</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md border bg-card px-2.5 py-2">
            <p className="break-words text-[11px] leading-tight text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatMobileRub(value: string | number | null | undefined): string {
  const parsed = Number(value ?? 0)
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(parsed) ? parsed : 0)
}
