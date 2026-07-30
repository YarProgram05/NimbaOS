'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { prisma } from '@/lib/db'
import {
  addFbsAssortmentItem,
  adjustFbsInventory,
  assignKizToOrder,
  attachAssignedKizToWb,
  closeFbsSupplyInWb,
  configureFbsAssortment,
  confirmKizComplianceTask,
  exportKizComplianceTasks,
  markPhysicalKizReturn,
  markKizException,
  moveOrderToFbsSupply,
  publishFbsWarehouseStocks,
  registerKizUnit,
  releaseReturnedKizFromQuarantine,
  setFbsWarehouseWriteEnabled,
  updateFbsOrderStatusInWb,
} from '@/lib/services/fbs-operations'
import { enqueueManualSyncAction } from '@/lib/actions/sync'
import { SYNC_JOB_KINDS, type EnqueuedSyncJob } from '@/types/sync'
import type { ActionResult } from '@/types'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchFbsOrderStickers } from '@/lib/wb-api/fbs'
import type { WbFbsSticker } from '@/types/fbs'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

async function requireManagerSession() {
  const session = await requireSession()
  if (!checkRole(session, 'MANAGER')) throw new Error('Недостаточно прав')
  return session
}

async function requireAdminSession() {
  const session = await requireSession()
  if (!checkRole(session, 'ADMIN')) throw new Error('Включить запись в WB может только администратор')
  return session
}

function refreshFbs() {
  revalidatePath('/fbs')
}

function failure(error: unknown, fallback: string) {
  return { success: false, error: error instanceof Error ? error.message : fallback } as const
}

export async function syncFbsAction(
  wbAccountId: string,
  kind:
    | typeof SYNC_JOB_KINDS.FBS_OPERATIONAL
    | typeof SYNC_JOB_KINDS.FBS_STOCKS_CURRENT
    | typeof SYNC_JOB_KINDS.FBS_MARKING_REPORT,
): Promise<ActionResult<EnqueuedSyncJob>> {
  await requireManagerSession()
  return enqueueManualSyncAction(kind, wbAccountId)
}

export async function getFbsSyncJobStatusAction(
  id: string,
): Promise<ActionResult<{ status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; error: string | null }>> {
  try {
    await requireSession()
    const run = await prisma.syncJobRun.findUnique({
      where: { id },
      select: { kind: true, status: true, error: true },
    })
    if (!run || !['FBS_OPERATIONAL', 'FBS_STOCKS_CURRENT', 'FBS_MARKING_REPORT'].includes(run.kind)) {
      return { success: false, error: 'Задача FBS не найдена' }
    }
    return {
      success: true,
      data: {
        status: run.status,
        error: run.error,
      },
    }
  } catch (error) {
    return failure(error, 'Не удалось получить статус синхронизации FBS')
  }
}

export async function adjustFbsInventoryAction(input: {
  wbAccountId: string
  assortmentItemId: string
  quantityDelta: number
  note: string
}): Promise<ActionResult<{ id: string; onHand: number; reserved: number }>> {
  try {
    const session = await requireManagerSession()
    const data = await adjustFbsInventory({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось скорректировать остаток FBS')
  }
}

export async function configureFbsAssortmentAction(input: {
  wbAccountId: string
  assortmentItemId: string
  requiresKiz: boolean
  markingGtin?: string | null
}): Promise<ActionResult<{ id: string; requiresKiz: boolean; markingGtin: string | null }>> {
  try {
    await requireManagerSession()
    const data = await configureFbsAssortment(input)
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось сохранить маркировку артикула')
  }
}

export async function addFbsAssortmentItemAction(input: {
  wbAccountId: string
  warehouseId: string
  productSizeId: string
  requiresKiz?: boolean
}): Promise<ActionResult<{ id: string; nmId: number; chrtId: number }>> {
  try {
    await requireManagerSession()
    const data = await addFbsAssortmentItem(input)
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось добавить артикул на FBS')
  }
}

export async function registerKizAction(input: {
  wbAccountId: string
  assortmentItemId: string
  rawCode: string
  circulationState?: 'UNKNOWN' | 'COMMISSIONING_REQUIRED' | 'IN_CIRCULATION'
}): Promise<ActionResult<{ id: string; maskedCode: string; duplicate: boolean }>> {
  try {
    const session = await requireManagerSession()
    const data = await registerKizUnit({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось зарегистрировать КИЗ')
  }
}

export async function importKizXlsxAction(input: {
  wbAccountId: string
  base64: string
}): Promise<ActionResult<{ imported: number; duplicates: number; errors: string[] }>> {
  try {
    const session = await requireManagerSession()
    const buffer = Buffer.from(input.base64, 'base64')
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Файл КИЗ не должен превышать 5 МБ')
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!firstSheet) throw new Error('В файле нет листа с данными')
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
    if (rows.length > 5_000) throw new Error('За одну загрузку можно импортировать не более 5000 КИЗов')

    const items = await prisma.fbsAssortmentItem.findMany({
      where: { wbAccountId: input.wbAccountId },
      include: { warehouse: { select: { name: true, externalId: true } } },
    })
    let imported = 0
    let duplicates = 0
    const errors: string[] = []

    for (let index = 0; index < rows.length; index += 1) {
      try {
        const row = normalizeImportRow(rows[index])
        const item = items.find((candidate) => {
          const warehouseMatches =
            !row.warehouse ||
            candidate.warehouse.name.toLowerCase() === row.warehouse.toLowerCase() ||
            candidate.warehouse.externalId.toString() === row.warehouse
          const articleMatches =
            (row.chrtId !== null && candidate.chrtId === row.chrtId) ||
            (row.barcode && candidate.barcode === row.barcode)
          return warehouseMatches && articleMatches
        })
        if (!item) throw new Error('не найден артикул/склад FBS')
        const result = await registerKizUnit({
          wbAccountId: input.wbAccountId,
          assortmentItemId: item.id,
          rawCode: row.code,
          circulationState: row.circulationState,
          userId: session.user.id,
        })
        if (result.duplicate) duplicates += 1
        else imported += 1
      } catch (error) {
        errors.push(`Строка ${index + 2}: ${error instanceof Error ? error.message : 'ошибка'}`)
        if (errors.length >= 50) break
      }
    }
    refreshFbs()
    return { success: true, data: { imported, duplicates, errors } }
  } catch (error) {
    return failure(error, 'Не удалось импортировать КИЗы')
  }
}

function normalizeImportRow(row: Record<string, unknown>) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? '').trim()]),
  )
  const value = (...names: string[]) =>
    names.map((name) => normalized.get(name)).find((candidate) => candidate) ?? ''
  const code = value('киз', 'код', 'datamatrix', 'data matrix', 'sgtin')
  if (!code) throw new Error('не заполнен КИЗ')
  const rawChrtId = value('chrtid', 'chrt id', 'chrt_id')
  const chrtId = rawChrtId ? Number(rawChrtId) : null
  const circulation = value('статус оборота', 'circulation', 'оборот').toLowerCase()
  const circulationState =
    circulation.includes('ввод') || circulation.includes('commission')
      ? 'COMMISSIONING_REQUIRED'
      : circulation.includes('в обороте') || circulation === 'in_circulation'
        ? 'IN_CIRCULATION'
        : 'UNKNOWN'
  return {
    code,
    warehouse: value('склад', 'warehouse', 'warehouseid', 'warehouse id'),
    chrtId: chrtId !== null && Number.isFinite(chrtId) ? chrtId : null,
    barcode: value('баркод', 'barcode', 'штрихкод'),
    circulationState: circulationState as 'UNKNOWN' | 'COMMISSIONING_REQUIRED' | 'IN_CIRCULATION',
  }
}

export async function assignKizToOrderAction(input: {
  wbAccountId: string
  orderId: string
  kizUnitId: string
}): Promise<ActionResult<{ orderId: string; kizUnitId: string; maskedCode: string }>> {
  try {
    const session = await requireManagerSession()
    const data = await assignKizToOrder({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось назначить КИЗ')
  }
}

export async function markPhysicalKizReturnAction(input: {
  wbAccountId: string
  rawCode: string
}): Promise<ActionResult<{ id: string; maskedCode: string; needsReturnToCirculation: boolean }>> {
  try {
    const session = await requireManagerSession()
    const data = await markPhysicalKizReturn({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось принять возвратный КИЗ')
  }
}

export async function releaseReturnedKizFromQuarantineAction(input: {
  wbAccountId: string
  kizUnitId: string
}): Promise<ActionResult<{ id: string; maskedCode: string }>> {
  try {
    const session = await requireManagerSession()
    const data = await releaseReturnedKizFromQuarantine({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось вернуть КИЗ в доступный остаток')
  }
}

export async function markKizExceptionAction(input: {
  wbAccountId: string
  kizUnitId: string
  reason: 'damaged' | 'lost'
  note: string
}): Promise<ActionResult<{ id: string; maskedCode: string; reason: 'damaged' | 'lost' }>> {
  try {
    const session = await requireManagerSession()
    const data = await markKizException({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось зафиксировать исключение КИЗа')
  }
}

export async function exportKizComplianceTasksAction(input: {
  wbAccountId: string
  taskIds?: string[]
}): Promise<ActionResult<{
  base64: string
  filename: string
  batchId: string
  taskCount: number
}>> {
  try {
    const session = await requireManagerSession()
    const data = await exportKizComplianceTasks({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось выгрузить операции КИЗ')
  }
}

export async function confirmKizComplianceTaskAction(input: {
  wbAccountId: string
  taskId: string
  documentNumber: string
  documentDate: string
}): Promise<ActionResult<{ id: string; alreadyConfirmed: boolean }>> {
  try {
    const session = await requireManagerSession()
    const data = await confirmKizComplianceTask({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось подтвердить операцию Честного знака')
  }
}

export async function setFbsWarehouseWriteEnabledAction(input: {
  wbAccountId: string
  warehouseId: string
  enabled: boolean
}): Promise<ActionResult<{ id: string; writeEnabled: boolean }>> {
  try {
    await requireAdminSession()
    const data = await setFbsWarehouseWriteEnabled(input)
    refreshFbs()
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось изменить режим записи WB')
  }
}

export async function attachAssignedKizToWbAction(input: {
  wbAccountId: string
  orderId: string
}): Promise<ActionResult<{ actionLogId: string; repeated: boolean }>> {
  try {
    const session = await requireManagerSession()
    const result = await attachAssignedKizToWb({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data: { actionLogId: result.actionLogId, repeated: result.repeated } }
  } catch (error) {
    return failure(error, 'Не удалось закрепить КИЗ в WB')
  }
}

export async function updateFbsOrderStatusInWbAction(input: {
  wbAccountId: string
  orderId: string
  status: 'confirm' | 'complete' | 'cancel'
}): Promise<ActionResult<{ actionLogId: string; repeated: boolean }>> {
  try {
    const session = await requireManagerSession()
    const result = await updateFbsOrderStatusInWb({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data: { actionLogId: result.actionLogId, repeated: result.repeated } }
  } catch (error) {
    return failure(error, 'Не удалось изменить статус заказа в WB')
  }
}

export async function publishFbsWarehouseStocksAction(input: {
  wbAccountId: string
  warehouseId: string
}): Promise<ActionResult<{ actionLogId: string; repeated: boolean }>> {
  try {
    const session = await requireManagerSession()
    const result = await publishFbsWarehouseStocks({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data: { actionLogId: result.actionLogId, repeated: result.repeated } }
  } catch (error) {
    return failure(error, 'Не удалось опубликовать остатки FBS')
  }
}

export async function moveOrderToFbsSupplyAction(input: {
  wbAccountId: string
  orderId: string
  supplyId: string
}): Promise<ActionResult<{ actionLogId: string; repeated: boolean }>> {
  try {
    const session = await requireManagerSession()
    const result = await moveOrderToFbsSupply({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data: { actionLogId: result.actionLogId, repeated: result.repeated } }
  } catch (error) {
    return failure(error, 'Не удалось перенести заказ в поставку')
  }
}

export async function closeFbsSupplyInWbAction(input: {
  wbAccountId: string
  supplyId: string
}): Promise<ActionResult<{ actionLogId: string; repeated: boolean }>> {
  try {
    const session = await requireManagerSession()
    const result = await closeFbsSupplyInWb({ ...input, userId: session.user.id })
    refreshFbs()
    return { success: true, data: { actionLogId: result.actionLogId, repeated: result.repeated } }
  } catch (error) {
    return failure(error, 'Не удалось закрыть поставку')
  }
}

export async function getFbsOrderStickersAction(input: {
  wbAccountId: string
  orderIds: string[]
}): Promise<ActionResult<WbFbsSticker[]>> {
  try {
    await requireManagerSession()
    if (!input.orderIds.length || input.orderIds.length > 100) {
      throw new Error('Выберите от 1 до 100 заказов')
    }
    const orders = await prisma.fbsOrder.findMany({
      where: { wbAccountId: input.wbAccountId, id: { in: input.orderIds } },
      select: { externalOrderId: true },
    })
    if (orders.length !== input.orderIds.length) throw new Error('Часть заказов не найдена')
    const account = await prisma.wbAccount.findUniqueOrThrow({
      where: { id: input.wbAccountId },
      select: { apiKey: true },
    })
    const data = await fetchFbsOrderStickers(
      new WbApiClient(decrypt(account.apiKey)),
      orders.map((order) => Number(order.externalOrderId)),
    )
    return { success: true, data }
  } catch (error) {
    return failure(error, 'Не удалось получить стикеры заказов')
  }
}
