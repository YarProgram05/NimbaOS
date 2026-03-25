'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { validateAndFetchSellerInfo } from '@/lib/wb-api/accounts'
import { WbApiError } from '@/lib/wb-api/client'
import type { ActionResult } from '@/types'

export interface WbAccountSummary {
  id: string
  name: string
  sellerName: string | null
  sellerId: string | null
  tradeMark: string | null
  taxRate: string // Decimal serializes as string
  isActive: boolean
  lastSyncAt: Date | null
  createdAt: Date
}

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

export async function getWbAccounts(): Promise<WbAccountSummary[]> {
  await requireSession()

  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sellerName: true,
      sellerId: true,
      tradeMark: true,
      taxRate: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return accounts.map((a) => ({ ...a, taxRate: a.taxRate.toString() }))
}

export async function addWbAccount(data: {
  name: string
  apiKey: string
  taxRate?: number
}): Promise<ActionResult<WbAccountSummary>> {
  await requireSession()

  if (!data.name.trim()) return { success: false, error: 'Название обязательно' }
  if (!data.apiKey.trim()) return { success: false, error: 'API-ключ обязателен' }
  if (data.taxRate !== undefined && (data.taxRate < 0 || data.taxRate > 100)) {
    return { success: false, error: 'Налоговая ставка должна быть от 0 до 100%' }
  }

  let sellerInfo: { sellerName: string; sellerId: string; tradeMark?: string }
  try {
    sellerInfo = await validateAndFetchSellerInfo(data.apiKey)
  } catch (err) {
    if (err instanceof WbApiError) {
      return { success: false, error: `Недействительный API-ключ (${err.status})` }
    }
    return { success: false, error: 'Не удалось подключиться к WB API' }
  }

  const encryptedKey = encrypt(data.apiKey)

  const account = await prisma.wbAccount.create({
    data: {
      name: data.name.trim(),
      apiKey: encryptedKey,
      taxRate: data.taxRate ?? 0,
      sellerName: sellerInfo.sellerName,
      sellerId: sellerInfo.sellerId,
      tradeMark: sellerInfo.tradeMark ?? null,
    },
    select: {
      id: true,
      name: true,
      sellerName: true,
      sellerId: true,
      tradeMark: true,
      taxRate: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
    },
  })

  revalidatePath('/settings')
  return { success: true, data: { ...account, taxRate: account.taxRate.toString() } }
}

export async function updateTaxRate(
  id: string,
  taxRate: number
): Promise<ActionResult> {
  await requireSession()

  if (taxRate < 0 || taxRate > 100) {
    return { success: false, error: 'Ставка должна быть от 0 до 100%' }
  }

  const exists = await prisma.wbAccount.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Кабинет не найден' }

  await prisma.wbAccount.update({ where: { id }, data: { taxRate } })
  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function toggleAccountActive(id: string): Promise<ActionResult> {
  await requireSession()

  const account = await prisma.wbAccount.findUnique({
    where: { id },
    select: { isActive: true },
  })
  if (!account) return { success: false, error: 'Кабинет не найден' }

  await prisma.wbAccount.update({ where: { id }, data: { isActive: !account.isActive } })
  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function updateUserProfile(name: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { success: false, error: 'Не авторизован' }

  if (!name.trim()) return { success: false, error: 'Имя обязательно' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  })
  revalidatePath('/settings')
  return { success: true, data: undefined }
}
