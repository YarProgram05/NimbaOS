'use client'

import { useState, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type VisibilityState,
  type SortingState,
  type ColumnOrderState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { ReportRow } from '@/types/reports'
import { reportColumns } from './columns'

const LS_KEY = 'nimba_report_column_order'
const DEFAULT_ORDER = reportColumns.map((c) => c.id as string)

function loadColumnOrder(): ColumnOrderState {
  if (typeof window === 'undefined') return DEFAULT_ORDER
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (!saved) return DEFAULT_ORDER
    const parsed: string[] = JSON.parse(saved)
    // Validate: must contain all current columns (handles new columns added after save)
    const allPresent = DEFAULT_ORDER.every((id) => parsed.includes(id))
    if (!allPresent) return DEFAULT_ORDER
    return parsed
  } catch {
    return DEFAULT_ORDER
  }
}

interface ReportTableProps {
  rows: ReportRow[]
  summary: ReportRow
  columnVisibility: VisibilityState
  groupBy?: string
  groupSummaries?: Map<string, ReportRow>
}

const FROZEN_COUNT = 3 // nmId, subjectName, vendorCode

export function ReportTable({ rows, summary, columnVisibility, groupBy }: ReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(loadColumnOrder)

  // Persist column order changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(columnOrder))
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }, [columnOrder])

  // Drag-and-drop state
  const dragColId = useRef<string | null>(null)

  const table = useReactTable({
    data: rows,
    columns: reportColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { columnVisibility, sorting, columnOrder },
    onSortingChange: setSorting,
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

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault()
    const from = dragColId.current
    if (!from || from === colId) return
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
      className="rounded-md border"
      style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}
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
        <thead className="sticky top-0 z-20">
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
                    onDragOver={(e) => handleDragOver(e, header.column.id)}
                    onDragEnd={handleDragEnd}
                    className={[
                      'relative whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground',
                      'border-b border-r bg-muted select-none',
                      isFrozen ? 'sticky z-30' : '',
                      canSort ? 'cursor-pointer hover:bg-muted/80' : '',
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
                      ? 'bg-muted/60 font-semibold'
                      : 'hover:bg-muted/30 transition-colors'
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
                            ? `${frozenBorder} sticky z-10 ${isGroupRow ? 'bg-muted/60' : 'bg-card'}`
                            : `border-b border-r ${isGroupRow ? 'bg-muted/40' : 'bg-background'}`,
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
          <tfoot className="sticky bottom-0 z-20">
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
                        isFrozen ? 'sticky z-30 bg-muted' : 'bg-muted',
                      ].join(' ')}
                      style={{
                        width: col.getSize(),
                        minWidth: col.getSize(),
                        left: isFrozen ? frozenOffsets[idx] : undefined,
                      }}
                    />
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
                      isFrozen ? 'sticky z-30 bg-muted' : 'bg-muted',
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
