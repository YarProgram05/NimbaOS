'use client'

import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VendorCombobox } from './vendor-combobox'
import {
  createArticleVersion,
  deleteArticleVersion,
  updateArticleVersion,
} from '@/lib/actions/references'
import type { ArticleVersionRow, VendorCodeOption } from '@/types/references'

const schema = z.object({
  vendorCodeSource: z.string().min(1, 'Артикул обязателен'),
  dateFrom: z.string().min(1, 'Дата начала обязательна'),
  dateTo: z.string().optional(),
  versionName: z.string().min(1, 'Название версии обязательно'),
  costPrice: z.string().optional(),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ArticleVersionTabProps {
  rows: ArticleVersionRow[]
  vendorCodes: VendorCodeOption[]
  wbAccountId: string
  onMutate: () => void
}

const PAGE_SIZE = 100

export function ArticleVersionTab({
  rows,
  vendorCodes,
  wbAccountId,
  onMutate,
}: ArticleVersionTabProps) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ArticleVersionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ArticleVersionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => setPage(1), [rows, query])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ru-RU')
    if (!q) return rows
    return rows.filter((row) =>
      row.vendorCode.toLocaleLowerCase('ru-RU').includes(q) ||
      (row.currentVendorCode ?? '').toLocaleLowerCase('ru-RU').includes(q) ||
      String(row.nmId).includes(q),
    )
  }, [rows, query])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteArticleVersion(deleteTarget.id)
    setDeleting(false)
    if (result.success) {
      toast.success('Версия удалена')
      setDeleteTarget(null)
      onMutate()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Артикул, версия или WB..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 w-64"
        />
        <div className="flex-1" />
        <span className="text-muted-foreground">
          Всего:{' '}
          <span className="font-medium text-foreground">{filtered.length}</span>
          {filtered.length !== rows.length && ` из ${rows.length}`}
        </span>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Текущий артикул</th>
              <th className="px-4 py-3 text-left font-medium">Артикул WB</th>
              <th className="px-4 py-3 text-left font-medium">Версия в отчете</th>
              <th className="px-4 py-3 text-left font-medium">Период</th>
              <th className="px-4 py-3 text-left font-medium">Себестоимость</th>
              <th className="px-4 py-3 text-left font-medium">Примечание</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {rows.length === 0 ? 'Версий пока нет' : 'Ничего не найдено'}
                </td>
              </tr>
            )}
            {pagedRows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{row.currentVendorCode ?? '—'}</div>
                  {row.title && <div className="text-xs text-muted-foreground">{row.title}</div>}
                </td>
                <td className="px-4 py-2.5">{row.nmId}</td>
                <td className="px-4 py-2.5 font-medium">{row.vendorCode}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {formatDate(row.dateFrom)} — {row.dateTo ? formatDate(row.dateTo) : 'сейчас'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {row.costPrice ? `${formatMoney(row.costPrice)} ₽` : 'из справочника'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.note ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditTarget(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Назад
          </Button>
          <span className="text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Вперёд
          </Button>
        </div>
      )}

      <ArticleVersionDialog
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

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить версию?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Финансовые отчеты снова будут использовать обычное название и себестоимость для этого периода.
          </p>
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

interface ArticleVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wbAccountId: string
  vendorCodes: VendorCodeOption[]
  editTarget: ArticleVersionRow | null
  onSuccess: () => void
}

function ArticleVersionDialog({
  open,
  onOpenChange,
  wbAccountId,
  vendorCodes,
  editTarget,
  onSuccess,
}: ArticleVersionDialogProps) {
  const isEdit = editTarget !== null
  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vendorCodeSource: '',
      dateFrom: '',
      dateTo: '',
      versionName: '',
      costPrice: '',
      note: '',
    },
  })

  const source = watch('vendorCodeSource')
  const selected = vendorCodes.find((option) => option.vendorCode === source)

  useEffect(() => {
    if (editTarget) {
      reset({
        vendorCodeSource: editTarget.currentVendorCode ?? '',
        dateFrom: editTarget.dateFrom,
        dateTo: editTarget.dateTo ?? '',
        versionName: editTarget.vendorCode,
        costPrice: editTarget.costPrice ?? '',
        note: editTarget.note ?? '',
      })
    } else {
      reset({ vendorCodeSource: '', dateFrom: '', dateTo: '', versionName: '', costPrice: '', note: '' })
    }
  }, [editTarget, reset])

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    const costPrice = values.costPrice?.trim() ? Number(values.costPrice) : null
    const dateTo = values.dateTo?.trim() || null

    const result = isEdit
      ? await updateArticleVersion({
        id: editTarget.id,
        dateFrom: values.dateFrom,
        dateTo,
        vendorCode: values.versionName,
        costPrice,
        note: values.note,
      })
      : await createArticleVersion({
        wbAccountId,
        nmId: selected?.nmId ?? 0,
        dateFrom: values.dateFrom,
        dateTo,
        vendorCode: values.versionName,
        costPrice,
        note: values.note,
      })

    if (result.success) {
      toast.success(isEdit ? 'Версия обновлена' : 'Версия добавлена')
      handleClose()
      onSuccess()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать версию артикула' : 'Добавить версию артикула'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Товар</Label>
            {isEdit ? (
              <p className="text-sm font-medium border rounded-md px-3 py-2 bg-muted">
                {editTarget.currentVendorCode ?? editTarget.nmId}
              </p>
            ) : (
              <Controller
                name="vendorCodeSource"
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
            {errors.vendorCodeSource && <p className="text-sm text-destructive">{errors.vendorCodeSource.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="article-version-name">Название версии в отчетах</Label>
            <Input id="article-version-name" placeholder="парео синяя разводы" {...register('versionName')} />
            {errors.versionName && <p className="text-sm text-destructive">{errors.versionName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="article-version-from">С даты</Label>
              <Input id="article-version-from" type="date" {...register('dateFrom')} />
              {errors.dateFrom && <p className="text-sm text-destructive">{errors.dateFrom.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="article-version-to">По дату</Label>
              <Input id="article-version-to" type="date" {...register('dateTo')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="article-version-cost">Себестоимость версии</Label>
            <Input id="article-version-cost" type="number" min={0} step={0.01} placeholder="оставить пустым = из справочника" {...register('costPrice')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="article-version-note">Примечание</Label>
            <Input id="article-version-note" placeholder="Новый принт, другая модель..." {...register('note')} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Отмена</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function formatMoney(value: string): string {
  return Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
