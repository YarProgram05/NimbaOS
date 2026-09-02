import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 128

const currentPasswordSchema = z
  .string()
  .min(1, 'Введите текущий пароль')
  .max(MAX_PASSWORD_LENGTH, 'Пароль слишком длинный')

export const changeEmailSchema = z.object({
  currentPassword: currentPasswordSchema,
  newEmail: z
    .string()
    .trim()
    .min(1, 'Введите новый email')
    .max(254, 'Email слишком длинный')
    .email('Некорректный email'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Пароль — минимум ${MIN_PASSWORD_LENGTH} символов`)
      .max(MAX_PASSWORD_LENGTH, 'Пароль слишком длинный'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isSessionCurrent(
  user: { isActive: boolean; sessionVersion: number } | null,
  tokenVersion: unknown
): boolean {
  return (
    typeof tokenVersion === 'number' &&
    user?.isActive === true &&
    user.sessionVersion === tokenVersion
  )
}

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
