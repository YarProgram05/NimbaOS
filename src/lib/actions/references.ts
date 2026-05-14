'use server'

import * as XLSX from 'xlsx'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { ActionResult } from '@/types'
import type {
  CostPriceRow,
  CostPriceItem,
  SelfPurchaseRow,
  ExternalAdRow,
  ArticleOverrideRow,
  ReplyTemplateGroupRow,
  ReplyTemplateRow,
  VendorCodeOption,
} from '@/types/references'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

function serializeDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const DEFAULT_REPLY_GROUPS = ['1 звезда', '2 звезды', '3 звезды', '4 звезды', '5 звезд']

function mapReplyTemplate(row: {
  id: string
  groupId: string
  title: string
  text: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): ReplyTemplateRow {
  return {
    id: row.id,
    groupId: row.groupId,
    title: row.title,
    text: row.text,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapReplyTemplateGroup(row: {
  id: string
  wbAccountId: string
  name: string
  sortOrder: number
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  templates: Array<{
    id: string
    groupId: string
    title: string
    text: string
    sortOrder: number
    createdAt: Date
    updatedAt: Date
  }>
}): ReplyTemplateGroupRow {
  return {
    id: row.id,
    wbAccountId: row.wbAccountId,
    name: row.name,
    sortOrder: row.sortOrder,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    templates: row.templates.map(mapReplyTemplate),
  }
}

async function ensureDefaultReplyTemplateGroups(wbAccountId: string) {
  await prisma.$transaction(
    DEFAULT_REPLY_GROUPS.map((name, index) =>
      prisma.replyTemplateGroup.upsert({
        where: { wbAccountId_name: { wbAccountId, name } },
        create: {
          wbAccountId,
          name,
          sortOrder: index + 1,
          isDefault: true,
        },
        update: {
          isDefault: true,
          sortOrder: index + 1,
        },
      }),
    ),
  )
}

// ─── Read Actions ───────────────────────────────────────────────────────────

export async function getCostPrices(wbAccountId: string): Promise<CostPriceRow[]> {
  await requireSession()

  const rows = await prisma.costPrice.findMany({
    where: { wbAccountId },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.map((r) => ({
    id: r.id,
    wbAccountId: r.wbAccountId,
    vendorCode: r.vendorCode,
    costPrice: r.costPrice.toString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function getSelfPurchases(wbAccountId: string): Promise<SelfPurchaseRow[]> {
  await requireSession()

  const rows = await prisma.selfPurchase.findMany({
    where: { wbAccountId },
    orderBy: { date: 'desc' },
  })

  return rows.map((r) => ({
    id: r.id,
    wbAccountId: r.wbAccountId,
    vendorCode: r.vendorCode,
    date: serializeDate(r.date),
    quantity: r.quantity,
    amount: r.amount.toString(),
    cashback: r.cashback?.toString() ?? null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getExternalAds(wbAccountId: string): Promise<ExternalAdRow[]> {
  await requireSession()

  const rows = await prisma.externalAd.findMany({
    where: { wbAccountId },
    orderBy: { date: 'desc' },
  })

  return rows.map((r) => ({
    id: r.id,
    wbAccountId: r.wbAccountId,
    vendorCode: r.vendorCode,
    date: serializeDate(r.date),
    amount: r.amount.toString(),
    source: r.source,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getArticleOverrides(wbAccountId: string): Promise<ArticleOverrideRow[]> {
  await requireSession()

  const rows = await prisma.articleOverride.findMany({
    where: { wbAccountId },
    orderBy: { vendorCode: 'asc' },
  })

  return rows.map((r) => ({
    id: r.id,
    wbAccountId: r.wbAccountId,
    vendorCode: r.vendorCode,
    localName: r.localName,
    localColor: r.localColor,
    localSize: r.localSize,
    localComposition: r.localComposition,
  }))
}

export async function getVendorCodes(wbAccountId: string): Promise<VendorCodeOption[]> {
  await requireSession()

  const rows = await prisma.product.findMany({
    where: { wbAccountId },
    select: { vendorCode: true, title: true },
    distinct: ['vendorCode'],
    orderBy: { vendorCode: 'asc' },
  })

  return rows.map((r) => ({ vendorCode: r.vendorCode, title: r.title }))
}

export async function getReplyTemplateGroups(wbAccountId: string): Promise<ReplyTemplateGroupRow[]> {
  await requireSession()
  await ensureDefaultReplyTemplateGroups(wbAccountId)

  const rows = await prisma.replyTemplateGroup.findMany({
    where: { wbAccountId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      templates: {
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      },
    },
  })

  return rows.map(mapReplyTemplateGroup)
}

export async function createReplyTemplateGroup(data: {
  wbAccountId: string
  name: string
}): Promise<ActionResult<ReplyTemplateGroupRow>> {
  await requireSession()
  const name = data.name.trim()
  if (!name) return { success: false, error: 'Название группы обязательно' }

  const maxOrder = await prisma.replyTemplateGroup.aggregate({
    where: { wbAccountId: data.wbAccountId },
    _max: { sortOrder: true },
  })

  try {
    const row = await prisma.replyTemplateGroup.create({
      data: {
        wbAccountId: data.wbAccountId,
        name,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: { templates: true },
    })
    revalidatePath('/references')
    return { success: true, data: mapReplyTemplateGroup(row) }
  } catch {
    return { success: false, error: 'Группа с таким названием уже есть' }
  }
}

export async function updateReplyTemplateGroup(data: {
  id: string
  name: string
}): Promise<ActionResult<ReplyTemplateGroupRow>> {
  await requireSession()
  const name = data.name.trim()
  if (!name) return { success: false, error: 'Название группы обязательно' }

  try {
    const row = await prisma.replyTemplateGroup.update({
      where: { id: data.id },
      data: { name },
      include: { templates: true },
    })
    revalidatePath('/references')
    revalidatePath('/reviews')
    return { success: true, data: mapReplyTemplateGroup(row) }
  } catch {
    return { success: false, error: 'Не удалось обновить группу' }
  }
}

export async function deleteReplyTemplateGroup(id: string): Promise<ActionResult> {
  await requireSession()
  const exists = await prisma.replyTemplateGroup.findUnique({ where: { id }, select: { id: true, isDefault: true } })
  if (!exists) return { success: false, error: 'Группа не найдена' }
  if (exists.isDefault) return { success: false, error: 'Дефолтную группу нельзя удалить' }

  await prisma.replyTemplateGroup.delete({ where: { id } })
  revalidatePath('/references')
  revalidatePath('/reviews')
  return { success: true, data: undefined }
}

export async function createReplyTemplate(data: {
  groupId: string
  title: string
  text: string
}): Promise<ActionResult<ReplyTemplateRow>> {
  await requireSession()
  const title = data.title.trim()
  const text = data.text.trim()
  if (!title) return { success: false, error: 'Название шаблона обязательно' }
  if (text.length < 2) return { success: false, error: 'Текст ответа должен быть не короче 2 символов' }
  if (text.length > 5000) return { success: false, error: 'Текст ответа должен быть не длиннее 5000 символов' }

  const maxOrder = await prisma.replyTemplate.aggregate({
    where: { groupId: data.groupId },
    _max: { sortOrder: true },
  })

  const row = await prisma.replyTemplate.create({
    data: {
      groupId: data.groupId,
      title,
      text,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })

  revalidatePath('/references')
  revalidatePath('/reviews')
  return { success: true, data: mapReplyTemplate(row) }
}

export async function updateReplyTemplate(data: {
  id: string
  title: string
  text: string
}): Promise<ActionResult<ReplyTemplateRow>> {
  await requireSession()
  const title = data.title.trim()
  const text = data.text.trim()
  if (!title) return { success: false, error: 'Название шаблона обязательно' }
  if (text.length < 2) return { success: false, error: 'Текст ответа должен быть не короче 2 символов' }
  if (text.length > 5000) return { success: false, error: 'Текст ответа должен быть не длиннее 5000 символов' }

  const row = await prisma.replyTemplate.update({
    where: { id: data.id },
    data: { title, text },
  })

  revalidatePath('/references')
  revalidatePath('/reviews')
  return { success: true, data: mapReplyTemplate(row) }
}

export async function deleteReplyTemplate(id: string): Promise<ActionResult> {
  await requireSession()
  const exists = await prisma.replyTemplate.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Шаблон не найден' }

  await prisma.replyTemplate.delete({ where: { id } })
  revalidatePath('/references')
  revalidatePath('/reviews')
  return { success: true, data: undefined }
}

export async function getCostPriceItems(wbAccountId: string): Promise<CostPriceItem[]> {
  await requireSession()

  const [products, prices] = await Promise.all([
    prisma.product.findMany({
      where: { wbAccountId },
      select: { vendorCode: true, nmId: true, category: true, photoUrl: true, title: true },
      distinct: ['vendorCode'],
      orderBy: { vendorCode: 'asc' },
    }),
    prisma.costPrice.findMany({ where: { wbAccountId } }),
  ])

  const priceMap = new Map(prices.map((p) => [p.vendorCode, p]))

  return products.map((p) => {
    const price = priceMap.get(p.vendorCode)
    return {
      id: price?.id ?? null,
      wbAccountId,
      vendorCode: p.vendorCode,
      nmId: p.nmId,
      category: p.category ?? null,
      photoUrl: p.photoUrl ?? null,
      title: p.title ?? null,
      costPrice: price?.costPrice.toString() ?? null,
      updatedAt: price?.updatedAt.toISOString() ?? null,
    }
  })
}

export async function bulkUpsertCostPrices(
  wbAccountId: string,
  items: { vendorCode: string; costPrice: number }[],
): Promise<ActionResult<{ updated: number }>> {
  await requireSession()

  const valid = items.filter((i) => i.vendorCode.trim() && i.costPrice > 0)
  if (!valid.length) return { success: true, data: { updated: 0 } }

  await prisma.$transaction(
    valid.map((item) =>
      prisma.costPrice.upsert({
        where: { wbAccountId_vendorCode: { wbAccountId, vendorCode: item.vendorCode } },
        create: { wbAccountId, vendorCode: item.vendorCode, costPrice: item.costPrice },
        update: { costPrice: item.costPrice },
      }),
    ),
  )

  revalidatePath('/references')
  return { success: true, data: { updated: valid.length } }
}

export async function exportCostPriceTemplate(
  wbAccountId: string,
): Promise<ActionResult<{ base64: string; filename: string }>> {
  await requireSession()

  const items = await getCostPriceItems(wbAccountId)

  const headers = ['Артикул продавца', 'Артикул ВБ', 'Категория', 'Себестоимость']
  const data = items.map((item) => [
    item.vendorCode,
    item.nmId ?? '',
    item.category ?? '',
    item.costPrice ? parseFloat(item.costPrice) : '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = [{ width: 30 }, { width: 15 }, { width: 20 }, { width: 15 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Себестоимость')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const base64 = Buffer.from(buf).toString('base64')
  const filename = `cost_price_${new Date().toISOString().slice(0, 10)}.xlsx`

  return { success: true, data: { base64, filename } }
}

// ─── CostPrice Mutations ────────────────────────────────────────────────────

export async function upsertCostPrice(data: {
  wbAccountId: string
  vendorCode: string
  costPrice: number
}): Promise<ActionResult<CostPriceRow>> {
  await requireSession()

  if (!data.vendorCode.trim()) return { success: false, error: 'Артикул обязателен' }
  if (data.costPrice <= 0) return { success: false, error: 'Себестоимость должна быть больше 0' }

  const row = await prisma.costPrice.upsert({
    where: {
      wbAccountId_vendorCode: {
        wbAccountId: data.wbAccountId,
        vendorCode: data.vendorCode,
      },
    },
    create: {
      wbAccountId: data.wbAccountId,
      vendorCode: data.vendorCode,
      costPrice: data.costPrice,
    },
    update: { costPrice: data.costPrice },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      costPrice: row.costPrice.toString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  }
}

export async function updateCostPrice(
  id: string,
  costPrice: number,
): Promise<ActionResult<CostPriceRow>> {
  await requireSession()

  if (costPrice <= 0) return { success: false, error: 'Себестоимость должна быть больше 0' }

  const exists = await prisma.costPrice.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  const row = await prisma.costPrice.update({
    where: { id },
    data: { costPrice },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      costPrice: row.costPrice.toString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  }
}

export async function deleteCostPrice(id: string): Promise<ActionResult> {
  await requireSession()

  const exists = await prisma.costPrice.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  await prisma.costPrice.delete({ where: { id } })
  revalidatePath('/references')
  return { success: true, data: undefined }
}

// ─── SelfPurchase Mutations ─────────────────────────────────────────────────

export async function createSelfPurchase(data: {
  wbAccountId: string
  vendorCode: string
  date: string
  quantity: number
  amount: number
  cashback?: number
  note?: string
}): Promise<ActionResult<SelfPurchaseRow>> {
  await requireSession()

  if (!data.vendorCode.trim()) return { success: false, error: 'Артикул обязателен' }
  if (!data.date) return { success: false, error: 'Дата обязательна' }
  if (data.quantity <= 0) return { success: false, error: 'Количество должно быть больше 0' }
  if (data.amount <= 0) return { success: false, error: 'Сумма должна быть больше 0' }

  const row = await prisma.selfPurchase.create({
    data: {
      wbAccountId: data.wbAccountId,
      vendorCode: data.vendorCode,
      date: new Date(data.date),
      quantity: data.quantity,
      amount: data.amount,
      cashback: data.cashback ?? null,
      note: data.note?.trim() || null,
    },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      date: serializeDate(row.date),
      quantity: row.quantity,
      amount: row.amount.toString(),
      cashback: row.cashback?.toString() ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function updateSelfPurchase(
  id: string,
  data: {
    vendorCode: string
    date: string
    quantity: number
    amount: number
    cashback?: number
    note?: string
  },
): Promise<ActionResult<SelfPurchaseRow>> {
  await requireSession()

  if (!data.vendorCode.trim()) return { success: false, error: 'Артикул обязателен' }
  if (!data.date) return { success: false, error: 'Дата обязательна' }
  if (data.quantity <= 0) return { success: false, error: 'Количество должно быть больше 0' }
  if (data.amount <= 0) return { success: false, error: 'Сумма должна быть больше 0' }

  const exists = await prisma.selfPurchase.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  const row = await prisma.selfPurchase.update({
    where: { id },
    data: {
      vendorCode: data.vendorCode,
      date: new Date(data.date),
      quantity: data.quantity,
      amount: data.amount,
      cashback: data.cashback ?? null,
      note: data.note?.trim() || null,
    },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      date: serializeDate(row.date),
      quantity: row.quantity,
      amount: row.amount.toString(),
      cashback: row.cashback?.toString() ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function deleteSelfPurchase(id: string): Promise<ActionResult> {
  await requireSession()

  const exists = await prisma.selfPurchase.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  await prisma.selfPurchase.delete({ where: { id } })
  revalidatePath('/references')
  return { success: true, data: undefined }
}

// ─── ExternalAd Mutations ───────────────────────────────────────────────────

export async function createExternalAd(data: {
  wbAccountId: string
  vendorCode?: string
  date: string
  amount: number
  source?: string
  note?: string
}): Promise<ActionResult<ExternalAdRow>> {
  await requireSession()

  if (!data.date) return { success: false, error: 'Дата обязательна' }
  if (data.amount <= 0) return { success: false, error: 'Сумма должна быть больше 0' }

  const row = await prisma.externalAd.create({
    data: {
      wbAccountId: data.wbAccountId,
      vendorCode: data.vendorCode?.trim() || null,
      date: new Date(data.date),
      amount: data.amount,
      source: data.source?.trim() || null,
      note: data.note?.trim() || null,
    },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      date: serializeDate(row.date),
      amount: row.amount.toString(),
      source: row.source,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function updateExternalAd(
  id: string,
  data: {
    vendorCode?: string
    date: string
    amount: number
    source?: string
    note?: string
  },
): Promise<ActionResult<ExternalAdRow>> {
  await requireSession()

  if (!data.date) return { success: false, error: 'Дата обязательна' }
  if (data.amount <= 0) return { success: false, error: 'Сумма должна быть больше 0' }

  const exists = await prisma.externalAd.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  const row = await prisma.externalAd.update({
    where: { id },
    data: {
      vendorCode: data.vendorCode?.trim() || null,
      date: new Date(data.date),
      amount: data.amount,
      source: data.source?.trim() || null,
      note: data.note?.trim() || null,
    },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      date: serializeDate(row.date),
      amount: row.amount.toString(),
      source: row.source,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function deleteExternalAd(id: string): Promise<ActionResult> {
  await requireSession()

  const exists = await prisma.externalAd.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  await prisma.externalAd.delete({ where: { id } })
  revalidatePath('/references')
  return { success: true, data: undefined }
}

// ─── ArticleOverride Mutations ──────────────────────────────────────────────

export async function upsertArticleOverride(data: {
  wbAccountId: string
  vendorCode: string
  localName?: string
  localColor?: string
  localSize?: string
  localComposition?: string
}): Promise<ActionResult<ArticleOverrideRow>> {
  await requireSession()

  if (!data.vendorCode.trim()) return { success: false, error: 'Артикул обязателен' }

  const localName = data.localName?.trim() || null
  const localColor = data.localColor?.trim() || null
  const localSize = data.localSize?.trim() || null
  const localComposition = data.localComposition?.trim() || null

  const row = await prisma.articleOverride.upsert({
    where: {
      wbAccountId_vendorCode: {
        wbAccountId: data.wbAccountId,
        vendorCode: data.vendorCode,
      },
    },
    create: {
      wbAccountId: data.wbAccountId,
      vendorCode: data.vendorCode,
      localName,
      localColor,
      localSize,
      localComposition,
    },
    update: { localName, localColor, localSize, localComposition },
  })

  revalidatePath('/references')
  return {
    success: true,
    data: {
      id: row.id,
      wbAccountId: row.wbAccountId,
      vendorCode: row.vendorCode,
      localName: row.localName,
      localColor: row.localColor,
      localSize: row.localSize,
      localComposition: row.localComposition,
    },
  }
}

export async function deleteArticleOverride(id: string): Promise<ActionResult> {
  await requireSession()

  const exists = await prisma.articleOverride.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return { success: false, error: 'Запись не найдена' }

  await prisma.articleOverride.delete({ where: { id } })
  revalidatePath('/references')
  return { success: true, data: undefined }
}
