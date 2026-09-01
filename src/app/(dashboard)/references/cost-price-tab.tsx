'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Check, Download, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertCostPrice, exportCostPriceTemplate, bulkUpsertCostPrices } from '@/lib/actions/references'
import { WbArticleLink } from '@/components/wb-article-link'
import { MobileSortControls } from '@/components/mobile-sort-controls'
import type { CostPriceItem } from '@/types/references'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CostPriceTabProps {
  items: CostPriceItem[]
  wbAccountId: string
  onMutate: () => void
}

type SortCol = 'vendorCode' | 'nmId' | 'category' | 'costPrice' | 'updatedAt'

const PAGE_SIZE = 100
const COST_SORT_OPTIONS = [
  { value: '__none__', label: 'Без сортировки' },
  { value: 'vendorCode', label: 'Артикул продавца' },
  { value: 'nmId', label: 'Артикул ВБ' },
  { value: 'category', label: 'Категория' },
  { value: 'costPrice', label: 'Себестоимость' },
  { value: 'updatedAt', label: 'Дата' },
] as const

// ─── Component ───────────────────────────────────────────────────────────────

export function CostPriceTab({ items, wbAccountId, onMutate }: CostPriceTabProps) {
  const [searchVendor, setSearchVendor] = useState('')
  const [searchNmId, setSearchNmId] = useState('')
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  // Inline editing state
  const [editValues, setEditValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.vendorCode, i.costPrice ?? ''])),
  )
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const importRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // Sync editValues from items for non-dirty rows when items refresh
  useEffect(() => {
    setEditValues((prev) => {
      const next = { ...prev }
      for (const item of items) {
        if (!dirtyRef.current.has(item.vendorCode)) {
          next[item.vendorCode] = item.costPrice ?? ''
        }
      }
      return next
    })
  }, [items])

  // Reset page on filter/sort change
  useEffect(() => { setPage(1) }, [searchVendor, searchNmId, sortCol, sortDir])

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    let result = items
    if (searchVendor.trim()) {
      const q = searchVendor.toLowerCase()
      result = result.filter((i) => i.vendorCode.toLowerCase().includes(q))
    }
    if (searchNmId.trim()) {
      result = result.filter((i) => String(i.nmId ?? '').includes(searchNmId.trim()))
    }
    if (!sortCol) return result
    return [...result].sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      switch (sortCol) {
        case 'vendorCode': va = a.vendorCode; vb = b.vendorCode; break
        case 'nmId': va = a.nmId ?? 0; vb = b.nmId ?? 0; break
        case 'category': va = a.category ?? ''; vb = b.category ?? ''; break
        case 'costPrice': va = parseFloat(a.costPrice ?? '0'); vb = parseFloat(b.costPrice ?? '0'); break
        case 'updatedAt': va = a.updatedAt ?? ''; vb = b.updatedAt ?? ''; break
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, searchVendor, searchNmId, sortCol, sortDir])

  const totalPages = Math.ceil(filteredSorted.length / PAGE_SIZE)
  const pagedItems = filteredSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function handleEdit(vendorCode: string, value: string, originalCostPrice: string | null) {
    setEditValues((prev) => ({ ...prev, [vendorCode]: value }))
    const newNum = parseFloat(value) || 0
    const origNum = parseFloat(originalCostPrice ?? '0') || 0
    setDirty((prev) => {
      const next = new Set(prev)
      if (newNum > 0 && newNum !== origNum) {
        next.add(vendorCode)
      } else {
        next.delete(vendorCode)
      }
      return next
    })
  }

  async function handleSave(item: CostPriceItem) {
    const value = parseFloat(editValues[item.vendorCode] ?? '0')
    if (!value || value <= 0) {
      toast.error('Введите корректную себестоимость (больше 0)')
      return
    }
    setSaving((prev) => new Set(prev).add(item.vendorCode))
    const result = await upsertCostPrice({ wbAccountId, vendorCode: item.vendorCode, costPrice: value })
    setSaving((prev) => { const next = new Set(prev); next.delete(item.vendorCode); return next })
    if (result.success) {
      setDirty((prev) => { const next = new Set(prev); next.delete(item.vendorCode); return next })
      onMutate()
    } else {
      toast.error(result.error)
    }
  }

  async function handleExportTemplate() {
    setExporting(true)
    const result = await exportCostPriceTemplate(wbAccountId)
    setExporting(false)
    if (result.success) {
      const buf = Buffer.from(result.data.base64, 'base64')
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.data.filename
      a.click()
      URL.revokeObjectURL(url)
    } else {
      toast.error(result.error)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const { read, utils } = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json<Record<string, unknown>>(ws)

      const parsed: { vendorCode: string; costPrice: number }[] = []
      for (const row of rows) {
        const vendorCode = String(row['Артикул продавца'] ?? '').trim()
        const costPrice = parseFloat(String(row['Себестоимость'] ?? ''))
        if (vendorCode && !isNaN(costPrice) && costPrice > 0) {
          parsed.push({ vendorCode, costPrice })
        }
      }

      if (!parsed.length) {
        toast.error('Не найдено корректных строк в файле')
        setImporting(false)
        return
      }

      const result = await bulkUpsertCostPrices(wbAccountId, parsed)
      setImporting(false)
      if (result.success) {
        toast.success(`Обновлено: ${result.data.updated} артикулов`)
        onMutate()
      } else {
        toast.error(result.error)
      }
    } catch {
      setImporting(false)
      toast.error('Ошибка чтения файла')
    }
  }

  // ── Sort icon ──────────────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40 shrink-0" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 shrink-0" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 shrink-0" />
  }

  return (
    <div className="space-y-3">
      {/* Search + actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Артикул продавца..."
          value={searchVendor}
          onChange={(e) => setSearchVendor(e.target.value)}
          className="h-10 w-full sm:h-9 sm:w-56"
        />
        <Input
          placeholder="Артикул ВБ..."
          value={searchNmId}
          onChange={(e) => setSearchNmId(e.target.value)}
          className="h-10 w-full sm:h-9 sm:w-40"
        />
        <div className="hidden flex-1 sm:block" />
        <span className="w-full text-sm text-muted-foreground sm:w-auto">
          Всего:{' '}
          <span className="font-medium text-foreground">{filteredSorted.length}</span>
          {filteredSorted.length !== items.length && ` из ${items.length}`}
        </span>
        <Button className="w-full sm:w-auto" variant="outline" onClick={handleExportTemplate} disabled={exporting}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? 'Подготовка...' : 'Скачать шаблон'}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          disabled={importing}
          onClick={() => importRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          {importing ? 'Загрузка...' : 'Загрузить .xlsx'}
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      <MobileSortControls
        value={sortCol ?? '__none__'}
        direction={sortDir}
        options={COST_SORT_OPTIONS}
        onFieldChange={(value) => {
          if (value === '__none__') {
            setSortCol(null)
            return
          }
          handleSort(value as SortCol)
        }}
        onDirectionToggle={() => {
          if (sortCol) handleSort(sortCol)
        }}
        directionDisabled={!sortCol}
        className="lg:hidden"
      />

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {pagedItems.length === 0 && (
          <div className="rounded-md border px-4 py-10 text-center text-muted-foreground">
            {items.length === 0 ? 'Нет товаров в кабинете' : 'Ничего не найдено'}
          </div>
        )}
        {pagedItems.map((item) => {
          const isDirty = dirty.has(item.vendorCode)
          const isSaving = saving.has(item.vendorCode)
          return (
            <article key={item.vendorCode} className="space-y-3 rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{item.vendorCode}</p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.category ?? 'Категория не указана'}</p>
                </div>
                {item.nmId ? <WbArticleLink nmId={item.nmId} photoUrl={item.photoUrl} /> : <span>—</span>}
              </div>
              <div>
                <label htmlFor={`mobile-cost-${item.vendorCode}`} className="mb-1 block text-sm font-medium">Себестоимость</label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`mobile-cost-${item.vendorCode}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={editValues[item.vendorCode] ?? ''}
                    onChange={(event) => handleEdit(item.vendorCode, event.target.value, item.costPrice)}
                    onKeyDown={(event) => event.key === 'Enter' && isDirty && handleSave(item)}
                    placeholder="0.00"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={isSaving || !isDirty}
                    onClick={() => isDirty && !isSaving && handleSave(item)}
                    aria-label={`Сохранить себестоимость ${item.vendorCode}`}
                    className="h-11 w-11 shrink-0"
                  >
                    {isSaving
                      ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      : <Check className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Обновлено: {item.updatedAt ? format(new Date(item.updatedAt), 'dd.MM.yyyy') : '—'}
              </p>
            </article>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border lg:block">
        <table className="min-w-[720px] w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                onClick={() => handleSort('vendorCode')}
              >
                <span className="flex items-center">
                  Артикул продавца <SortIcon col="vendorCode" />
                </span>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                onClick={() => handleSort('nmId')}
              >
                <span className="flex items-center">
                  Артикул ВБ <SortIcon col="nmId" />
                </span>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                onClick={() => handleSort('category')}
              >
                <span className="flex items-center">
                  Категория <SortIcon col="category" />
                </span>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                onClick={() => handleSort('costPrice')}
              >
                <span className="flex items-center">
                  Себестоимость <SortIcon col="costPrice" />
                </span>
              </th>
              <th
                className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                onClick={() => handleSort('updatedAt')}
              >
                <span className="flex items-center">
                  Дата <SortIcon col="updatedAt" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {items.length === 0 ? 'Нет товаров в кабинете' : 'Ничего не найдено'}
                </td>
              </tr>
            )}
            {pagedItems.map((item) => {
              const isDirty = dirty.has(item.vendorCode)
              const isSaving = saving.has(item.vendorCode)
              return (
                <tr key={item.vendorCode} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.vendorCode}</td>
                  <td className="px-4 py-2.5">
                    {item.nmId ? (
                      <WbArticleLink nmId={item.nmId} photoUrl={item.photoUrl} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.category ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editValues[item.vendorCode] ?? ''}
                        onChange={(e) =>
                          handleEdit(item.vendorCode, e.target.value, item.costPrice)
                        }
                        onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSave(item)}
                        className="h-9 w-32"
                        placeholder="0.00"
                      />
                      <button
                        onClick={() => isDirty && !isSaving && handleSave(item)}
                        disabled={isSaving || !isDirty}
                        title={isDirty ? 'Сохранить' : ''}
                        className={`flex items-center justify-center h-9 w-9 rounded transition-colors ${
                          isDirty
                            ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-950 cursor-pointer'
                            : 'text-muted-foreground/30 cursor-default'
                        }`}
                      >
                        {isSaving ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {item.updatedAt ? format(new Date(item.updatedAt), 'dd.MM.yyyy') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </Button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  )
}
