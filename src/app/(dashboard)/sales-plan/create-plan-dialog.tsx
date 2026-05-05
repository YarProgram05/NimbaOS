'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateRangePicker } from '@/components/date-range-picker'
import { createPlanAction } from '@/lib/actions/sales-plan'

interface CreatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wbAccountId: string
}

export function CreatePlanDialog({ open, onOpenChange, wbAccountId }: CreatePlanDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [drrPercent, setDrrPercent] = useState('')

  function resetForm() {
    setName('')
    setDescription('')
    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })
    setDrrPercent('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Укажите название плана')
      return
    }
    if (!dateRange.from || !dateRange.to) {
      toast.error('Укажите период')
      return
    }

    const drrValue = parseFloat(drrPercent) || 0

    startTransition(async () => {
      const result = await createPlanAction({
        wbAccountId,
        name: name.trim(),
        description: description.trim() || undefined,
        dateFrom: format(dateRange.from!, 'yyyy-MM-dd'),
        dateTo: format(dateRange.to!, 'yyyy-MM-dd'),
        drrPercent: drrValue,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('План создан')
      resetForm()
      onOpenChange(false)
      router.push(`/sales-plan/${result.data.id}?account=${wbAccountId}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Создать план продаж</DialogTitle>
          <DialogDescription>
            Укажите название, период и целевой ДРР для нового плана.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Название</Label>
            <Input
              id="plan-name"
              placeholder="Например: Март 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-description">Описание (необязательно)</Label>
            <Textarea
              id="plan-description"
              placeholder="Комментарий к плану..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Период</Label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-drr">Целевой ДРР, %</Label>
            <Input
              id="plan-drr"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="0"
              value={drrPercent}
              onChange={(e) => setDrrPercent(e.target.value)}
              className="w-32"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
