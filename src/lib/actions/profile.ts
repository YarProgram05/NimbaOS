'use server'

import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  changeEmailSchema,
  changePasswordSchema,
  normalizeEmail,
  type ChangeEmailInput,
  type ChangePasswordInput,
} from '@/lib/auth/account-security'
import { prisma } from '@/lib/db'
import type { ActionResult } from '@/types'

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
    },
  })
}

export async function changeOwnEmail(input: ChangeEmailInput): Promise<ActionResult> {
  const parsed = changeEmailSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }
  }

  const user = await getCurrentUser()
  if (!user?.isActive) return { success: false, error: 'Не авторизован' }

  const passwordIsValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!passwordIsValid) return { success: false, error: 'Неверный текущий пароль' }

  const newEmail = normalizeEmail(parsed.data.newEmail)
  if (normalizeEmail(user.email) === newEmail) {
    return { success: false, error: 'Укажите другой email' }
  }

  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: newEmail, mode: 'insensitive' },
      id: { not: user.id },
    },
    select: { id: true },
  })
  if (existing) return { success: false, error: 'Email уже используется' }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        sessionVersion: { increment: 1 },
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Email уже используется' }
    }
    throw error
  }

  return { success: true, data: undefined }
}

export async function changeOwnPassword(input: ChangePasswordInput): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }
  }

  const user = await getCurrentUser()
  if (!user?.isActive) return { success: false, error: 'Не авторизован' }

  const passwordIsValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!passwordIsValid) return { success: false, error: 'Неверный текущий пароль' }

  const passwordIsReused = await bcrypt.compare(parsed.data.newPassword, user.passwordHash)
  if (passwordIsReused) {
    return { success: false, error: 'Новый пароль должен отличаться от текущего' }
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
  })

  return { success: true, data: undefined }
}
