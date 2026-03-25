import type { ColumnDef } from '@tanstack/react-table'
import type { ProductRow } from '@/types/products'
import { PriceCell } from './price-cell'

/**
 * Column definitions for the products table.
 * Accepts runtime context (wbAccountId, lastSyncAt) needed by the price cell.
 */
export function getProductColumns(
  wbAccountId: string,
  lastSyncAt: string | null,
): ColumnDef<ProductRow>[] {
  return [
    {
      accessorKey: 'nmId',
      header: 'Арт. WB',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.nmId}</span>
      ),
    },
    {
      accessorKey: 'vendorCode',
      header: 'Арт. поставщика',
      enableSorting: true,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sm">{row.original.vendorCode}</div>
          {row.original.vendorCodeLocal && (
            <div className="text-xs text-muted-foreground">{row.original.vendorCodeLocal}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Наименование',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm line-clamp-2">{row.original.title ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Категория',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.category ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'brand',
      header: 'Бренд',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.brand ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Цена',
      enableSorting: true,
      cell: ({ row }) => (
        <PriceCell
          row={row.original}
          wbAccountId={wbAccountId}
          lastSyncAt={lastSyncAt}
        />
      ),
    },
  ]
}
