'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { addWbAccount } from '@/lib/actions/accounts'

const schema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  apiKey: z.string().min(1, 'API-ключ обязателен'),
  taxRate: z.number().min(0, 'Минимум 0%').max(100, 'Максимум 100%'),
})

type FormValues = z.infer<typeof schema>

interface AddAccountDialogProps {
  onSuccess: () => void
}

export function AddAccountDialog({ onSuccess }: AddAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { taxRate: 0 },
  })

  async function onSubmit(values: FormValues) {
    setApiError(null)
    const result = await addWbAccount(values)
    if (result.success) {
      toast.success(`Кабинет "${values.name}" добавлен`)
      reset()
      setOpen(false)
      onSuccess()
    } else {
      setApiError(result.error)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      reset()
      setApiError(null)
      setShowKey(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Добавить кабинет
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить WB кабинет</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-name">Название</Label>
            <Input
              id="account-name"
              placeholder="Мой кабинет"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key">API-ключ Wildberries</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="eyJ..."
                className="pr-10"
                {...register('apiKey')}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.apiKey && (
              <p className="text-sm text-destructive">{errors.apiKey.message}</p>
            )}
            {apiError && (
              <p className="text-sm text-destructive">{apiError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tax-rate">Налоговая ставка %</Label>
            <Input
              id="tax-rate"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="6"
              {...register('taxRate', { valueAsNumber: true })}
            />
            {errors.taxRate && (
              <p className="text-sm text-destructive">{errors.taxRate.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Проверка...' : 'Добавить'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
