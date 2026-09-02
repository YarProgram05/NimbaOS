'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { prisma } from '@/lib/db'
import { decrypt, encrypt } from '@/lib/encryption'
import { removeAllSyncSchedulesForAccount } from '@/lib/sync/schedules'
import { validateAndFetchSellerInfo } from '@/lib/wb-api/accounts'
import { WbApiError } from '@/lib/wb-api/client'
import { extractWbTokenExpiration } from '@/lib/wb-api/token-expiration'
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
  apiKeyExpiresAt: string | null
}

const WB_ACCOUNT_SUMMARY_SELECT = {
  id: true,
  name: true,
  sellerName: true,
  sellerId: true,
  tradeMark: true,
  taxRate: true,
  isActive: true,
  lastSyncAt: true,
  createdAt: true,
} as const

function tokenExpirationIso(apiKey: string): string | null {
  return extractWbTokenExpiration(apiKey)?.toISOString() ?? null
}

function encryptedTokenExpirationIso(encryptedApiKey: string): string | null {
  try {
    return tokenExpirationIso(decrypt(encryptedApiKey))
  } catch {
    return null
  }
}

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

async function requireAdminSession() {
  const session = await requireSession()
  if (!checkRole(session, 'ADMIN')) throw new Error('Недостаточно прав')
  return session
}

export async function getWbAccounts(): Promise<WbAccountSummary[]> {
  await requireSession()

  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { ...WB_ACCOUNT_SUMMARY_SELECT, apiKey: true },
    orderBy: { createdAt: 'asc' },
  })

  return accounts.map(({ apiKey, ...account }) => ({
    ...account,
    taxRate: account.taxRate.toString(),
    apiKeyExpiresAt: encryptedTokenExpirationIso(apiKey),
  }))
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
  const existingAccounts = await prisma.wbAccount.findMany({
    where: { sellerId: sellerInfo.sellerId },
    select: {
      id: true,
      createdAt: true,
      _count: {
        select: {
          products: true,
          realizationReports: true,
          paidStorage: true,
          adCampaigns: true,
          salesPlans: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (existingAccounts.length > 0) {
    const accountScore = (account: (typeof existingAccounts)[number]) =>
      account._count.products
      + account._count.realizationReports
      + account._count.paidStorage
      + account._count.adCampaigns
      + account._count.salesPlans

    const target = existingAccounts.reduce((best, account) => {
      const diff = accountScore(account) - accountScore(best)
      if (diff !== 0) return diff > 0 ? account : best
      return account.createdAt < best.createdAt ? account : best
    })

    const account = await prisma.$transaction(async (tx) => {
      await tx.wbAccount.updateMany({
        where: {
          sellerId: sellerInfo.sellerId,
          id: { not: target.id },
        },
        data: { isActive: false },
      })

      return tx.wbAccount.update({
        where: { id: target.id },
        data: {
          name: data.name.trim(),
          apiKey: encryptedKey,
          taxRate: data.taxRate ?? 0,
          sellerName: sellerInfo.sellerName,
          sellerId: sellerInfo.sellerId,
          tradeMark: sellerInfo.tradeMark ?? null,
          isActive: true,
        },
        select: WB_ACCOUNT_SUMMARY_SELECT,
      })
    })

    await Promise.all(
      existingAccounts
        .filter((existing) => existing.id !== target.id)
        .map((existing) => removeAllSyncSchedulesForAccount(existing.id)),
    )

    revalidatePath('/settings')
    return {
      success: true,
      data: {
        ...account,
        taxRate: account.taxRate.toString(),
        apiKeyExpiresAt: tokenExpirationIso(data.apiKey),
      },
    }
  }

  const account = await prisma.wbAccount.create({
    data: {
      name: data.name.trim(),
      apiKey: encryptedKey,
      taxRate: data.taxRate ?? 0,
      sellerName: sellerInfo.sellerName,
      sellerId: sellerInfo.sellerId,
      tradeMark: sellerInfo.tradeMark ?? null,
    },
    select: WB_ACCOUNT_SUMMARY_SELECT,
  })

  revalidatePath('/settings')
  return {
    success: true,
    data: {
      ...account,
      taxRate: account.taxRate.toString(),
      apiKeyExpiresAt: tokenExpirationIso(data.apiKey),
    },
  }
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

export async function updateWbAccountApiKey(
  id: string,
  apiKey: string,
): Promise<ActionResult<WbAccountSummary>> {
  await requireAdminSession()

  if (!apiKey.trim()) return { success: false, error: 'API-ключ обязателен' }

  const account = await prisma.wbAccount.findUnique({
    where: { id },
    select: { id: true, sellerId: true },
  })
  if (!account) return { success: false, error: 'Кабинет не найден' }

  let sellerInfo: { sellerName: string; sellerId: string; tradeMark?: string }
  try {
    sellerInfo = await validateAndFetchSellerInfo(apiKey)
  } catch (err) {
    if (err instanceof WbApiError) {
      return { success: false, error: `Недействительный API-ключ (${err.status})` }
    }
    return { success: false, error: 'Не удалось подключиться к WB API' }
  }

  if (account.sellerId && sellerInfo.sellerId !== account.sellerId) {
    return { success: false, error: 'API-ключ принадлежит другому продавцу' }
  }

  const updated = await prisma.wbAccount.update({
    where: { id },
    data: {
      apiKey: encrypt(apiKey),
      sellerName: sellerInfo.sellerName,
      sellerId: sellerInfo.sellerId,
      tradeMark: sellerInfo.tradeMark ?? null,
      isActive: true,
    },
    select: WB_ACCOUNT_SUMMARY_SELECT,
  })

  revalidatePath('/settings')
  return {
    success: true,
    data: {
      ...updated,
      taxRate: updated.taxRate.toString(),
      apiKeyExpiresAt: tokenExpirationIso(apiKey),
    },
  }
}

export async function toggleAccountActive(id: string): Promise<ActionResult> {
  await requireSession()

  const account = await prisma.wbAccount.findUnique({
    where: { id },
    select: { isActive: true },
  })
  if (!account) return { success: false, error: 'Кабинет не найден' }

  await prisma.wbAccount.update({ where: { id }, data: { isActive: !account.isActive } })
  if (account.isActive) {
    await removeAllSyncSchedulesForAccount(id)
  }
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
