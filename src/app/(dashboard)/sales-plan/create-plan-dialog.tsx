'use client'

import { useRef, useState, useTransition } from 'react'
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
  const dialogContentRef = useRef<HTMLDivElement>(null)
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
      <DialogContent
        ref={dialogContentRef}
        className="sm:max-w-[520px]"
        onOpenAutoFocus={(event) => {
          if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            event.preventDefault()
            window.requestAnimationFrame(() => dialogContentRef.current?.focus({ preventScroll: true }))
          }
        }}
      >
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
              className="text-base lg:text-sm"
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
              className="text-base lg:text-sm"
            />
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5">
            <Label>Период</Label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-full min-w-0 sm:w-auto sm:min-w-[250px]"
            />
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
              className="w-32 text-base lg:text-sm"
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
