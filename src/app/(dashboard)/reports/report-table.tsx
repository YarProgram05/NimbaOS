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
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
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
    <div
      className="h-full min-h-0 rounded-md border bg-card"
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
  )
}
