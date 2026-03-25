import type { ColumnDef } from '@tanstack/react-table'
import type { ProductRow } from '@/types/products'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
      cell: ({ row }) => {
        const nmId = row.original.nmId
        const photoUrl = row.original.photoUrl
        return (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`https://www.wildberries.ru/catalog/${nmId}/detail.aspx`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-base font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {nmId}
                </a>
              </TooltipTrigger>
              {photoUrl && (
                <TooltipContent side="right" className="p-1">
                  <img
                    src={photoUrl}
                    alt="Фото товара"
                    className="h-40 w-auto rounded object-contain"
                  />
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: 'vendorCode',
      header: 'Арт. поставщика',
      enableSorting: true,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-base">{row.original.vendorCode}</div>
          {row.original.vendorCodeLocal && (
            <div className="text-sm text-muted-foreground">{row.original.vendorCodeLocal}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Категория',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-base text-muted-foreground">{row.original.category ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'brand',
      header: 'Бренд',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-base">{row.original.brand ?? '—'}</span>
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
