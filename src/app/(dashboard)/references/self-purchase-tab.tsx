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
import { createSelfPurchase, updateSelfPurchase, deleteSelfPurchase } from '@/lib/actions/references'
import type { ColumnDef } from '@tanstack/react-table'
import type { SelfPurchaseRow, VendorCodeOption } from '@/types/references'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  vendorCode: z.string().min(1, 'Артикул обязателен'),
  date: z.string().min(1, 'Дата обязательна'),
  quantity: z.number().int().positive('Должно быть больше 0'),
  amount: z.number().positive('Должна быть больше 0'),
  cashback: z.number().nonnegative('Не может быть отрицательным').optional(),
  note: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ─── Props ───────────────────────────────────────────────────────────────────

interface SelfPurchaseTabProps {
  rows: SelfPurchaseRow[]
  vendorCodes: VendorCodeOption[]
  wbAccountId: string
  onMutate: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 100

export function SelfPurchaseTab({
  rows,
  vendorCodes,
  wbAccountId,
  onMutate,
}: SelfPurchaseTabProps) {
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SelfPurchaseRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setPage(1) }, [rows])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<SelfPurchaseRow>[]>(() => [
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
      cell: ({ row }) => <span className="font-medium">{row.original.vendorCode}</span>,
    },
    {
      accessorKey: 'quantity',
      header: 'Кол-во',
      enableSorting: false,
      cell: ({ row }) => <span className="text-right block">{row.original.quantity}</span>,
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
      accessorKey: 'cashback',
      header: 'Кэшбек раздач',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.cashback != null ? (
          <span>
            {Number(row.original.cashback).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
            aria-label={`Редактировать самовыкуп ${row.original.vendorCode}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive hover:text-destructive md:h-7 md:w-7"
            onClick={() => setDeleteTarget(row.original.id)}
            aria-label={`Удалить самовыкуп ${row.original.vendorCode}`}
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
    const result = await deleteSelfPurchase(deleteTarget)
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
              <p className="break-words font-medium">{row.vendorCode}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(row.date), 'dd.MM.yyyy')}</p>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Количество</dt><dd>{row.quantity}</dd>
              <dt className="text-muted-foreground">Сумма</dt><dd>{Number(row.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</dd>
              <dt className="text-muted-foreground">Кэшбек</dt><dd>{row.cashback != null ? `${Number(row.cashback).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽` : '—'}</dd>
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
      <SelfPurchaseDialog
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
            <DialogTitle>Удалить самовыкуп?</DialogTitle>
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

interface SelfPurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wbAccountId: string
  vendorCodes: VendorCodeOption[]
  editTarget: SelfPurchaseRow | null
  onSuccess: () => void
}

function SelfPurchaseDialog({
  open,
  onOpenChange,
  wbAccountId,
  vendorCodes,
  editTarget,
  onSuccess,
}: SelfPurchaseDialogProps) {
  const isEdit = editTarget !== null

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendorCode: '', date: '', quantity: 1, amount: 0, cashback: undefined, note: '' },
  })

  useEffect(() => {
    if (editTarget) {
      reset({
        vendorCode: editTarget.vendorCode,
        date: editTarget.date,
        quantity: editTarget.quantity,
        amount: Number(editTarget.amount),
        cashback: editTarget.cashback != null ? Number(editTarget.cashback) : undefined,
        note: editTarget.note ?? '',
      })
    } else {
      reset({ vendorCode: '', date: '', quantity: 1, amount: 0, cashback: undefined, note: '' })
    }
  }, [editTarget, reset])

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    const result = isEdit
      ? await updateSelfPurchase(editTarget.id, values)
      : await createSelfPurchase({ wbAccountId, ...values })

    if (result.success) {
      toast.success(isEdit ? 'Самовыкуп обновлён' : 'Самовыкуп добавлен')
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
          <DialogTitle>{isEdit ? 'Редактировать самовыкуп' : 'Добавить самовыкуп'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Артикул поставщика</Label>
            {isEdit ? (
              <p className="text-sm font-medium border rounded-md px-3 py-2 bg-muted">
                {editTarget.vendorCode}
              </p>
            ) : (
              <Controller
                name="vendorCode"
                control={control}
                render={({ field }) => (
                  <VendorCombobox
                    value={field.value}
                    onChange={field.onChange}
                    vendorCodes={vendorCodes}
                  />
                )}
              />
            )}
            {errors.vendorCode && (
              <p className="text-sm text-destructive">{errors.vendorCode.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-date">Дата</Label>
            <Input
              id="sp-date"
              type="date"
              {...register('date')}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-quantity">Количество</Label>
              <Input
                id="sp-quantity"
                type="number"
                min={1}
                step={1}
                placeholder="1"
                {...register('quantity', { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-amount">Сумма (₽)</Label>
              <Input
                id="sp-amount"
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
            <Label htmlFor="sp-cashback">Кэшбек раздач (₽, необязательно)</Label>
            <Input
              id="sp-cashback"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              {...register('cashback', { valueAsNumber: true })}
            />
            {errors.cashback && (
              <p className="text-sm text-destructive">{errors.cashback.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-note">Заметка (необязательно)</Label>
            <Textarea
              id="sp-note"
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
