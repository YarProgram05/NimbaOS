'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/shared/data-table'
import { VendorCombobox } from './vendor-combobox'
import { createExternalAd, updateExternalAd, deleteExternalAd } from '@/lib/actions/references'
import type { ColumnDef } from '@tanstack/react-table'
import type { ExternalAdRow, VendorCodeOption } from '@/types/references'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  vendorCode: z.string().optional(),
  date: z.string().min(1, 'Дата обязательна'),
  amount: z.number().positive('Должна быть больше 0'),
  source: z.string().optional(),
  note: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ─── Props ───────────────────────────────────────────────────────────────────

interface ExternalAdTabProps {
  rows: ExternalAdRow[]
  vendorCodes: VendorCodeOption[]
  wbAccountId: string
  onMutate: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 100

export function ExternalAdTab({
  rows,
  vendorCodes,
  wbAccountId,
  onMutate,
}: ExternalAdTabProps) {
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ExternalAdRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setPage(1) }, [rows])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ExternalAdRow>[]>(() => [
    {
      accessorKey: 'date',
      header: 'Дата',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm">{format(new Date(row.original.date), 'dd.MM.yyyy')}</span>
      ),
    },
    {
      accessorKey: 'vendorCode',
      header: 'Артикул',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.vendorCode ? (
          <span className="font-medium">{row.original.vendorCode}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'amount',
      header: 'Сумма',
      enableSorting: false,
      cell: ({ row }) => (
        <span>
          {Number(row.original.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
        </span>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Источник',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={row.original.source ? '' : 'text-muted-foreground'}>
          {row.original.source ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'note',
      header: 'Заметка',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {row.original.note ?? '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-7 md:w-7"
            onClick={() => setEditTarget(row.original)}
            aria-label="Редактировать внешнюю рекламу"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive hover:text-destructive md:h-7 md:w-7"
            onClick={() => setDeleteTarget(row.original.id)}
            aria-label="Удалить внешнюю рекламу"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [])

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteExternalAd(deleteTarget)
    setDeleting(false)
    if (result.success) {
      toast.success('Запись удалена')
      setDeleteTarget(null)
      onMutate()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Итого: <span className="font-medium text-foreground">{rows.length}</span>
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {pagedRows.map((row) => (
          <article key={row.id} className="space-y-3 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{format(new Date(row.date), 'dd.MM.yyyy')}</p>
              <p className="font-semibold tabular-nums">{Number(row.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</p>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Артикул</dt><dd className="break-words">{row.vendorCode ?? '—'}</dd>
              <dt className="text-muted-foreground">Источник</dt><dd className="break-words">{row.source ?? '—'}</dd>
              <dt className="text-muted-foreground">Заметка</dt><dd className="whitespace-pre-wrap break-words">{row.note ?? '—'}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setEditTarget(row)}><Pencil className="mr-2 h-4 w-4" />Изменить</Button>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row.id)}><Trash2 className="mr-2 h-4 w-4" />Удалить</Button>
            </div>
          </article>
        ))}
        {pagedRows.length === 0 && <p className="rounded-md border py-8 text-center text-sm text-muted-foreground">Нет данных</p>}
      </div>
      <div className="hidden md:block"><DataTable columns={columns} data={pagedRows} /></div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <ExternalAdDialog
        open={addOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false)
            setEditTarget(null)
          }
        }}
        wbAccountId={wbAccountId}
        vendorCodes={vendorCodes}
        editTarget={editTarget}
        onSuccess={onMutate}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить запись?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Это действие необратимо.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Add/Edit Dialog ──────────────────────────────────────────────────────────

interface ExternalAdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wbAccountId: string
  vendorCodes: VendorCodeOption[]
  editTarget: ExternalAdRow | null
  onSuccess: () => void
}

function ExternalAdDialog({
  open,
  onOpenChange,
  wbAccountId,
  vendorCodes,
  editTarget,
  onSuccess,
}: ExternalAdDialogProps) {
  const isEdit = editTarget !== null

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendorCode: '', date: '', amount: 0, source: '', note: '' },
  })

  useEffect(() => {
    if (editTarget) {
      reset({
        vendorCode: editTarget.vendorCode ?? '',
        date: editTarget.date,
        amount: Number(editTarget.amount),
        source: editTarget.source ?? '',
        note: editTarget.note ?? '',
      })
    } else {
      reset({ vendorCode: '', date: '', amount: 0, source: '', note: '' })
    }
  }, [editTarget, reset])

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    const result = isEdit
      ? await updateExternalAd(editTarget.id, values)
      : await createExternalAd({ wbAccountId, ...values })

    if (result.success) {
      toast.success(isEdit ? 'Запись обновлена' : 'Запись добавлена')
      reset()
      onOpenChange(false)
      onSuccess()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать внешнюю рекламу' : 'Добавить внешнюю рекламу'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ea-date">Дата</Label>
              <Input
                id="ea-date"
                type="date"
                {...register('date')}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ea-amount">Сумма (₽)</Label>
              <Input
                id="ea-amount"
                type="number"
                min={0.01}
                step={0.01}
                placeholder="0.00"
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Артикул поставщика (необязательно)</Label>
            <Controller
              name="vendorCode"
              control={control}
              render={({ field }) => (
                <VendorCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  vendorCodes={vendorCodes}
                  placeholder="Выберите артикул (необязательно)..."
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ea-source">Источник</Label>
            <Input
              id="ea-source"
              placeholder="Telegram, Instagram..."
              {...register('source')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ea-note">Заметка (необязательно)</Label>
            <Textarea
              id="ea-note"
              placeholder="Дополнительная информация..."
              rows={2}
              {...register('note')}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
