'use client'

import { useState, useEffect, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Package,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WbArticleLink } from '@/components/wb-article-link'
import {
  getPlanDetailAction,
  updatePlanAction,
  updatePlanItemAction,
  removePlanItemAction,
  addItemsFromStockAction,
} from '@/lib/actions/sales-plan'
import type { SalesPlanDetail, SalesPlanItemRow } from '@/types/sales-plan'
import { AddArticleDialog } from './add-article-dialog'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanDetailClientProps {
  plan: SalesPlanDetail
  accountParam: string
}

type EditField = 'plannedQty' | 'price' | 'buyoutPercent'

type SortCol = 'vendorCode' | 'nmId' | 'category' | 'plannedQty' | 'price' | 'buyoutPercent' | 'salesCount'

// ─── Component ──────────────────────────────────────────────────────────────

export function PlanDetailClient({ plan: initialPlan, accountParam }: PlanDetailClientProps) {
  const router = useRouter()
  const [plan, setPlan] = useState(initialPlan)
  const [isRefreshing, startRefresh] = useTransition()

  // Header inline edit
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerName, setHeaderName] = useState(plan.name)
  const [headerDrr, setHeaderDrr] = useState(plan.drrPercent)
  const [isSavingHeader, startSaveHeader] = useTransition()

  // Items inline edit
  const [editValues, setEditValues] = useState<Record<string, Record<EditField, string>>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // Sort
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [isAddingFromStock, startAddFromStock] = useTransition()

  // ── Init edit values from plan items ────────────────────────────────────
  useEffect(() => {
    setEditValues((prev) => {
      const next: Record<string, Record<EditField, string>> = {}
      for (const item of plan.items) {
        if (dirtyRef.current.has(item.id)) {
          next[item.id] = prev[item.id] ?? {
            plannedQty: String(item.plannedQty),
            price: item.price,
            buyoutPercent: item.buyoutPercent,
          }
        } else {
          next[item.id] = {
            plannedQty: String(item.plannedQty),
            price: item.price,
            buyoutPercent: item.buyoutPercent,
          }
        }
      }
      return next
    })
  }, [plan.items])

  // ── Refresh plan data ───────────────────────────────────────────────────
  function refreshPlan() {
    startRefresh(async () => {
      const result = await getPlanDetailAction(plan.id)
      if (result.success) setPlan(result.data)
    })
  }

  // ── Header save ─────────────────────────────────────────────────────────
  function handleSaveHeader() {
    if (!headerName.trim()) {
      toast.error('Укажите название плана')
      return
    }
    startSaveHeader(async () => {
      const result = await updatePlanAction(plan.id, {
        name: headerName.trim(),
        drrPercent: parseFloat(headerDrr) || 0,
      })
      if (result.success) {
        setEditingHeader(false)
        refreshPlan()
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Item inline edit ────────────────────────────────────────────────────
  function handleFieldChange(itemId: string, field: EditField, value: string, item: SalesPlanItemRow) {
    setEditValues((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { plannedQty: '0', price: '0', buyoutPercent: '0' }), [field]: value },
    }))

    // Check if dirty
    const original = field === 'plannedQty' ? String(item.plannedQty) : item[field]
    setDirty((prev) => {
      const next = new Set(prev)
      const curValues = {
        ...(editValues[itemId] ?? { plannedQty: String(item.plannedQty), price: item.price, buyoutPercent: item.buyoutPercent }),
        [field]: value,
      }
      const isDirty =
        curValues.plannedQty !== String(item.plannedQty) ||
        curValues.price !== item.price ||
        curValues.buyoutPercent !== item.buyoutPercent
      if (isDirty) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  async function handleSaveItem(item: SalesPlanItemRow) {
    const vals = editValues[item.id]
    if (!vals) return
    const plannedQty = parseInt(vals.plannedQty) || 0
    const price = parseFloat(vals.price) || 0
    const buyoutPercent = parseFloat(vals.buyoutPercent) || 0

    setSaving((prev) => new Set(prev).add(item.id))
    const result = await updatePlanItemAction(item.id, { plannedQty, price, buyoutPercent })
    setSaving((prev) => { const n = new Set(prev); n.delete(item.id); return n })

    if (result.success) {
      setDirty((prev) => { const n = new Set(prev); n.delete(item.id); return n })
      refreshPlan()
    } else {
      toast.error(result.error)
    }
  }

  // ── Remove item ─────────────────────────────────────────────────────────
  async function handleRemoveItem(itemId: string) {
    const result = await removePlanItemAction(itemId)
    if (result.success) {
      refreshPlan()
    } else {
      toast.error(result.error)
    }
  }

  // ── Add from stock ──────────────────────────────────────────────────────
  function handleAddFromStock() {
    startAddFromStock(async () => {
      const result = await addItemsFromStockAction(plan.id, plan.wbAccountId)
      if (result.success) {
        toast.success(`Добавлено: ${result.data.added} артикулов`)
        refreshPlan()
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Sort ────────────────────────────────────────────────────────────────
  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortCol) return plan.items
    return [...plan.items].sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      switch (sortCol) {
        case 'vendorCode': va = a.vendorCode; vb = b.vendorCode; break
        case 'nmId': va = a.nmId; vb = b.nmId; break
        case 'category': va = a.category ?? ''; vb = b.category ?? ''; break
        case 'plannedQty': va = a.plannedQty; vb = b.plannedQty; break
        case 'price': va = parseFloat(a.price); vb = parseFloat(b.price); break
        case 'buyoutPercent': va = parseFloat(a.buyoutPercent); vb = parseFloat(b.buyoutPercent); break
        case 'salesCount': va = a.salesCount ?? -1; vb = b.salesCount ?? -1; break
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [plan.items, sortCol, sortDir])

  // ── Sort icon ───────────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40 shrink-0" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 shrink-0" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 shrink-0" />
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const dateLabel = `${format(new Date(plan.dateFrom), 'd MMM yyyy', { locale: ru })} — ${format(new Date(plan.dateTo), 'd MMM yyyy', { locale: ru })}`

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 -ml-2"
        onClick={() => router.push(`/sales-plan?account=${accountParam}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        К списку планов
      </Button>

      {/* Plan header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {editingHeader ? (
            <div className="flex items-center gap-2">
              <Input
                value={headerName}
                onChange={(e) => setHeaderName(e.target.value)}
                className="h-9 w-64 text-lg font-bold"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveHeader()}
              />
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">ДРР</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={headerDrr}
                  onChange={(e) => setHeaderDrr(e.target.value)}
                  className="h-9 w-20"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveHeader()}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button size="sm" onClick={handleSaveHeader} disabled={isSavingHeader}>
                {isSavingHeader ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingHeader(false); setHeaderName(plan.name); setHeaderDrr(plan.drrPercent) }}>
                Отмена
              </Button>
            </div>
          ) : (
            <>
              <h1
                className="text-2xl font-bold tracking-tight cursor-pointer hover:text-foreground/80"
                onClick={() => setEditingHeader(true)}
                title="Нажмите для редактирования"
              >
                {plan.name}
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{dateLabel}</span>
                <span>ДРР {plan.drrPercent}%</span>
                <span>{plan.items.length} артикулов</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={isAddingFromStock}>
              <Plus className="h-4 w-4" />
              Добавить артикулы
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleAddFromStock} disabled={isAddingFromStock}>
              <Package className="h-4 w-4 mr-2" />
              {isAddingFromStock ? 'Добавление...' : 'Из остатков (все товары)'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              По-отдельности
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Items table */}
      {plan.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Нет артикулов</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Добавьте артикулы для планирования продаж.
          </p>
          <Button onClick={handleAddFromStock} variant="outline" className="gap-2" disabled={isAddingFromStock}>
            <Plus className="h-4 w-4" />
            Добавить из остатков
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('vendorCode')}>
                  <span className="flex items-center">Артикул поставщика <SortIcon col="vendorCode" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('nmId')}>
                  <span className="flex items-center">Арт. ВБ <SortIcon col="nmId" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('category')}>
                  <span className="flex items-center">Категория <SortIcon col="category" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('plannedQty')}>
                  <span className="flex items-center">План, шт. <SortIcon col="plannedQty" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('price')}>
                  <span className="flex items-center">Цена <SortIcon col="price" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('salesCount')}>
                  <span className="flex items-center" title="Кол-во продаж (выкупов) за прошлый календарный месяц из WB">Продажи, шт. <SortIcon col="salesCount" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('buyoutPercent')}>
                  <span className="flex items-center">Выкуп, % <SortIcon col="buyoutPercent" /></span>
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const vals = editValues[item.id] ?? { plannedQty: String(item.plannedQty), price: item.price, buyoutPercent: item.buyoutPercent }
                const isDirty = dirty.has(item.id)
                const isSaving = saving.has(item.id)

                return (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{item.vendorCode}</td>
                    <td className="px-4 py-2.5">
                      <WbArticleLink nmId={item.nmId} photoUrl={item.photoUrl} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.category ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        value={vals.plannedQty}
                        onChange={(e) => handleFieldChange(item.id, 'plannedQty', e.target.value, item)}
                        onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSaveItem(item)}
                        className="h-9 w-24"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={vals.price}
                        onChange={(e) => handleFieldChange(item.id, 'price', e.target.value, item)}
                        onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSaveItem(item)}
                        className="h-9 w-28"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {item.salesCount != null ? item.salesCount : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={vals.buyoutPercent}
                          onChange={(e) => handleFieldChange(item.id, 'buyoutPercent', e.target.value, item)}
                          onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSaveItem(item)}
                          className="h-9 w-20"
                        />
                        {/* Save checkmark */}
                        <button
                          onClick={() => isDirty && !isSaving && handleSaveItem(item)}
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
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        title="Удалить артикул"
                        className="flex items-center justify-center h-9 w-9 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddArticleDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        planId={plan.id}
        wbAccountId={plan.wbAccountId}
        existingNmIds={plan.items.map((i) => i.nmId)}
        onAdded={refreshPlan}
      />
    </div>
  )
}
