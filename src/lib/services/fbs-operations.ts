import { createHash, randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import {
  prepareKizForStorage,
  hashKizCode,
  normalizeKizCode,
  toKizIdentificationCode,
} from '@/lib/fbs/kiz'
import {
  getKizComplianceExportDefinition,
  toCrptUnitPriceRub,
  type KizComplianceExportKind,
} from '@/lib/fbs/compliance-export'
import { isOrderMetadataReady } from '@/lib/fbs/state-machine'
import { createMovement, sanitizeFbsMetadata } from '@/lib/services/sync-fbs'
import { WbApiClient, WbApiError } from '@/lib/wb-api/client'
import {
  attachKizToFbsOrder,
  closeFbsSupply,
  moveFbsOrderToSupply,
  publishFbsStocks,
  setFbsOrderSupplierStatus,
} from '@/lib/wb-api/fbs'
import {
  appendAoaSheet,
  createWorkbook,
  safeXlsxFilename,
  workbookToBase64,
} from '@/lib/xlsx/export'

type CirculationInput = 'UNKNOWN' | 'COMMISSIONING_REQUIRED' | 'IN_CIRCULATION'

export async function registerKizUnit(input: {
  wbAccountId: string
  assortmentItemId: string
  rawCode: string
  circulationState?: CirculationInput
  userId: string
}) {
  const item = await prisma.fbsAssortmentItem.findFirstOrThrow({
    where: { id: input.assortmentItemId, wbAccountId: input.wbAccountId },
    select: { id: true, warehouseId: true, productSizeId: true, markingGtin: true },
  })
  const prepared = prepareKizForStorage(input.rawCode)
  if (item.markingGtin && prepared.parsed.gtin !== item.markingGtin) {
    throw new Error('GTIN КИЗа не совпадает с GTIN артикула FBS')
  }

  const circulationState = input.circulationState ?? 'UNKNOWN'
  return prisma.$transaction(async (tx) => {
    const existing = await tx.kizUnit.findUnique({
      where: {
        wbAccountId_codeHash: {
          wbAccountId: input.wbAccountId,
          codeHash: prepared.codeHash,
        },
      },
    })
    const nextCirculationState =
      existing && existing.circulationState !== 'UNKNOWN'
        ? existing.circulationState
        : circulationState
    const unit = existing
      ? await tx.kizUnit.update({
          where: { id: existing.id },
          data: {
            assortmentItemId: item.id,
            warehouseId: item.warehouseId,
            productSizeId: item.productSizeId,
            circulationState: nextCirculationState,
            lastScannedAt: new Date(),
          },
        })
      : await tx.kizUnit.create({
          data: {
            wbAccountId: input.wbAccountId,
            warehouseId: item.warehouseId,
            assortmentItemId: item.id,
            productSizeId: item.productSizeId,
            encryptedCode: prepared.encryptedCode,
            codeHash: prepared.codeHash,
            maskedCode: prepared.maskedCode,
            gtin: prepared.parsed.gtin,
            serialMasked: prepared.serialMasked,
            circulationState,
            lastScannedAt: new Date(),
          },
        })

    await tx.kizEvent.create({
      data: {
        kizUnitId: unit.id,
        userId: input.userId,
        type: existing ? 'SCANNED' : 'IMPORTED',
        details: { source: 'nimbaos', duplicate: Boolean(existing) },
      },
    })

    if (nextCirculationState === 'COMMISSIONING_REQUIRED') {
      await tx.kizComplianceTask.upsert({
        where: { idempotencyKey: `kiz:${unit.id}:commissioning` },
        create: {
          wbAccountId: input.wbAccountId,
          kizUnitId: unit.id,
          type: 'COMMISSIONING',
          idempotencyKey: `kiz:${unit.id}:commissioning`,
        },
        update: {},
      })
    }

    return {
      id: unit.id,
      maskedCode: unit.maskedCode,
      duplicate: Boolean(existing),
    }
  })
}

export async function assignKizToOrder(input: {
  wbAccountId: string
  orderId: string
  kizUnitId: string
  userId: string
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.fbsOrder.findFirstOrThrow({
      where: { id: input.orderId, wbAccountId: input.wbAccountId },
      include: {
        assortmentItem: { select: { id: true, markingGtin: true } },
        kizUnits: { select: { id: true } },
      },
    })
    const unit = await tx.kizUnit.findFirstOrThrow({
      where: { id: input.kizUnitId, wbAccountId: input.wbAccountId },
    })
    if (order.kizUnits.some((row) => row.id !== unit.id)) {
      throw new Error('К заказу уже назначен другой КИЗ')
    }
    if (unit.currentOrderId && unit.currentOrderId !== order.id) {
      throw new Error('КИЗ уже назначен другому заказу')
    }
    if (!['IN_STOCK', 'RESERVED'].includes(unit.physicalState)) {
      throw new Error('КИЗ недоступен для назначения')
    }
    if (
      order.assortmentItem?.markingGtin &&
      unit.gtin &&
      order.assortmentItem.markingGtin !== unit.gtin
    ) {
      throw new Error('GTIN КИЗа не соответствует заказанному артикулу')
    }

    await tx.kizUnit.update({
      where: { id: unit.id },
      data: {
        currentOrderId: order.id,
        assortmentItemId: order.assortmentItem?.id ?? unit.assortmentItemId,
        warehouseId: order.warehouseId ?? unit.warehouseId,
        physicalState: 'RESERVED',
        lastScannedAt: new Date(),
      },
    })
    await tx.kizEvent.create({
      data: {
        kizUnitId: unit.id,
        orderId: order.id,
        userId: input.userId,
        type: 'ASSIGNED',
      },
    })
    return { orderId: order.id, kizUnitId: unit.id, maskedCode: unit.maskedCode }
  })
}

export async function adjustFbsInventory(input: {
  wbAccountId: string
  assortmentItemId: string
  quantityDelta: number
  note: string
  userId: string
}) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error('Изменение остатка должно быть ненулевым целым числом')
  }
  const note = input.note.trim()
  if (note.length < 3) throw new Error('Укажите причину корректировки')

  return prisma.$transaction(async (tx) => {
    const item = await tx.fbsAssortmentItem.findFirstOrThrow({
      where: { id: input.assortmentItemId, wbAccountId: input.wbAccountId },
      select: { id: true },
    })
    const idempotencyKey = `manual:${cryptoRandomId()}`
    await createMovement(tx, {
      itemId: item.id,
      type: input.quantityDelta > 0 ? 'RECEIPT' : 'ADJUSTMENT',
      onHandDelta: input.quantityDelta,
      reservedDelta: 0,
      source: 'manual',
      idempotencyKey,
      userId: input.userId,
      note,
    })
    return tx.fbsAssortmentItem.findUniqueOrThrow({
      where: { id: item.id },
      select: { id: true, onHand: true, reserved: true },
    })
  })
}

export async function configureFbsAssortment(input: {
  wbAccountId: string
  assortmentItemId: string
  requiresKiz: boolean
  markingGtin?: string | null
}) {
  const gtin = input.markingGtin?.trim() || null
  if (gtin && !/^\d{14}$/.test(gtin)) throw new Error('GTIN должен содержать 14 цифр')
  return prisma.fbsAssortmentItem.update({
    where: { id: input.assortmentItemId, wbAccountId: input.wbAccountId },
    data: { requiresKiz: input.requiresKiz, markingGtin: gtin },
    select: { id: true, requiresKiz: true, markingGtin: true },
  })
}

export async function addFbsAssortmentItem(input: {
  wbAccountId: string
  warehouseId: string
  productSizeId: string
  requiresKiz?: boolean
}) {
  const [warehouse, size] = await Promise.all([
    prisma.fbsSellerWarehouse.findFirstOrThrow({
      where: { id: input.warehouseId, wbAccountId: input.wbAccountId },
      select: { id: true },
    }),
    prisma.productSize.findFirstOrThrow({
      where: { id: input.productSizeId, product: { wbAccountId: input.wbAccountId } },
      include: { product: { select: { id: true, nmId: true, vendorCode: true } } },
    }),
  ])
  if (size.chrtId == null) throw new Error('У размера нет chrtId WB')

  return prisma.fbsAssortmentItem.upsert({
    where: { warehouseId_chrtId: { warehouseId: warehouse.id, chrtId: size.chrtId } },
    create: {
      wbAccountId: input.wbAccountId,
      warehouseId: warehouse.id,
      productId: size.product.id,
      productSizeId: size.id,
      nmId: size.product.nmId,
      chrtId: size.chrtId,
      barcode: size.barcode,
      vendorCode: size.product.vendorCode,
      requiresKiz: Boolean(input.requiresKiz),
    },
    update: {
      isEnabled: true,
      productId: size.product.id,
      productSizeId: size.id,
      barcode: size.barcode,
      vendorCode: size.product.vendorCode,
    },
    select: { id: true, nmId: true, chrtId: true },
  })
}

export async function markPhysicalKizReturn(input: {
  wbAccountId: string
  rawCode: string
  userId: string
}) {
  const codeHash = hashKizCode(normalizeKizCode(input.rawCode))
  return prisma.$transaction(async (tx) => {
    const unit = await tx.kizUnit.findUniqueOrThrow({
      where: { wbAccountId_codeHash: { wbAccountId: input.wbAccountId, codeHash } },
    })
    const needsReturnToCirculation =
      unit.circulationState === 'WITHDRAWN' ||
      unit.circulationState === 'RETURN_TO_CIRCULATION_REQUIRED'
    if (unit.circulationState === 'WITHDRAWAL_REQUIRED') {
      await tx.kizComplianceTask.updateMany({
        where: {
          kizUnitId: unit.id,
          type: { in: ['WITHDRAWAL_REMOTE_SALE', 'WITHDRAWAL_B2B'] },
          status: { in: ['OPEN', 'EXPORTED'] },
        },
        data: { status: 'CANCELED' },
      })
    }
    await tx.kizUnit.update({
      where: { id: unit.id },
      data: {
        physicalState: 'QUARANTINE',
        circulationState: needsReturnToCirculation
          ? 'RETURN_TO_CIRCULATION_REQUIRED'
          : unit.circulationState === 'WITHDRAWAL_REQUIRED'
            ? 'IN_CIRCULATION'
            : unit.circulationState,
        lastScannedAt: new Date(),
      },
    })
    await tx.kizEvent.create({
      data: {
        kizUnitId: unit.id,
        orderId: unit.currentOrderId,
        userId: input.userId,
        type: 'RETURN_RECEIVED',
        details: { availability: 'quarantine' },
      },
    })
    if (needsReturnToCirculation) {
      await tx.kizComplianceTask.upsert({
        where: { idempotencyKey: `kiz:${unit.id}:return-to-circulation` },
        create: {
          wbAccountId: input.wbAccountId,
          kizUnitId: unit.id,
          orderId: unit.currentOrderId,
          type: 'RETURN_TO_CIRCULATION',
          idempotencyKey: `kiz:${unit.id}:return-to-circulation`,
        },
        update: {
          status: 'OPEN',
          batchId: null,
          exportedAt: null,
          confirmedAt: null,
          confirmedById: null,
        },
      })
    }
    return { id: unit.id, maskedCode: unit.maskedCode, needsReturnToCirculation }
  })
}

export async function releaseReturnedKizFromQuarantine(input: {
  wbAccountId: string
  kizUnitId: string
  userId: string
}) {
  return prisma.$transaction(async (tx) => {
    const unit = await tx.kizUnit.findFirstOrThrow({
      where: { id: input.kizUnitId, wbAccountId: input.wbAccountId },
    })
    if (unit.physicalState !== 'QUARANTINE') throw new Error('КИЗ не находится в карантине')
    if (unit.circulationState === 'RETURN_TO_CIRCULATION_REQUIRED') {
      throw new Error('Сначала подтвердите возврат КИЗа в оборот через очередь Честного знака')
    }
    if (!unit.assortmentItemId) throw new Error('Для КИЗа не определён FBS-артикул')

    await createMovement(tx, {
      itemId: unit.assortmentItemId,
      orderId: unit.currentOrderId,
      kizUnitId: unit.id,
      type: 'RETURN_RECEIVED',
      onHandDelta: 1,
      reservedDelta: 0,
      source: 'return_inspection',
      idempotencyKey: `kiz:${unit.id}:return-receipt:${cryptoRandomId()}`,
      userId: input.userId,
    })
    await tx.kizUnit.update({
      where: { id: unit.id },
      data: { physicalState: 'IN_STOCK', currentOrderId: null },
    })
    await tx.kizEvent.create({
      data: {
        kizUnitId: unit.id,
        orderId: unit.currentOrderId,
        userId: input.userId,
        type: 'SCANNED',
        details: { returnInspection: 'accepted' },
      },
    })
    return { id: unit.id, maskedCode: unit.maskedCode }
  })
}

export async function markKizException(input: {
  wbAccountId: string
  kizUnitId: string
  reason: 'damaged' | 'lost'
  note: string
  userId: string
}) {
  const note = input.note.trim()
  if (note.length < 3) throw new Error('Укажите причину исключения')
  return prisma.$transaction(async (tx) => {
    const unit = await tx.kizUnit.findFirstOrThrow({
      where: { id: input.kizUnitId, wbAccountId: input.wbAccountId },
    })
    if (unit.physicalState === 'RESERVED') {
      throw new Error('Сначала снимите КИЗ с заказа')
    }
    if (unit.physicalState === 'IN_STOCK' && unit.assortmentItemId) {
      await createMovement(tx, {
        itemId: unit.assortmentItemId,
        orderId: unit.currentOrderId,
        kizUnitId: unit.id,
        type: input.reason === 'lost' ? 'WRITE_OFF' : 'QUARANTINE',
        onHandDelta: -1,
        reservedDelta: 0,
        source: 'kiz_exception',
        idempotencyKey: `kiz:${unit.id}:exception:${cryptoRandomId()}`,
        userId: input.userId,
        note,
      })
    }
    await tx.kizUnit.update({
      where: { id: unit.id },
      data: {
        physicalState: input.reason === 'lost' ? 'LOST' : 'QUARANTINE',
        currentOrderId: input.reason === 'lost' ? null : unit.currentOrderId,
      },
    })
    await tx.kizEvent.create({
      data: {
        kizUnitId: unit.id,
        orderId: unit.currentOrderId,
        userId: input.userId,
        type: 'QUARANTINED',
        details: { reason: input.reason, note },
      },
    })
    return { id: unit.id, maskedCode: unit.maskedCode, reason: input.reason }
  })
}

export async function exportKizComplianceTasks(input: {
  wbAccountId: string
  kind: KizComplianceExportKind
  userId: string
}) {
  const definition = getKizComplianceExportDefinition(input.kind)
  const tasks = await prisma.kizComplianceTask.findMany({
    where: {
      wbAccountId: input.wbAccountId,
      status: 'OPEN',
      type: { in: [...definition.taskTypes] },
      ...(input.kind === 'WITHDRAWAL'
        ? {
            NOT: {
              order: {
                is: {
                  OR: [
                    { supplierStatus: 'cancel' },
                    { wbStatus: { in: ['canceled', 'canceled_by_client', 'declined_by_client', 'defect'] } },
                  ],
                },
              },
            },
          }
        : {}),
    },
    include: {
      kizUnit: true,
      order: {
        select: {
          externalOrderId: true,
          isB2b: true,
          convertedPriceRaw: true,
        },
      },
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })
  if (!tasks.length) throw new Error(definition.emptyMessage)

  const rows = tasks.map((task) => {
    const code = toKizIdentificationCode(decrypt(task.kizUnit.encryptedCode))
    return definition.includeUnitPrice
      ? [code, toCrptUnitPriceRub(task.order?.convertedPriceRaw)]
      : [code]
  })
  const headers = definition.includeUnitPrice
    ? ['Код маркировки', 'Цена за единицу с НДС']
    : ['Код маркировки']
  const workbook = createWorkbook()
  appendAoaSheet(
    workbook,
    definition.sheetName,
    [headers, ...rows],
    {
      widths: definition.includeUnitPrice ? [90, 26] : [90],
      columnFormats: definition.includeUnitPrice ? { 1: '0.00' } : undefined,
    },
  )
  const checksum = createHash('sha256')
    .update(tasks.map((task) => (
      `${task.id}:${task.kizUnit.codeHash}:${definition.includeUnitPrice ? task.order?.convertedPriceRaw : ''}`
    )).join('|'))
    .digest('hex')
  const filename = safeXlsxFilename(
    definition.filenamePrefix,
    new Date().toISOString().slice(0, 10),
  )
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.kizOperationBatch.create({
      data: {
        wbAccountId: input.wbAccountId,
        createdById: input.userId,
        filename,
        taskCount: tasks.length,
        checksum,
      },
    })
    await tx.kizComplianceTask.updateMany({
      where: { id: { in: tasks.map((task) => task.id) } },
      data: { status: 'EXPORTED', batchId: created.id, exportedAt: new Date() },
    })
    for (const task of tasks) {
      await tx.kizEvent.create({
        data: {
          kizUnitId: task.kizUnitId,
          orderId: task.orderId,
          userId: input.userId,
          type: 'COMPLIANCE_EXPORTED',
          details: { batchId: created.id, taskType: task.type },
        },
      })
    }
    return created
  })
  return {
    base64: workbookToBase64(workbook),
    filename,
    batchId: batch.id,
    taskCount: tasks.length,
    kind: input.kind,
  }
}

export async function confirmKizComplianceTask(input: {
  wbAccountId: string
  taskId: string
  documentNumber: string
  documentDate: string
  userId: string
}) {
  const documentNumber = input.documentNumber.trim()
  if (!documentNumber) throw new Error('Укажите номер документа Честного знака')
  const documentDate = new Date(`${input.documentDate}T00:00:00.000Z`)
  if (Number.isNaN(documentDate.getTime())) throw new Error('Укажите дату документа')

  return prisma.$transaction(async (tx) => {
    const task = await tx.kizComplianceTask.findFirstOrThrow({
      where: { id: input.taskId, wbAccountId: input.wbAccountId },
      include: { kizUnit: true },
    })
    if (task.status === 'CANCELED') throw new Error('Операция отменена')
    if (task.status === 'CONFIRMED') return { id: task.id, alreadyConfirmed: true }

    const confirmed = await confirmComplianceTask(tx, task, {
      documentNumber,
      documentDate,
      userId: input.userId,
    })
    return { id: task.id, alreadyConfirmed: !confirmed }
  })
}

export async function confirmKizComplianceBatch(input: {
  wbAccountId: string
  batchId: string
  documentNumber: string
  documentDate: string
  userId: string
}) {
  const documentNumber = input.documentNumber.trim()
  if (!documentNumber) throw new Error('Укажите номер документа Честного знака')
  const documentDate = new Date(`${input.documentDate}T00:00:00.000Z`)
  if (Number.isNaN(documentDate.getTime())) throw new Error('Укажите дату документа')

  const batch = await prisma.kizOperationBatch.findFirstOrThrow({
    where: { id: input.batchId, wbAccountId: input.wbAccountId },
    select: {
      id: true,
      tasks: {
        where: { status: { in: ['OPEN', 'EXPORTED'] } },
        select: { id: true },
      },
    },
  })
  if (!batch.tasks.length) {
    return { batchId: batch.id, confirmed: 0, alreadyProcessed: true }
  }

  let confirmed = 0
  for (let index = 0; index < batch.tasks.length; index += 200) {
    const taskIds = batch.tasks.slice(index, index + 200).map((task) => task.id)
    confirmed += await prisma.$transaction(async (tx) => {
      const tasks = await tx.kizComplianceTask.findMany({
        where: {
          id: { in: taskIds },
          wbAccountId: input.wbAccountId,
          batchId: input.batchId,
          status: { in: ['OPEN', 'EXPORTED'] },
        },
        include: { kizUnit: true },
      })
      let chunkConfirmed = 0
      for (const task of tasks) {
        const taskConfirmed = await confirmComplianceTask(tx, task, {
          documentNumber,
          documentDate,
          userId: input.userId,
        })
        if (taskConfirmed) chunkConfirmed += 1
      }
      return chunkConfirmed
    }, { timeout: 120_000 })
  }

  return { batchId: batch.id, confirmed, alreadyProcessed: false }
}

type ComplianceTaskForConfirmation = Prisma.KizComplianceTaskGetPayload<{
  include: { kizUnit: true }
}>

async function confirmComplianceTask(
  tx: Prisma.TransactionClient,
  task: ComplianceTaskForConfirmation,
  input: { documentNumber: string; documentDate: Date; userId: string },
) {
  const claimed = await tx.kizComplianceTask.updateMany({
    where: { id: task.id, status: { in: ['OPEN', 'EXPORTED'] } },
    data: {
      status: 'CONFIRMED',
      documentNumber: input.documentNumber,
      documentDate: input.documentDate,
      confirmedAt: new Date(),
      confirmedById: input.userId,
    },
  })
  if (!claimed.count) return false

  const circulationState =
    task.type === 'WITHDRAWAL_REMOTE_SALE' || task.type === 'WITHDRAWAL_B2B'
      ? 'WITHDRAWN'
      : task.type === 'COMMISSIONING' || task.type === 'RETURN_TO_CIRCULATION'
        ? 'IN_CIRCULATION'
        : task.kizUnit.circulationState
  await tx.kizUnit.update({
    where: { id: task.kizUnitId },
    data: {
      circulationState,
      ...(task.type === 'RETURN_TO_CIRCULATION'
        ? { physicalState: 'IN_STOCK', currentOrderId: null }
        : {}),
    },
  })
  if (task.type === 'RETURN_TO_CIRCULATION' && task.kizUnit.assortmentItemId) {
    await createMovement(tx, {
      itemId: task.kizUnit.assortmentItemId,
      orderId: task.orderId,
      kizUnitId: task.kizUnitId,
      type: 'RETURN_RECEIVED',
      onHandDelta: 1,
      reservedDelta: 0,
      source: 'chestny_znak_confirmation',
      idempotencyKey: `task:${task.id}:return-receipt`,
      userId: input.userId,
    })
  }
  await tx.kizEvent.create({
    data: {
      kizUnitId: task.kizUnitId,
      orderId: task.orderId,
      userId: input.userId,
      type: 'COMPLIANCE_CONFIRMED',
      details: { taskType: task.type, documentNumber: input.documentNumber },
    },
  })
  return true
}

export async function setFbsWarehouseWriteEnabled(input: {
  wbAccountId: string
  warehouseId: string
  enabled: boolean
}) {
  return prisma.fbsSellerWarehouse.update({
    where: { id: input.warehouseId, wbAccountId: input.wbAccountId },
    data: { writeEnabled: input.enabled },
    select: { id: true, writeEnabled: true },
  })
}

export async function attachAssignedKizToWb(input: {
  wbAccountId: string
  orderId: string
  userId: string
}) {
  const order = await prisma.fbsOrder.findFirstOrThrow({
    where: { id: input.orderId, wbAccountId: input.wbAccountId },
    include: {
      warehouse: true,
      kizUnits: { take: 1 },
    },
  })
  if (!order.warehouse?.writeEnabled) throw new Error('Запись в WB для этого склада отключена')
  const unit = order.kizUnits[0]
  if (!unit) throw new Error('Сначала назначьте КИЗ заказу')
  const idempotencyKey = `order:${order.id}:kiz:${unit.codeHash}`

  return runAuditedFbsWrite({
    wbAccountId: input.wbAccountId,
    userId: input.userId,
    warehouseId: order.warehouseId,
    orderId: order.id,
    kind: 'ATTACH_KIZ',
    idempotencyKey,
    requestSummary: {
      orderExternalId: order.externalOrderId.toString(),
      kizMasked: unit.maskedCode,
    },
    execute: async (client) => {
      await attachKizToFbsOrder(
        client,
        order.externalOrderId.toString(),
        decrypt(unit.encryptedCode),
      )
      await prisma.$transaction([
        prisma.kizUnit.update({
          where: { id: unit.id },
          data: { wbValidationStatus: 'VALID' },
        }),
        prisma.kizEvent.create({
          data: {
            kizUnitId: unit.id,
            orderId: order.id,
            userId: input.userId,
            type: 'ATTACHED_TO_WB',
          },
        }),
      ])
      return { orderExternalId: order.externalOrderId.toString(), attached: true }
    },
  })
}

export async function updateFbsOrderStatusInWb(input: {
  wbAccountId: string
  orderId: string
  status: 'confirm' | 'complete' | 'cancel'
  userId: string
}) {
  const order = await prisma.fbsOrder.findFirstOrThrow({
    where: { id: input.orderId, wbAccountId: input.wbAccountId },
    include: {
      warehouse: true,
      assortmentItem: { select: { requiresKiz: true } },
      kizUnits: { select: { id: true, circulationState: true } },
    },
  })
  if (!order.warehouse?.writeEnabled) throw new Error('Запись в WB для этого склада отключена')
  if (
    input.status === 'complete' &&
    !isOrderMetadataReady({
      requiresKiz: Boolean(order.assortmentItem?.requiresKiz),
      hasKiz: order.kizUnits.length > 0,
      metadataStatus: order.metadataStatus,
    })
  ) {
    throw new Error('Передача заблокирована: обязательные метаданные или КИЗ не готовы')
  }
  if (
    input.status === 'complete' &&
    order.assortmentItem?.requiresKiz &&
    order.kizUnits[0]?.circulationState !== 'IN_CIRCULATION'
  ) {
    throw new Error('Передача заблокирована: КИЗ ещё не подтверждён как введённый в оборот')
  }

  return runAuditedFbsWrite({
    wbAccountId: input.wbAccountId,
    userId: input.userId,
    warehouseId: order.warehouseId,
    orderId: order.id,
    kind: 'SET_ORDER_STATUS',
    idempotencyKey: `order:${order.id}:status:${input.status}`,
    requestSummary: {
      orderExternalId: order.externalOrderId.toString(),
      status: input.status,
    },
    execute: async (client) => {
      await setFbsOrderSupplierStatus(client, order.externalOrderId.toString(), input.status)
      return { orderExternalId: order.externalOrderId.toString(), status: input.status }
    },
  })
}

export async function publishFbsWarehouseStocks(input: {
  wbAccountId: string
  warehouseId: string
  userId: string
}) {
  const warehouse = await prisma.fbsSellerWarehouse.findFirstOrThrow({
    where: { id: input.warehouseId, wbAccountId: input.wbAccountId },
    include: { assortmentItems: { where: { isEnabled: true } } },
  })
  if (!warehouse.writeEnabled) throw new Error('Запись в WB для этого склада отключена')
  const stocks = warehouse.assortmentItems.map((item) => ({
    chrtId: item.chrtId,
    amount: Math.max(0, item.onHand - item.reserved),
  }))
  if (!stocks.length) throw new Error('На складе нет активных FBS-артикулов')
  const digest = createHash('sha256').update(JSON.stringify(stocks)).digest('hex')

  return runAuditedFbsWrite({
    wbAccountId: input.wbAccountId,
    userId: input.userId,
    warehouseId: warehouse.id,
    kind: 'PUBLISH_STOCKS',
    idempotencyKey: `warehouse:${warehouse.id}:stocks:${digest}`,
    requestSummary: {
      warehouseExternalId: warehouse.externalId.toString(),
      itemCount: stocks.length,
      totalAvailable: stocks.reduce((sum, row) => sum + row.amount, 0),
    },
    execute: async (client) => {
      await publishFbsStocks(client, warehouse.externalId.toString(), stocks)
      return { warehouseExternalId: warehouse.externalId.toString(), published: stocks.length }
    },
  })
}

export async function moveOrderToFbsSupply(input: {
  wbAccountId: string
  orderId: string
  supplyId: string
  userId: string
}) {
  const [order, supply] = await Promise.all([
    prisma.fbsOrder.findFirstOrThrow({
      where: { id: input.orderId, wbAccountId: input.wbAccountId },
      include: { warehouse: true },
    }),
    prisma.fbsSupply.findFirstOrThrow({
      where: { id: input.supplyId, wbAccountId: input.wbAccountId },
    }),
  ])
  if (!order.warehouse?.writeEnabled) throw new Error('Запись в WB для этого склада отключена')
  return runAuditedFbsWrite({
    wbAccountId: input.wbAccountId,
    userId: input.userId,
    warehouseId: order.warehouseId,
    orderId: order.id,
    supplyId: supply.id,
    kind: 'MOVE_TO_SUPPLY',
    idempotencyKey: `order:${order.id}:supply:${supply.id}`,
    requestSummary: {
      orderExternalId: order.externalOrderId.toString(),
      supplyExternalId: supply.externalId,
    },
    execute: async (client) => {
      await moveFbsOrderToSupply(
        client,
        supply.externalId,
        order.externalOrderId.toString(),
      )
      return { moved: true }
    },
  })
}

export async function closeFbsSupplyInWb(input: {
  wbAccountId: string
  supplyId: string
  userId: string
}) {
  const supply = await prisma.fbsSupply.findFirstOrThrow({
    where: { id: input.supplyId, wbAccountId: input.wbAccountId },
    include: { warehouse: true },
  })
  if (!supply.warehouse?.writeEnabled) throw new Error('Запись в WB для этого склада отключена')
  return runAuditedFbsWrite({
    wbAccountId: input.wbAccountId,
    userId: input.userId,
    warehouseId: supply.warehouseId,
    supplyId: supply.id,
    kind: 'CLOSE_SUPPLY',
    idempotencyKey: `supply:${supply.id}:close`,
    requestSummary: { supplyExternalId: supply.externalId },
    execute: async (client) => {
      await closeFbsSupply(client, supply.externalId)
      return { closed: true }
    },
  })
}

async function runAuditedFbsWrite<T>(input: {
  wbAccountId: string
  userId: string
  warehouseId?: string | null
  assortmentItemId?: string | null
  orderId?: string | null
  supplyId?: string | null
  kind: 'ATTACH_KIZ' | 'SET_ORDER_STATUS' | 'MOVE_TO_SUPPLY' | 'CLOSE_SUPPLY' | 'PUBLISH_STOCKS'
  idempotencyKey: string
  requestSummary: Prisma.InputJsonValue
  execute: (client: WbApiClient) => Promise<T>
}) {
  const existing = await prisma.fbsActionLog.findUnique({
    where: {
      wbAccountId_kind_idempotencyKey: {
        wbAccountId: input.wbAccountId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
      },
    },
  })
  if (existing?.status === 'SUCCEEDED') {
    return { repeated: true, actionLogId: existing.id }
  }
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: input.wbAccountId },
    select: { apiKey: true },
  })
  const log = await prisma.fbsActionLog.upsert({
    where: {
      wbAccountId_kind_idempotencyKey: {
        wbAccountId: input.wbAccountId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      wbAccountId: input.wbAccountId,
      userId: input.userId,
      warehouseId: input.warehouseId,
      assortmentItemId: input.assortmentItemId,
      orderId: input.orderId,
      supplyId: input.supplyId,
      kind: input.kind,
      status: 'RUNNING',
      idempotencyKey: input.idempotencyKey,
      requestSummary: input.requestSummary,
      startedAt: new Date(),
    },
    update: {
      status: 'RUNNING',
      error: null,
      startedAt: new Date(),
      finishedAt: null,
    },
  })

  try {
    const result = await input.execute(new WbApiClient(decrypt(account.apiKey)))
    await prisma.fbsActionLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCEEDED',
        result: sanitizeFbsMetadata(result) as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    })
    return { repeated: false, actionLogId: log.id, result }
  } catch (error) {
    const message = safeFbsWriteError(error)
    await prisma.fbsActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: message, finishedAt: new Date() },
    })
    throw new Error(message)
  }
}

function safeFbsWriteError(error: unknown) {
  if (error instanceof WbApiError) {
    return `WB API отклонил операцию: HTTP ${error.status}, домен ${error.domain}`
  }
  return error instanceof Error ? error.message.replace(/01\d{14}21\S+/g, '[КИЗ скрыт]') : 'Ошибка операции FBS'
}

function cryptoRandomId() {
  return randomUUID()
}
