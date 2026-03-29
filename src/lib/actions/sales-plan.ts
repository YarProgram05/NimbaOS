'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { ActionResult } from '@/types'
import type {
  SalesPlanRow,
  SalesPlanDetail,
  SalesPlanItemRow,
  SalesPlanCreateInput,
  SalesPlanItemInput,
  SalesPlanUpdateInput,
  SalesPlanItemUpdateInput,
} from '@/types/sales-plan'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

function serializeDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── List Plans ────────────────────────────────────────────────────────────

export async function getPlansAction(
  wbAccountId: string,
): Promise<ActionResult<SalesPlanRow[]>> {
  try {
    await requireSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    const plans = await prisma.salesPlan.findMany({
      where: { wbAccountId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const rows: SalesPlanRow[] = plans.map((p) => ({
      id: p.id,
      wbAccountId: p.wbAccountId,
      name: p.name,
      description: p.description,
      dateFrom: serializeDate(p.dateFrom),
      dateTo: serializeDate(p.dateTo),
      drrPercent: p.drrPercent.toString(),
      itemCount: p._count.items,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки планов' }
  }
}

// ─── Create Plan ───────────────────────────────────────────────────────────

export async function createPlanAction(
  input: SalesPlanCreateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession()
    if (!input.wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    if (!input.name.trim()) return { success: false, error: 'Укажите название плана' }
    if (!input.dateFrom || !input.dateTo) return { success: false, error: 'Укажите период' }

    const plan = await prisma.salesPlan.create({
      data: {
        wbAccountId: input.wbAccountId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        dateFrom: new Date(input.dateFrom),
        dateTo: new Date(input.dateTo),
        drrPercent: input.drrPercent,
      },
    })

    return { success: true, data: { id: plan.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка создания плана' }
  }
}

// ─── Get Plan Detail ───────────────────────────────────────────────────────

export async function getPlanDetailAction(
  planId: string,
): Promise<ActionResult<SalesPlanDetail>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const plan = await prisma.salesPlan.findUnique({
      where: { id: planId },
      include: { items: true },
    })

    if (!plan) return { success: false, error: 'План не найден' }

    // Enrich items with Product data (photo, category, title, brand)
    const nmIds = plan.items.map((i) => i.nmId)
    const products = nmIds.length > 0
      ? await prisma.product.findMany({
          where: { wbAccountId: plan.wbAccountId, nmId: { in: nmIds } },
          select: { nmId: true, photoUrl: true, category: true, title: true, brand: true },
        })
      : []
    const productMap = new Map(products.map((p) => [p.nmId, p]))

    const items: SalesPlanItemRow[] = plan.items.map((i) => {
      const prod = productMap.get(i.nmId)
      return {
        id: i.id,
        nmId: i.nmId,
        vendorCode: i.vendorCode,
        plannedQty: i.plannedQty,
        price: i.price.toString(),
        buyoutPercent: i.buyoutPercent.toString(),
        photoUrl: prod?.photoUrl ?? null,
        category: prod?.category ?? null,
        title: prod?.title ?? null,
        brandName: prod?.brand ?? null,
      }
    })

    return {
      success: true,
      data: {
        id: plan.id,
        wbAccountId: plan.wbAccountId,
        name: plan.name,
        description: plan.description,
        dateFrom: serializeDate(plan.dateFrom),
        dateTo: serializeDate(plan.dateTo),
        drrPercent: plan.drrPercent.toString(),
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        items,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки плана' }
  }
}

// ─── Update Plan ───────────────────────────────────────────────────────────

export async function updatePlanAction(
  planId: string,
  input: SalesPlanUpdateInput,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.description !== undefined) data.description = input.description?.trim() || null
    if (input.dateFrom !== undefined) data.dateFrom = new Date(input.dateFrom)
    if (input.dateTo !== undefined) data.dateTo = new Date(input.dateTo)
    if (input.drrPercent !== undefined) data.drrPercent = input.drrPercent

    if (Object.keys(data).length === 0) {
      return { success: false, error: 'Нет данных для обновления' }
    }

    await prisma.salesPlan.update({ where: { id: planId }, data })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка обновления плана' }
  }
}

// ─── Delete Plan ───────────────────────────────────────────────────────────

export async function deletePlanAction(
  planId: string,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }

    await prisma.salesPlan.delete({ where: { id: planId } })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка удаления плана' }
  }
}

// ─── Add Plan Items ────────────────────────────────────────────────────────

export async function addPlanItemsAction(
  planId: string,
  items: SalesPlanItemInput[],
): Promise<ActionResult<{ added: number }>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }
    if (!items.length) return { success: false, error: 'Список артикулов пуст' }

    const result = await prisma.salesPlanItem.createMany({
      data: items.map((i) => ({
        planId,
        nmId: i.nmId,
        vendorCode: i.vendorCode,
        plannedQty: i.plannedQty,
        price: i.price,
        buyoutPercent: i.buyoutPercent,
      })),
      skipDuplicates: true,
    })

    return { success: true, data: { added: result.count } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка добавления артикулов' }
  }
}

// ─── Add All Items From Stock ──────────────────────────────────────────────

export async function addItemsFromStockAction(
  planId: string,
  wbAccountId: string,
): Promise<ActionResult<{ added: number }>> {
  try {
    await requireSession()
    if (!planId) return { success: false, error: 'План не указан' }
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    // Fetch all products for the account
    const products = await prisma.product.findMany({
      where: { wbAccountId },
      select: { nmId: true, vendorCode: true },
    })

    if (!products.length) return { success: false, error: 'Нет товаров в кабинете. Сначала синхронизируйте карточки.' }

    // Check which nmIds are already in the plan
    const existingItems = await prisma.salesPlanItem.findMany({
      where: { planId },
      select: { nmId: true },
    })
    const existingNmIds = new Set(existingItems.map((i) => i.nmId))

    const newItems = products
      .filter((p) => !existingNmIds.has(p.nmId))
      .map((p) => ({
        planId,
        nmId: p.nmId,
        vendorCode: p.vendorCode,
        plannedQty: 0,
        price: 0,
        buyoutPercent: 0,
      }))

    if (!newItems.length) return { success: true, data: { added: 0 } }

    const result = await prisma.salesPlanItem.createMany({
      data: newItems,
      skipDuplicates: true,
    })

    return { success: true, data: { added: result.count } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка добавления из остатков' }
  }
}

// ─── Update Plan Item ──────────────────────────────────────────────────────

export async function updatePlanItemAction(
  itemId: string,
  input: SalesPlanItemUpdateInput,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!itemId) return { success: false, error: 'Артикул не указан' }

    const data: Record<string, unknown> = {}
    if (input.plannedQty !== undefined) data.plannedQty = input.plannedQty
    if (input.price !== undefined) data.price = input.price
    if (input.buyoutPercent !== undefined) data.buyoutPercent = input.buyoutPercent

    if (Object.keys(data).length === 0) {
      return { success: false, error: 'Нет данных для обновления' }
    }

    await prisma.salesPlanItem.update({ where: { id: itemId }, data })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка обновления артикула' }
  }
}

// ─── Remove Plan Item ──────────────────────────────────────────────────────

export async function removePlanItemAction(
  itemId: string,
): Promise<ActionResult<void>> {
  try {
    await requireSession()
    if (!itemId) return { success: false, error: 'Артикул не указан' }

    await prisma.salesPlanItem.delete({ where: { id: itemId } })

    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка удаления артикула' }
  }
}
