'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WbArticleLink } from '@/components/wb-article-link'
import {
  searchProductsForPlanAction,
  addPlanItemsAction,
  type ProductSearchRow,
} from '@/lib/actions/sales-plan'

interface AddArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  wbAccountId: string
  existingNmIds: number[]
  onAdded: () => void
}

export function AddArticleDialog({
  open,
  onOpenChange,
  planId,
  wbAccountId,
  existingNmIds,
  onAdded,
}: AddArticleDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSearchRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isSearching, startSearch] = useTransition()
  const [isAdding, startAdd] = useTransition()

  const existingSet = new Set(existingNmIds)

  function handleSearch() {
    if (!query.trim()) return
    startSearch(async () => {
      const result = await searchProductsForPlanAction(wbAccountId, query.trim())
      if (result.success) {
        setResults(result.data)
        if (!result.data.length) toast.info('Ничего не найдено')
      } else {
        toast.error(result.error)
      }
    })
  }

  function toggleSelect(nmId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(nmId)) next.delete(nmId)
      else next.add(nmId)
      return next
    })
  }

  function handleAdd() {
    if (!selected.size) return
    const items = results
      .filter((r) => selected.has(r.nmId))
      .map((r) => ({
        nmId: r.nmId,
        vendorCode: r.vendorCode,
        plannedQty: 0,
        price: 0,
        buyoutPercent: 0,
      }))

    startAdd(async () => {
      const result = await addPlanItemsAction(planId, items)
      if (result.success) {
        toast.success(`Добавлено: ${result.data.added} артикулов`)
        setQuery('')
        setResults([])
        setSelected(new Set())
        onOpenChange(false)
        onAdded()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleClose(v: boolean) {
    if (!v) {
      setQuery('')
      setResults([])
      setSelected(new Set())
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[80vh] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Добавить артикулы</DialogTitle>
          <DialogDescription>
            Поиск по артикулу ВБ (число) или артикулу поставщика.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Введите артикул..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-11"
            autoFocus
          />
          <Button onClick={handleSearch} disabled={isSearching} variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Найти артикул">
            {isSearching ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <div className="divide-y md:hidden">
              {results.map((item) => {
                const alreadyExists = existingSet.has(item.nmId)
                const isSelected = selected.has(item.nmId)
                return (
                  <div
                    key={item.nmId}
                    className={`flex min-h-14 items-center gap-3 p-3 ${alreadyExists ? 'opacity-50' : 'cursor-pointer active:bg-muted/50'}`}
                    onClick={() => !alreadyExists && toggleSelect(item.nmId)}
                  >
                    <label
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.nmId)}
                        disabled={alreadyExists}
                        className="h-5 w-5 cursor-pointer disabled:cursor-default"
                        aria-label={`Выбрать артикул ${item.vendorCode}`}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.vendorCode}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.category ?? 'Категория не указана'}</p>
                    </div>
                    <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                      <WbArticleLink nmId={item.nmId} photoUrl={item.photoUrl} />
                    </div>
                    {alreadyExists && <span className="shrink-0 text-[11px] text-muted-foreground">В плане</span>}
                  </div>
                )
              })}
            </div>

            <table className="hidden w-full md:table">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-left text-sm font-medium">Артикул ВБ</th>
                  <th className="px-3 py-2 text-left text-sm font-medium">Артикул поставщика</th>
                  <th className="px-3 py-2 text-left text-sm font-medium">Категория</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => {
                  const alreadyExists = existingSet.has(item.nmId)
                  const isSelected = selected.has(item.nmId)
                  return (
                    <tr
                      key={item.nmId}
                      className={`border-t hover:bg-muted/30 ${alreadyExists ? 'opacity-40' : 'cursor-pointer'}`}
                      onClick={() => !alreadyExists && toggleSelect(item.nmId)}
                    >
                      <td className="px-3 py-2 text-center">
                        {alreadyExists ? (
                          <span className="text-xs text-muted-foreground">в плане</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.nmId)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <WbArticleLink nmId={item.nmId} photoUrl={item.photoUrl} />
                      </td>
                      <td className="px-3 py-2 font-medium">{item.vendorCode}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.category ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <span className="text-sm text-muted-foreground">
              Выбрано: {selected.size}
            </span>
            <Button onClick={handleAdd} disabled={isAdding} className="min-h-11 gap-2 sm:min-h-9">
              <Plus className="h-4 w-4" />
              {isAdding ? 'Добавление...' : 'Добавить'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
