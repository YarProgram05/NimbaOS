'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateUserProfile } from '@/lib/actions/accounts'

const schema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
})

type FormValues = z.infer<typeof schema>

interface ProfileFormProps {
  defaultName: string
  email: string
}

export function ProfileForm({ defaultName, email }: ProfileFormProps) {
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const result = await updateUserProfile(values.name)
      if (result.success) {
        toast.success('Профиль сохранён')
      } else {
        toast.error(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">Имя</Label>
        <Input id="profile-name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} readOnly disabled />
      </div>
      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </form>
  )
}
