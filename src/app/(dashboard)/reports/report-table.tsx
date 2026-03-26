'use client'

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type VisibilityState,
} from '@tanstack/react-table'
import type { ReportRow } from '@/types/reports'
import { reportColumns } from './columns'

interface ReportTableProps {
  rows: ReportRow[]
  summary: ReportRow
  columnVisibility: VisibilityState
}

const FROZEN_COUNT = 3 // nmId, subjectName, vendorCode

export function ReportTable({ rows, summary, columnVisibility }: ReportTableProps) {
  const table = useReactTable({
    data: rows,
    columns: reportColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
  })

  const visibleLeafColumns = table.getVisibleLeafColumns()

  // Cumulative left offsets for frozen columns (using actual column sizes)
  const frozenOffsets: number[] = []
  let offset = 0
  for (let i = 0; i < Math.min(FROZEN_COUNT, visibleLeafColumns.length); i++) {
    frozenOffsets.push(offset)
    offset += visibleLeafColumns[i].getSize()
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      {/* border-separate + border-spacing-0 is required for sticky columns to work correctly */}
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
                return (
                  <th
                    key={header.id}
                    title={tooltip}
                    className={[
                      'relative whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground',
                      'border-b border-r bg-muted select-none',
                      isFrozen ? 'sticky z-30' : '',
                    ].join(' ')}
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      left: isFrozen ? frozenOffsets[idx] : undefined,
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}

                    {/* Resize handle */}
                    {header.column.getCanResize() && (
                      <div
                        className={[
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          'hover:bg-primary/40',
                          header.column.getIsResizing() ? 'bg-primary' : '',
                        ].join(' ')}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
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
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map((cell, idx) => {
                  const isFrozen = idx < FROZEN_COUNT
                  return (
                    <td
                      key={cell.id}
                      className={[
                        'whitespace-nowrap px-3 py-1.5 border-b border-r',
                        isFrozen ? 'sticky z-10 bg-card' : 'bg-background',
                      ].join(' ')}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        left: isFrozen ? frozenOffsets[idx] : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>

        {table.getRowModel().rows.length > 0 && (
          <tfoot className="sticky bottom-0 z-20">
            <tr>
              {visibleLeafColumns.map((col, idx) => {
                const isFrozen = idx < FROZEN_COUNT
                const cellFn = col.columnDef.cell
                const value = summary[col.id as keyof ReportRow]
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
