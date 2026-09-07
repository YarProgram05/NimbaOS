'use client'

import { useState } from 'react'
import { AlertCircle, Check, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { confirmFbsSheetMappingAction, getFbsSheetMappingReviewAction } from '@/lib/actions/automations'
import type { FbsSheetMappingReview, FbsSheetPendingMapping } from '@/types/fbs-sheet-mappings'

const NEW_GROUP = '__new_physical_group__'

export function FbsMappingReview({ initialReview, canManage, disabled, onBusyChange }: {
  initialReview: FbsSheetMappingReview
  canManage: boolean
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const [review, setReview] = useState(initialReview)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [newNames, setNewNames] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const busy = disabled || busyKey !== null || refreshing

  async function refresh() {
    setRefreshing(true)
    try {
      const result = await getFbsSheetMappingReviewAction()
      if (result.success) setReview(result.data)
      else toast.error(result.error)
    } catch {
      toast.error('Не удалось обновить список товаров')
    } finally { setRefreshing(false) }
  }

  async function confirm(item: FbsSheetPendingMapping) {
    const choice = choices[item.key] ?? item.suggestions[0]?.productName ?? ''
    const mode = choice === NEW_GROUP ? 'new' : 'existing'
    const productName = mode === 'new' ? newNames[item.key]?.trim() ?? '' : choice
    if (!productName) return
    setBusyKey(item.key)
    onBusyChange(true)
    try {
      const result = await confirmFbsSheetMappingAction({
        wbAccountId: item.wbAccountId, nmId: item.nmId, chrtId: item.chrtId, productName, mode,
      })
      if (!result.success) return toast.error(result.error)
      setReview((current) => ({ ...current,
        pending: current.pending.filter((row) => row.key !== result.data.key),
        groups: Array.from(new Set([...current.groups, result.data.productName])).sort((left, right) => left.localeCompare(right, 'ru')),
      }))
      toast.success(`Соответствие «${result.data.productName}» подтверждено. Оно будет использовано при следующей загрузке.`)
    } catch {
      toast.error('Не удалось подтвердить соответствие. Обновите список перед повторной попыткой.')
    } finally { setBusyKey(null); onBusyChange(false) }
  }

  return <Card className={review.pending.length || review.warning ? 'border-amber-300 dark:border-amber-800' : ''}>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-5 w-5" /> Новые товары собственного склада
          <Badge variant="secondary">{review.pending.length}</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
          <RotateCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Проверить товары
        </Button>
      </div>
      <CardDescription>Выберите физический товар, которому соответствует новая карточка WB. Предложения по названию требуют вашего подтверждения.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {review.warning ? <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{review.warning}</p> : null}
      {!review.warning && !review.pending.length ? <p className="text-sm text-muted-foreground">Все обнаруженные FBS-товары уже сопоставлены с учётом.</p> : null}
      {!canManage && review.pending.length ? <p className="text-sm text-muted-foreground">Подтвердить соответствия может менеджер или администратор.</p> : null}
      {review.pending.slice(0, visibleCount).map((item) => {
        const choice = choices[item.key] ?? item.suggestions[0]?.productName ?? ''
        const isNew = choice === NEW_GROUP
        const selectionReady = isNew ? Boolean(newNames[item.key]?.trim()) : Boolean(choice)
        return <div key={item.key} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{item.vendorCode || `Артикул ${item.nmId}`}</p>
              <p className="text-sm text-muted-foreground">{item.accountName}{item.size && item.size !== '0' ? ` · размер ${item.size}` : ''} · остаток WB: {item.wbStock}</p>
              <p className="mt-1 text-xs text-muted-foreground">nmId {item.nmId} · chrtId {item.chrtId}{item.barcode ? ` · штрихкод ${item.barcode}` : ''}</p>
            </div>
          </div>
          {item.suggestions.length ? <div className="space-y-1 text-sm"><p>Возможно, это уже учтённый товар: <span className="font-medium">{item.suggestions.map((suggestion) => suggestion.productName).join('; ')}</span>.</p>
            <p className="text-xs text-muted-foreground">{item.suggestions[0].reason}</p></div>
            : <p className="text-sm text-muted-foreground">Похожий товар не найден. Выберите существующий товар или создайте новое учётное название.</p>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-72">
              <label htmlFor={`mapping-${item.key}`} className="mb-1 block text-sm font-medium">Товар в учёте собственного склада</label>
              <select id={`mapping-${item.key}`} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={choice} disabled={!canManage || busy}
                onChange={(event) => setChoices((current) => ({ ...current, [item.key]: event.target.value }))}>
                <option value="">Выберите товар</option>
                {review.groups.map((group) => <option key={group} value={group}>{group}</option>)}
                <option value={NEW_GROUP}>Новый физический товар…</option>
              </select>
            </div>
            {isNew ? <div className="min-w-0 flex-1 basis-72">
              <label htmlFor={`new-mapping-${item.key}`} className="mb-1 block text-sm font-medium">Точное название нового товара</label>
              <Input id={`new-mapping-${item.key}`} value={newNames[item.key] ?? ''} maxLength={160}
                disabled={!canManage || busy} placeholder="Название для справочника и сводки"
                onChange={(event) => setNewNames((current) => ({ ...current, [item.key]: event.target.value }))} />
            </div> : null}
            <Button disabled={!canManage || busy || !selectionReady} onClick={() => confirm(item)}>
              <Check className="mr-2 h-4 w-4" />{busyKey === item.key ? 'Сохраняем…' : 'Подтвердить соответствие'}
            </Button>
          </div>
          {isNew ? <p className="text-xs text-muted-foreground">Новый товар будет добавлен в справочник при следующей загрузке. Начальный физический остаток вводится отдельно после проверки.</p> : null}
        </div>
      })}
      {review.pending.length > visibleCount ? <Button variant="outline" onClick={() => setVisibleCount((count) => count + 10)}>Показать ещё {Math.min(10, review.pending.length - visibleCount)}</Button> : null}
    </CardContent>
  </Card>
}
