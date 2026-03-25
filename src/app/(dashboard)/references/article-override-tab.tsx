'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { upsertArticleOverride, deleteArticleOverride } from '@/lib/actions/references'
import type { ColumnDef } from '@tanstack/react-table'
import type { ArticleOverrideRow, VendorCodeOption } from '@/types/references'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  vendorCode: z.string().min(1, 'Артикул обязателен'),
  localName: z.string().optional(),
  localColor: z.string().optional(),
  localSize: z.string().optional(),
  localComposition: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ─── Props ───────────────────────────────────────────────────────────────────

interface ArticleOverrideTabProps {
  rows: ArticleOverrideRow[]
  vendorCodes: VendorCodeOption[]
  wbAccountId: string
  onMutate: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function ArticleOverrideTab({
  rows,
  vendorCodes,
  wbAccountId,
  onMutate,
}: ArticleOverrideTabProps) {
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ArticleOverrideRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setPage(1) }, [rows])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ArticleOverrideRow>[]>(() => [
    {
      accessorKey: 'vendorCode',
      header: 'Артикул',
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium">{row.original.vendorCode}</span>,
    },
    {
      accessorKey: 'localName',
      header: 'Локальное название',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={row.original.localName ? '' : 'text-muted-foreground'}>
          {row.original.localName ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'localColor',
      header: 'Цвет',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={row.original.localColor ? '' : 'text-muted-foreground'}>
          {row.original.localColor ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'localSize',
      header: 'Размер',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={row.original.localSize ? '' : 'text-muted-foreground'}>
          {row.original.localSize ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'localComposition',
      header: 'Состав',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={row.original.localComposition ? '' : 'text-muted-foreground'}>
          {row.original.localComposition ?? '—'}
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
    const result = await deleteArticleOverride(deleteTarget)
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

      {/* Add/Edit Dialog (shared with mode flag) */}
      <OverrideDialog
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
            <DialogTitle>Удалить переименование?</DialogTitle>
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

interface OverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wbAccountId: string
  vendorCodes: VendorCodeOption[]
  editTarget: ArticleOverrideRow | null
  onSuccess: () => void
}

function OverrideDialog({
  open,
  onOpenChange,
  wbAccountId,
  vendorCodes,
  editTarget,
  onSuccess,
}: OverrideDialogProps) {
  const isEdit = editTarget !== null

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendorCode: '', localName: '', localColor: '', localSize: '', localComposition: '' },
  })

  useEffect(() => {
    if (editTarget) {
      reset({
        vendorCode: editTarget.vendorCode,
        localName: editTarget.localName ?? '',
        localColor: editTarget.localColor ?? '',
        localSize: editTarget.localSize ?? '',
        localComposition: editTarget.localComposition ?? '',
      })
    } else {
      reset({ vendorCode: '', localName: '', localColor: '', localSize: '', localComposition: '' })
    }
  }, [editTarget, reset])

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    const result = await upsertArticleOverride({ wbAccountId, ...values })
    if (result.success) {
      toast.success(isEdit ? 'Переименование обновлено' : 'Переименование добавлено')
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
          <DialogTitle>{isEdit ? 'Редактировать переименование' : 'Добавить переименование'}</DialogTitle>
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
            <Label htmlFor="or-local-name">Локальное название</Label>
            <Input
              id="or-local-name"
              placeholder="Моё название товара"
              {...register('localName')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="or-local-color">Цвет</Label>
              <Input id="or-local-color" placeholder="Красный" {...register('localColor')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="or-local-size">Размер</Label>
              <Input id="or-local-size" placeholder="XL" {...register('localSize')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="or-local-composition">Состав</Label>
            <Input
              id="or-local-composition"
              placeholder="100% хлопок"
              {...register('localComposition')}
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
