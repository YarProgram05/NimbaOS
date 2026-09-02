'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { signOut } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeOwnEmail, changeOwnPassword } from '@/lib/actions/profile'
import {
  changeEmailSchema,
  changePasswordSchema,
  type ChangeEmailInput,
  type ChangePasswordInput,
} from '@/lib/auth/account-security'

interface SecurityFormsProps {
  currentEmail: string
}

export function SecurityForms({ currentEmail }: SecurityFormsProps) {
  const emailForm = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { currentPassword: '', newEmail: '' },
  })
  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function finishCredentialChange(message: string) {
    toast.success(message)
    await signOut({ callbackUrl: '/login' })
  }

  async function submitEmail(values: ChangeEmailInput) {
    const result = await changeOwnEmail(values)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    await finishCredentialChange('Email изменён. Войдите с новым адресом.')
  }

  async function submitPassword(values: ChangePasswordInput) {
    const result = await changeOwnPassword(values)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    await finishCredentialChange('Пароль изменён. Войдите с новым паролем.')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={emailForm.handleSubmit(submitEmail)} className="space-y-4">
        <div>
          <h3 className="font-medium">Сменить email</h3>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            Текущий адрес: {currentEmail}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-email">Новый email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            inputMode="email"
            spellCheck={false}
            {...emailForm.register('newEmail')}
          />
          {emailForm.formState.errors.newEmail && (
            <p className="text-sm text-destructive">
              {emailForm.formState.errors.newEmail.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-current-password">Текущий пароль</Label>
          <Input
            id="email-current-password"
            type="password"
            autoComplete="current-password"
            {...emailForm.register('currentPassword')}
          />
          {emailForm.formState.errors.currentPassword && (
            <p className="text-sm text-destructive">
              {emailForm.formState.errors.currentPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={emailForm.formState.isSubmitting}>
          {emailForm.formState.isSubmitting ? 'Сохранение...' : 'Сменить email'}
        </Button>
      </form>

      <form onSubmit={passwordForm.handleSubmit(submitPassword)} className="space-y-4">
        <div>
          <h3 className="font-medium">Сменить пароль</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Используйте не менее 12 символов.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password-current">Текущий пароль</Label>
          <Input
            id="password-current"
            type="password"
            autoComplete="current-password"
            {...passwordForm.register('currentPassword')}
          />
          {passwordForm.formState.errors.currentPassword && (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.currentPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">Новый пароль</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...passwordForm.register('newPassword')}
          />
          {passwordForm.formState.errors.newPassword && (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Повторите новый пароль</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            {...passwordForm.register('confirmPassword')}
          />
          {passwordForm.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
          {passwordForm.formState.isSubmitting ? 'Сохранение...' : 'Сменить пароль'}
        </Button>
      </form>
    </div>
  )
}
