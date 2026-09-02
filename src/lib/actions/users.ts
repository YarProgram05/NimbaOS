'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkRole } from '@/lib/auth/check-role'
import { MIN_PASSWORD_LENGTH, normalizeEmail } from '@/lib/auth/account-security'
import type { ActionResult, UserRole } from '@/types'

export async function createInvitation(
  role: UserRole
): Promise<ActionResult<{ inviteUrl: string }>> {
  const session = await getServerSession(authOptions)
  if (!checkRole(session, 'ADMIN')) return { success: false, error: 'Недостаточно прав' }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      role,
      createdById: session!.user.id,
      expiresAt,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return {
    success: true,
    data: { inviteUrl: `${baseUrl}/register?token=${invitation.token}` },
  }
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!checkRole(session, 'ADMIN')) return { success: false, error: 'Недостаточно прав' }
  if (userId === session!.user.id) return { success: false, error: 'Нельзя изменить свою роль' }

  await prisma.user.update({ where: { id: userId }, data: { role } })
  revalidatePath('/admin/users')
  return { success: true, data: undefined }
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!checkRole(session, 'ADMIN')) return { success: false, error: 'Недостаточно прав' }
  if (userId === session!.user.id) return { success: false, error: 'Нельзя деактивировать себя' }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  })
  if (!user) return { success: false, error: 'Пользователь не найден' }

  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } })
  revalidatePath('/admin/users')
  return { success: true, data: undefined }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!checkRole(session, 'ADMIN')) return { success: false, error: 'Недостаточно прав' }
  if (userId === session!.user.id) return { success: false, error: 'Нельзя удалить себя' }

  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/admin/users')
  return { success: true, data: undefined }
}

export async function registerByInvitation(
  token: string,
  data: { name: string; email: string; password: string }
): Promise<ActionResult> {
  const invitation = await prisma.invitation.findUnique({ where: { token } })
  if (!invitation || invitation.usedById || invitation.expiresAt < new Date()) {
    return { success: false, error: 'Приглашение недействительно или истекло' }
  }

  const email = normalizeEmail(data.email)
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: 'Некорректный email' }
  }
  if (data.password.length < MIN_PASSWORD_LENGTH || data.password.length > 128) {
    return {
      success: false,
      error: `Пароль должен содержать от ${MIN_PASSWORD_LENGTH} до 128 символов`,
    }
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (existing) return { success: false, error: 'Email уже используется' }

  const passwordHash = await bcrypt.hash(data.password, 12)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        role: invitation.role,
        invitedById: invitation.createdById,
      },
    })
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedById: user.id },
    })
  })

  return { success: true, data: undefined }
}
