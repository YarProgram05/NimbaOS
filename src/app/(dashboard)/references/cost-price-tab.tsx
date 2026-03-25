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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/shared/data-table'
import { VendorCombobox } from './vendor-combobox'
import { upsertCostPrice, updateCostPrice, deleteCostPrice } from '@/lib/actions/references'
import type { ColumnDef } from '@tanstack/react-table'
import type { CostPriceRow, VendorCodeOption } from '@/types/references'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const addSchema = z.object({
  vendorCode: z.string().min(1, 'Артикул обязателен'),
  costPrice: z.number().positive('Должна быть больше 0'),
})
type AddFormValues = z.infer<typeof addSchema>

const editSchema = z.object({
  costPrice: z.number().positive('Должна быть больше 0'),
})
type EditFormValues = z.infer<typeof editSchema>

// ─── Props ───────────────────────────────────────────────────────────────────

interface CostPriceTabProps {
  rows: CostPriceRow[]
  vendorCodes: VendorCodeOption[]
  wbAccountId: string
  onMutate: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function CostPriceTab({ rows, vendorCodes, wbAccountId, onMutate }: CostPriceTabProps) {
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CostPriceRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setPage(1) }, [rows])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<CostPriceRow>[]>(() => [
    {
      accessorKey: 'vendorCode',
      header: 'Артикул поставщика',
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium">{row.original.vendorCode}</span>,
    },
    {
      accessorKey: 'costPrice',
      header: 'Себестоимость',
      enableSorting: false,
      cell: ({ row }) => (
        <span>
          {Number(row.original.costPrice).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
        </span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Дата обновления',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(row.original.updatedAt), 'dd.MM.yyyy HH:mm')}
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
            className="h-7 w-7"
            onClick={() => setEditTarget(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row.original.id)}
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
    const result = await deleteCostPrice(deleteTarget)
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

      {/* Table */}
      <DataTable columns={columns} data={pagedRows} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
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

      {/* Add Dialog */}
      <AddCostPriceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        wbAccountId={wbAccountId}
        vendorCodes={vendorCodes}
        onSuccess={onMutate}
      />

      {/* Edit Dialog */}
      <EditCostPriceDialog
        target={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
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

// ─── Add Dialog ───────────────────────────────────────────────────────────────

interface AddCostPriceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wbAccountId: string
  vendorCodes: VendorCodeOption[]
  onSuccess: () => void
}

function AddCostPriceDialog({
  open,
  onOpenChange,
  wbAccountId,
  vendorCodes,
  onSuccess,
}: AddCostPriceDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { vendorCode: '', costPrice: 0 },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: AddFormValues) {
    const result = await upsertCostPrice({ wbAccountId, ...values })
    if (result.success) {
      toast.success('Себестоимость сохранена')
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
          <DialogTitle>Добавить себестоимость</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Артикул поставщика</Label>
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
            {errors.vendorCode && (
              <p className="text-sm text-destructive">{errors.vendorCode.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-add-price">Себестоимость (₽)</Label>
            <Input
              id="cp-add-price"
              type="number"
              min={0.01}
              step={0.01}
              placeholder="0.00"
              {...register('costPrice', { valueAsNumber: true })}
            />
            {errors.costPrice && (
              <p className="text-sm text-destructive">{errors.costPrice.message}</p>
            )}
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

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditCostPriceDialogProps {
  target: CostPriceRow | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditCostPriceDialog({ target, onOpenChange, onSuccess }: EditCostPriceDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    if (target) {
      reset({ costPrice: Number(target.costPrice) })
    }
  }, [target, reset])

  async function onSubmit(values: EditFormValues) {
    if (!target) return
    const result = await updateCostPrice(target.id, values.costPrice)
    if (result.success) {
      toast.success('Себестоимость обновлена')
      onOpenChange(false)
      onSuccess()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать себестоимость</DialogTitle>
        </DialogHeader>
        {target && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Артикул поставщика</Label>
              <p className="text-sm font-medium border rounded-md px-3 py-2 bg-muted">
                {target.vendorCode}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-edit-price">Себестоимость (₽)</Label>
              <Input
                id="cp-edit-price"
                type="number"
                min={0.01}
                step={0.01}
                placeholder="0.00"
                {...register('costPrice', { valueAsNumber: true })}
              />
              {errors.costPrice && (
                <p className="text-sm text-destructive">{errors.costPrice.message}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
