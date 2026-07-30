import { createHash } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import {
  extractFbsSgtinCodes,
  getWbKizGtinValidationStatus,
  prepareKizForStorage,
} from '@/lib/fbs/kiz'
import {
  deriveFbsTransition,
  assertInventoryBalance,
  isFbsOrderCanceledBeforeHandoff,
  isFbsPostHandoffReturnStatus,
} from '@/lib/fbs/state-machine'
import { WbApiClient } from '@/lib/wb-api/client'
import {
  fetchFbsMarkingReport,
  fetchFbsOrderMeta,
  fetchFbsOrdersPeriod,
  fetchFbsOrderStatuses,
  fetchFbsStocks,
  fetchFbsSupplies,
  fetchFbsWarehouses,
  fetchNewFbsOrders,
} from '@/lib/wb-api/fbs'
import type { WbFbsOrder, WbFbsOrderMeta, WbFbsOrderStatus } from '@/types/fbs'

type Tx = Prisma.TransactionClient

interface WbKizIngestionStats {
  received: number
  created: number
  assigned: number
  alreadyAssigned: number
  released: number
  rejected: number
  conflicts: number
  gtinMismatches: number
}

function emptyWbKizIngestionStats(): WbKizIngestionStats {
  return {
    received: 0,
    created: 0,
    assigned: 0,
    alreadyAssigned: 0,
    released: 0,
    rejected: 0,
    conflicts: 0,
    gtinMismatches: 0,
  }
}

function addWbKizIngestionStats(
  target: WbKizIngestionStats,
  source: WbKizIngestionStats,
) {
  for (const key of Object.keys(target) as Array<keyof WbKizIngestionStats>) {
    target[key] += source[key]
  }
}

function optionalDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function optionalString(value: string | number | null | undefined) {
  return value == null ? null : String(value)
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  const sanitized = sanitizeFbsMetadata(value)
  return sanitized === null ? undefined : sanitized as Prisma.InputJsonValue
}

export function sanitizeFbsMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeFbsMetadata)
  if (!value || typeof value !== 'object') return value ?? null

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      const normalizedKey = key.toLowerCase()
      if (
        normalizedKey.includes('sgtin') ||
        normalizedKey === 'kiz' ||
        normalizedKey.includes('datamatrix')
      ) {
        return [key, nested == null ? null : '[REDACTED]']
      }
      return [key, sanitizeFbsMetadata(nested)]
    }),
  )
}

function requiresKizFromMeta(...values: unknown[]): boolean {
  return values.some((value) => {
    if (!value) return false
    const serialized = JSON.stringify(value).toLowerCase()
    return serialized.includes('sgtin') || serialized.includes('kiz') || serialized.includes('datamatrix')
  })
}

function eventKey(input: {
  supplierStatus: string
  wbStatus: string
  supplyExternalId?: string | null
  metadata?: unknown
}) {
  return createHash('sha256')
    .update(JSON.stringify(sanitizeFbsMetadata(input)))
    .digest('hex')
}

async function createMovement(
  tx: Tx,
  input: {
    itemId: string
    orderId?: string | null
    kizUnitId?: string | null
    type:
      | 'RESERVE'
      | 'RELEASE'
      | 'SHIPMENT'
      | 'RETURN_RECEIVED'
      | 'ADJUSTMENT'
      | 'RECEIPT'
      | 'QUARANTINE'
      | 'WRITE_OFF'
      | 'OPENING'
    onHandDelta: number
    reservedDelta: number
    source: string
    idempotencyKey: string
    userId?: string | null
    note?: string | null
  },
) {
  const existing = await tx.fbsInventoryMovement.findUnique({
    where: {
      itemId_idempotencyKey: {
        itemId: input.itemId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: { id: true },
  })
  if (existing) return false

  const item = await tx.fbsAssortmentItem.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { onHand: true, reserved: true },
  })
  const onHand = item.onHand + input.onHandDelta
  const reserved = item.reserved + input.reservedDelta
  assertInventoryBalance(onHand, reserved)

  await tx.fbsAssortmentItem.update({
    where: { id: input.itemId },
    data: { onHand, reserved },
  })
  await tx.fbsInventoryMovement.create({
    data: {
      itemId: input.itemId,
      orderId: input.orderId,
      kizUnitId: input.kizUnitId,
      userId: input.userId,
      type: input.type,
      onHandDelta: input.onHandDelta,
      reservedDelta: input.reservedDelta,
      balanceAfterOnHand: onHand,
      balanceAfterReserved: reserved,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
    },
  })
  return true
}

async function upsertWarehouses(wbAccountId: string, client: WbApiClient) {
  const warehouses = await fetchFbsWarehouses(client)
  for (const warehouse of warehouses) {
    await prisma.fbsSellerWarehouse.upsert({
      where: {
        wbAccountId_externalId: {
          wbAccountId,
          externalId: BigInt(warehouse.id),
        },
      },
      create: {
        wbAccountId,
        externalId: BigInt(warehouse.id),
        name: warehouse.name,
        officeId: warehouse.officeId == null ? null : BigInt(warehouse.officeId),
        deliveryType: optionalString(warehouse.deliveryType),
        cargoType: optionalString(warehouse.cargoType),
        lastSyncedAt: new Date(),
      },
      update: {
        name: warehouse.name,
        officeId: warehouse.officeId == null ? null : BigInt(warehouse.officeId),
        deliveryType: optionalString(warehouse.deliveryType),
        cargoType: optionalString(warehouse.cargoType),
        lastSyncedAt: new Date(),
      },
    })
  }
  return warehouses.length
}

async function upsertSupplies(wbAccountId: string, client: WbApiClient) {
  const [supplies, warehouses] = await Promise.all([
    fetchFbsSupplies(client),
    prisma.fbsSellerWarehouse.findMany({
      where: { wbAccountId },
      select: { id: true, externalId: true },
    }),
  ])
  const warehouseMap = new Map(warehouses.map((row) => [row.externalId.toString(), row.id]))

  for (const supply of supplies) {
    const warehouseId =
      supply.warehouseId == null ? null : warehouseMap.get(String(supply.warehouseId)) ?? null
    await prisma.fbsSupply.upsert({
      where: { wbAccountId_externalId: { wbAccountId, externalId: supply.id } },
      create: {
        wbAccountId,
        warehouseId,
        externalId: supply.id,
        name: supply.name ?? null,
        done: Boolean(supply.done),
        isB2b: Boolean(supply.isB2b),
        cargoType: optionalString(supply.cargoType),
        crossBorderType: optionalString(supply.crossBorderType),
        createdAtWb: optionalDate(supply.createdAt),
        closedAt: optionalDate(supply.closedAt),
      },
      update: {
        warehouseId,
        name: supply.name ?? null,
        done: Boolean(supply.done),
        isB2b: Boolean(supply.isB2b),
        cargoType: optionalString(supply.cargoType),
        crossBorderType: optionalString(supply.crossBorderType),
        createdAtWb: optionalDate(supply.createdAt),
        closedAt: optionalDate(supply.closedAt),
        fetchedAt: new Date(),
      },
    })
  }
  return supplies.length
}

async function resolveAssortment(
  tx: Tx,
  input: {
    wbAccountId: string
    warehouseId: string | null
    order: WbFbsOrder
    requiresKiz: boolean
  },
) {
  if (!input.warehouseId) return null

  const barcode = input.order.skus?.[0] ?? ''
  const size = await tx.productSize.findFirst({
    where: {
      product: { wbAccountId: input.wbAccountId },
      OR: [
        { chrtId: input.order.chrtId },
        ...(barcode ? [{ barcode }] : []),
      ],
    },
    select: { id: true, productId: true, barcode: true, product: { select: { vendorCode: true } } },
  })

  return tx.fbsAssortmentItem.upsert({
    where: {
      warehouseId_chrtId: {
        warehouseId: input.warehouseId,
        chrtId: input.order.chrtId,
      },
    },
    create: {
      wbAccountId: input.wbAccountId,
      warehouseId: input.warehouseId,
      productId: size?.productId ?? null,
      productSizeId: size?.id ?? null,
      nmId: input.order.nmId,
      chrtId: input.order.chrtId,
      barcode: barcode || size?.barcode || '',
      vendorCode: input.order.article ?? size?.product.vendorCode ?? null,
      requiresKiz: input.requiresKiz,
    },
    update: {
      productId: size?.productId,
      productSizeId: size?.id,
      nmId: input.order.nmId,
      barcode: barcode || size?.barcode || undefined,
      vendorCode: input.order.article ?? size?.product.vendorCode ?? undefined,
      ...(input.requiresKiz ? { requiresKiz: true } : {}),
    },
  })
}

async function ensureWbKizAttachmentEvent(tx: Tx, kizUnitId: string, orderId: string) {
  const existingEvent = await tx.kizEvent.findFirst({
    where: { kizUnitId, orderId, type: 'ATTACHED_TO_WB' },
    select: { id: true },
  })
  if (existingEvent) return
  await tx.kizEvent.create({
    data: {
      kizUnitId,
      orderId,
      type: 'ATTACHED_TO_WB',
      details: { source: 'wb_fbs_metadata_readback' },
    },
  })
}

async function ingestWbOrderKiz(
  tx: Tx,
  input: {
    wbAccountId: string
    orderId: string
    warehouseId: string | null
    assortment: {
      id: string
      productSizeId: string | null
      markingGtin: string | null
    } | null
    rawCodes: string[]
    attachToOrder: boolean
  },
): Promise<WbKizIngestionStats> {
  const stats = emptyWbKizIngestionStats()
  stats.received = input.rawCodes.length
  const seenHashes = new Set<string>()

  for (const rawCode of input.rawCodes) {
    let prepared: ReturnType<typeof prepareKizForStorage>
    try {
      prepared = prepareKizForStorage(rawCode)
    } catch {
      stats.rejected += 1
      continue
    }
    if (seenHashes.has(prepared.codeHash)) continue
    seenHashes.add(prepared.codeHash)

    const validationStatus = getWbKizGtinValidationStatus(
      input.assortment?.markingGtin,
      prepared.parsed.gtin,
    )
    const gtinMismatch = validationStatus === 'GTIN_MISMATCH'
    if (gtinMismatch) stats.gtinMismatches += 1

    const existing = await tx.kizUnit.findUnique({
      where: {
        wbAccountId_codeHash: {
          wbAccountId: input.wbAccountId,
          codeHash: prepared.codeHash,
        },
      },
    })

    if (existing?.currentOrderId && existing.currentOrderId !== input.orderId) {
      stats.conflicts += 1
      await tx.kizUnit.update({
        where: { id: existing.id },
        data: { wbValidationStatus: 'ORDER_CONFLICT' },
      })
      continue
    }

    if (
      input.attachToOrder &&
      existing &&
      !existing.currentOrderId &&
      !['IN_STOCK', 'RESERVED'].includes(existing.physicalState)
    ) {
      stats.conflicts += 1
      await tx.kizUnit.update({
        where: { id: existing.id },
        data: { wbValidationStatus: 'STATE_CONFLICT' },
      })
      continue
    }

    if (!existing) {
      const unit = await tx.kizUnit.create({
        data: {
          wbAccountId: input.wbAccountId,
          warehouseId: input.warehouseId,
          assortmentItemId: input.assortment?.id ?? null,
          productSizeId: input.assortment?.productSizeId ?? null,
          currentOrderId: input.attachToOrder ? input.orderId : null,
          encryptedCode: prepared.encryptedCode,
          codeHash: prepared.codeHash,
          maskedCode: prepared.maskedCode,
          gtin: prepared.parsed.gtin,
          serialMasked: prepared.serialMasked,
          physicalState: input.attachToOrder ? 'RESERVED' : 'IN_STOCK',
          circulationState: 'UNKNOWN',
          wbValidationStatus: validationStatus,
        },
      })
      stats.created += 1
      await tx.kizEvent.create({
        data: {
          kizUnitId: unit.id,
          orderId: input.orderId,
          type: 'IMPORTED',
          details: {
            source: 'wb_fbs_metadata',
            validationStatus,
          },
        },
      })
      if (input.attachToOrder) {
        stats.assigned += 1
        await tx.kizEvent.create({
          data: {
            kizUnitId: unit.id,
            orderId: input.orderId,
            type: 'ASSIGNED',
            details: { source: 'wb_fbs_metadata' },
          },
        })
        await ensureWbKizAttachmentEvent(tx, unit.id, input.orderId)
      }
      continue
    }

    if (!input.attachToOrder) {
      if (existing.currentOrderId === input.orderId) {
        await tx.kizUnit.update({
          where: { id: existing.id },
          data: {
            currentOrderId: null,
            physicalState: 'IN_STOCK',
            wbValidationStatus: validationStatus,
          },
        })
        stats.released += 1
        await tx.kizEvent.create({
          data: {
            kizUnitId: existing.id,
            orderId: input.orderId,
            type: 'UNASSIGNED',
            details: {
              source: 'wb_fbs_metadata',
              reason: 'order_canceled_before_handoff',
            },
          },
        })
      } else {
        await tx.kizUnit.update({
          where: { id: existing.id },
          data: {
            warehouseId: input.warehouseId ?? existing.warehouseId,
            assortmentItemId: input.assortment?.id ?? existing.assortmentItemId,
            productSizeId: input.assortment?.productSizeId ?? existing.productSizeId,
            wbValidationStatus: validationStatus,
          },
        })
      }
      continue
    }

    if (existing.currentOrderId === input.orderId) {
      stats.alreadyAssigned += 1
      await tx.kizUnit.update({
        where: { id: existing.id },
        data: {
          warehouseId: input.warehouseId ?? existing.warehouseId,
          assortmentItemId: input.assortment?.id ?? existing.assortmentItemId,
          productSizeId: input.assortment?.productSizeId ?? existing.productSizeId,
          wbValidationStatus: validationStatus,
        },
      })
      await ensureWbKizAttachmentEvent(tx, existing.id, input.orderId)
      continue
    }

    await tx.kizUnit.update({
      where: { id: existing.id },
      data: {
        currentOrderId: input.orderId,
        warehouseId: input.warehouseId ?? existing.warehouseId,
        assortmentItemId: input.assortment?.id ?? existing.assortmentItemId,
        productSizeId: input.assortment?.productSizeId ?? existing.productSizeId,
        physicalState: 'RESERVED',
        wbValidationStatus: validationStatus,
      },
    })
    stats.assigned += 1
    await tx.kizEvent.create({
      data: {
        kizUnitId: existing.id,
        orderId: input.orderId,
        type: 'ASSIGNED',
        details: { source: 'wb_fbs_metadata' },
      },
    })
    await ensureWbKizAttachmentEvent(tx, existing.id, input.orderId)
  }

  return stats
}

async function ensureWithdrawalTask(
  tx: Tx,
  input: {
    wbAccountId: string
    orderId: string
    isB2b: boolean
    kizUnit: { id: string; circulationState: string }
  },
) {
  if (input.kizUnit.circulationState === 'WITHDRAWN') return
  const type = input.isB2b ? 'WITHDRAWAL_B2B' : 'WITHDRAWAL_REMOTE_SALE'
  const existingTask = await tx.kizComplianceTask.findFirst({
    where: {
      orderId: input.orderId,
      kizUnitId: input.kizUnit.id,
      type,
      status: { not: 'CANCELED' },
    },
    select: { id: true },
  })
  if (existingTask) return

  await tx.kizComplianceTask.create({
    data: {
      wbAccountId: input.wbAccountId,
      kizUnitId: input.kizUnit.id,
      orderId: input.orderId,
      type,
      idempotencyKey: `order:${input.orderId}:kiz:${input.kizUnit.id}:${type}`,
      dueAt: new Date(),
    },
  })
  await tx.kizUnit.update({
    where: { id: input.kizUnit.id },
    data: { circulationState: 'WITHDRAWAL_REQUIRED' },
  })
  await tx.kizEvent.create({
    data: {
      kizUnitId: input.kizUnit.id,
      orderId: input.orderId,
      type: 'SALE_DETECTED',
      details: { source: 'wb_order_status' },
    },
  })
}

async function applyOrderState(
  wbAccountId: string,
  order: WbFbsOrder,
  status: WbFbsOrderStatus | undefined,
  metadata: WbFbsOrderMeta | undefined,
) {
  return prisma.$transaction(async (tx) => {
    const externalOrderId = BigInt(order.id)
    const existing = await tx.fbsOrder.findUnique({
      where: { wbAccountId_externalOrderId: { wbAccountId, externalOrderId } },
      include: {
        assortmentItem: { select: { requiresKiz: true } },
        kizUnits: { select: { id: true }, take: 1 },
      },
    })

    const warehouse = order.warehouseId == null
      ? null
      : await tx.fbsSellerWarehouse.findUnique({
          where: {
            wbAccountId_externalId: {
              wbAccountId,
              externalId: BigInt(order.warehouseId),
            },
          },
          select: { id: true },
        })
    const requiredMeta = metadata?.requiredMeta ?? order.requiredMeta
    const optionalMeta = metadata?.optionalMeta ?? order.optionalMeta
    const requiresKiz =
      Boolean(existing?.assortmentItem?.requiresKiz) ||
      requiresKizFromMeta(requiredMeta, optionalMeta, metadata?.meta)
    const assortment = await resolveAssortment(tx, {
      wbAccountId,
      warehouseId: warehouse?.id ?? existing?.warehouseId ?? null,
      order,
      requiresKiz,
    })
    const supplyExternalId = order.supplyId ?? null
    const supply = supplyExternalId
      ? await tx.fbsSupply.findUnique({
          where: { wbAccountId_externalId: { wbAccountId, externalId: supplyExternalId } },
          select: { id: true },
        })
      : null
    const supplierStatus = status?.supplierStatus ?? existing?.supplierStatus ?? 'new'
    const wbStatus = status?.wbStatus ?? existing?.wbStatus ?? 'waiting'
    const rawKizCodes = extractFbsSgtinCodes(metadata?.meta)
    const sanitizedMeta = metadata?.meta
      ? jsonValue(metadata.meta)
      : existing?.metadataStatus as Prisma.InputJsonValue | undefined

    const saved = await tx.fbsOrder.upsert({
      where: { wbAccountId_externalOrderId: { wbAccountId, externalOrderId } },
      create: {
        wbAccountId,
        externalOrderId,
        rid: order.rid ?? null,
        orderUid: order.orderUid ?? null,
        warehouseId: warehouse?.id ?? null,
        assortmentItemId: assortment?.id ?? null,
        supplyId: supply?.id ?? null,
        nmId: order.nmId,
        chrtId: order.chrtId,
        barcode: order.skus?.[0] ?? assortment?.barcode ?? '',
        vendorCode: order.article ?? assortment?.vendorCode ?? null,
        createdAtWb: new Date(order.createdAt),
        deliveryDate: optionalDate(order.deliveryDate),
        priceRaw: order.price ?? null,
        convertedPriceRaw: order.convertedPrice ?? null,
        currencyCode: order.currencyCode ?? null,
        isB2b: Boolean(order.options?.isB2b ?? order.isB2b),
        requiredMeta: jsonValue(requiredMeta),
        optionalMeta: jsonValue(optionalMeta),
        metadataStatus: sanitizedMeta,
        supplierStatus,
        wbStatus,
      },
      update: {
        rid: order.rid ?? undefined,
        orderUid: order.orderUid ?? undefined,
        warehouseId: warehouse?.id ?? undefined,
        assortmentItemId: assortment?.id ?? undefined,
        supplyId: supply?.id ?? undefined,
        deliveryDate: optionalDate(order.deliveryDate),
        priceRaw: order.price ?? undefined,
        convertedPriceRaw: order.convertedPrice ?? undefined,
        currencyCode: order.currencyCode ?? undefined,
        isB2b: Boolean(order.options?.isB2b ?? order.isB2b),
        requiredMeta: jsonValue(requiredMeta),
        optionalMeta: jsonValue(optionalMeta),
        metadataStatus: sanitizedMeta,
        supplierStatus,
        wbStatus,
        fetchedAt: new Date(),
      },
    })

    const canceledBeforeHandoff = isFbsOrderCanceledBeforeHandoff({
      supplierStatus,
      wbStatus,
      shipmentApplied: existing?.shipmentApplied ?? false,
    })
    const kizStats = await ingestWbOrderKiz(tx, {
      wbAccountId,
      orderId: saved.id,
      warehouseId: saved.warehouseId,
      assortment: assortment
        ? {
            id: assortment.id,
            productSizeId: assortment.productSizeId,
            markingGtin: assortment.markingGtin,
          }
        : null,
      rawCodes: rawKizCodes,
      attachToOrder: !canceledBeforeHandoff,
    })
    const hasKiz = Boolean(
      await tx.kizUnit.findFirst({ where: { currentOrderId: saved.id }, select: { id: true } }),
    )
    const actions = deriveFbsTransition(
      existing
        ? {
            supplierStatus: existing.supplierStatus,
            wbStatus: existing.wbStatus,
            reservationApplied: existing.reservationApplied,
            shipmentApplied: existing.shipmentApplied,
            hasKiz: existing.kizUnits.length > 0,
            requiresKiz: Boolean(existing.assortmentItem?.requiresKiz),
          }
        : null,
      {
        supplierStatus,
        wbStatus,
        reservationApplied: existing?.reservationApplied ?? false,
        shipmentApplied: existing?.shipmentApplied ?? false,
        hasKiz,
        requiresKiz: assortment?.requiresKiz ?? requiresKiz,
      },
      { enforceShipmentGuard: false },
    )

    let reservationApplied = existing?.reservationApplied ?? false
    let shipmentApplied = existing?.shipmentApplied ?? false
    let shortage = false
    let assignedKizUnits = await tx.kizUnit.findMany({
      where: { currentOrderId: saved.id },
      select: { id: true, circulationState: true, physicalState: true },
    })

    for (const action of actions) {
      if (action === 'RESERVE' && assortment) {
        try {
          const moved = await createMovement(tx, {
            itemId: assortment.id,
            orderId: saved.id,
            type: 'RESERVE',
            onHandDelta: 0,
            reservedDelta: 1,
            source: 'wb_order_status',
            idempotencyKey: `order:${externalOrderId}:reserve`,
          })
          if (moved || existing?.reservationApplied) reservationApplied = true
        } catch (error) {
          if (error instanceof Error && error.message.includes('превышать')) {
            shortage = true
          } else {
            throw error
          }
        }
      }

      if (action === 'RELEASE' && assortment) {
        await createMovement(tx, {
          itemId: assortment.id,
          orderId: saved.id,
          type: 'RELEASE',
          onHandDelta: 0,
          reservedDelta: -1,
          source: 'wb_order_status',
          idempotencyKey: `order:${externalOrderId}:release`,
        })
        reservationApplied = false
      }

      if (action === 'SHIP' && assortment) {
        const reservedDelta = reservationApplied ? -1 : 0
        try {
          await createMovement(tx, {
            itemId: assortment.id,
            orderId: saved.id,
            kizUnitId: assignedKizUnits[0]?.id,
            type: 'SHIPMENT',
            onHandDelta: -1,
            reservedDelta,
            source: 'wb_order_status',
            idempotencyKey: `order:${externalOrderId}:shipment`,
          })
          reservationApplied = false
        } catch (error) {
          if (error instanceof Error && error.message.includes('отрицательным')) {
            shortage = true
          } else {
            throw error
          }
        }
        shipmentApplied = true
      }

      if (action === 'UNASSIGN_KIZ') {
        for (const assignedKiz of assignedKizUnits) {
          await tx.kizUnit.update({
            where: { id: assignedKiz.id },
            data: { currentOrderId: null, physicalState: 'IN_STOCK' },
          })
          await tx.kizEvent.create({
            data: {
              kizUnitId: assignedKiz.id,
              orderId: saved.id,
              type: 'UNASSIGNED',
              details: { reason: 'order_canceled_before_handoff' },
            },
          })
        }
        assignedKizUnits = []
      }

      if (action === 'MARK_HANDED_OVER') {
        for (const assignedKiz of assignedKizUnits) {
          await tx.kizUnit.update({
            where: { id: assignedKiz.id },
            data: { physicalState: 'HANDED_OVER' },
          })
          await tx.kizEvent.create({
            data: { kizUnitId: assignedKiz.id, orderId: saved.id, type: 'HANDED_OVER' },
          })
        }
      }

      if (action === 'CREATE_WITHDRAWAL_TASK') {
        for (const assignedKiz of assignedKizUnits) {
          await ensureWithdrawalTask(tx, {
            wbAccountId,
            orderId: saved.id,
            isB2b: saved.isB2b,
            kizUnit: assignedKiz,
          })
        }
      }

      if (action === 'MARK_RETURN_EXPECTED') {
        for (const assignedKiz of assignedKizUnits) {
          await tx.kizUnit.update({
            where: { id: assignedKiz.id },
            data: { physicalState: 'RETURN_EXPECTED' },
          })
          await tx.kizEvent.create({
            data: { kizUnitId: assignedKiz.id, orderId: saved.id, type: 'RETURN_EXPECTED' },
          })
        }
      }
    }

    assignedKizUnits = await tx.kizUnit.findMany({
      where: { currentOrderId: saved.id },
      select: { id: true, circulationState: true, physicalState: true },
    })
    if (shipmentApplied) {
      const returnExpected = isFbsPostHandoffReturnStatus(wbStatus)
      const desiredState = returnExpected ? 'RETURN_EXPECTED' : 'HANDED_OVER'
      const eventType = returnExpected ? 'RETURN_EXPECTED' : 'HANDED_OVER'
      for (const assignedKiz of assignedKizUnits) {
        if (
          assignedKiz.physicalState === desiredState ||
          ['QUARANTINE', 'LOST', 'WRITTEN_OFF'].includes(assignedKiz.physicalState)
        ) {
          continue
        }
        await tx.kizUnit.update({
          where: { id: assignedKiz.id },
          data: { physicalState: desiredState },
        })
        await tx.kizEvent.create({
          data: {
            kizUnitId: assignedKiz.id,
            orderId: saved.id,
            type: eventType,
            details: { source: 'wb_fbs_metadata_reconciliation' },
          },
        })
      }
      for (const assignedKiz of assignedKizUnits) {
        await ensureWithdrawalTask(tx, {
          wbAccountId,
          orderId: saved.id,
          isB2b: saved.isB2b,
          kizUnit: assignedKiz,
        })
      }
    }
    if (wbStatus === 'sold' && !shipmentApplied) {
      for (const assignedKiz of assignedKizUnits) {
        await ensureWithdrawalTask(tx, {
          wbAccountId,
          orderId: saved.id,
          isB2b: saved.isB2b,
          kizUnit: assignedKiz,
        })
      }
    }

    await tx.fbsOrder.update({
      where: { id: saved.id },
      data: {
        reservationApplied,
        shipmentApplied,
        ...(shipmentApplied && !saved.shippedAt ? { shippedAt: new Date() } : {}),
        ...(wbStatus === 'sold' && !saved.soldAt ? { soldAt: new Date() } : {}),
      },
    })

    await tx.fbsOrderEvent.upsert({
      where: {
        orderId_eventKey: {
          orderId: saved.id,
          eventKey: eventKey({
            supplierStatus,
            wbStatus,
            supplyExternalId,
            metadata: sanitizedMeta,
          }),
        },
      },
      create: {
        orderId: saved.id,
        eventKey: eventKey({
          supplierStatus,
          wbStatus,
          supplyExternalId,
          metadata: sanitizedMeta,
        }),
        supplierStatus,
        wbStatus,
        supplyExternalId,
        metadataStatus: sanitizedMeta,
      },
      update: {},
    })

    return { shortage, kizStats }
  })
}

export async function syncFbsOperational(
  wbAccountId: string,
  period?: { dateFrom: string; dateTo: string },
) {
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))
  const warehouseCount = await upsertWarehouses(wbAccountId, client)
  const supplyCount = await upsertSupplies(wbAccountId, client)
  const [newOrders, periodOrders] = await Promise.all([
    fetchNewFbsOrders(client),
    period ? fetchFbsOrdersPeriod(client, period.dateFrom, period.dateTo) : Promise.resolve([]),
  ])
  const uniqueOrders = Array.from(
    new Map([...periodOrders, ...newOrders].map((order) => [String(order.id), order])).values(),
  )
  const orderIds = uniqueOrders.map((order) => Number(order.id))
  const [statuses, metadataRows] = orderIds.length
    ? await Promise.all([
        fetchFbsOrderStatuses(client, orderIds),
        fetchFbsOrderMeta(client, orderIds),
      ])
    : [[], []]
  const statusMap = new Map(statuses.map((row) => [String(row.id), row]))
  const metadataMap = new Map(metadataRows.map((row) => [String(row.orderId ?? row.id), row]))

  let shortages = 0
  const kiz = emptyWbKizIngestionStats()
  for (const order of uniqueOrders) {
    const result = await applyOrderState(
      wbAccountId,
      order,
      statusMap.get(String(order.id)),
      metadataMap.get(String(order.id)),
    )
    if (result.shortage) shortages += 1
    addWbKizIngestionStats(kiz, result.kizStats)
  }

  return {
    readOnly: true,
    warehouses: warehouseCount,
    supplies: supplyCount,
    orders: uniqueOrders.length,
    shortages,
    kiz,
    period: period ?? null,
  }
}

export async function syncFbsStocksCurrent(wbAccountId: string) {
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))
  await upsertWarehouses(wbAccountId, client)
  const [warehouses, catalogSizes] = await Promise.all([
    prisma.fbsSellerWarehouse.findMany({
      where: { wbAccountId, isEnabled: true },
      include: {
        assortmentItems: {
          where: { isEnabled: true },
          select: {
            id: true,
            productId: true,
            productSizeId: true,
            nmId: true,
            chrtId: true,
            barcode: true,
            vendorCode: true,
          },
        },
      },
    }),
    prisma.productSize.findMany({
      where: {
        chrtId: { not: null },
        product: { wbAccountId },
      },
      select: {
        id: true,
        productId: true,
        chrtId: true,
        barcode: true,
        product: {
          select: {
            nmId: true,
            vendorCode: true,
          },
        },
      },
    }),
  ])

  if (!warehouses.length) {
    throw new Error('WB did not return any enabled seller warehouse for FBS stock sync')
  }

  let updated = 0
  let discovered = 0
  let wbStockUnits = 0
  for (const warehouse of warehouses) {
    const catalogMap = new Map(
      catalogSizes.flatMap((size) =>
        size.chrtId == null ? [] : [[size.chrtId, size] as const],
      ),
    )
    const existingMap = new Map(
      warehouse.assortmentItems.map((item) => [item.chrtId, item]),
    )
    const chrtIds = Array.from(new Set([
      ...Array.from(catalogMap.keys()),
      ...Array.from(existingMap.keys()),
    ]))

    if (!chrtIds.length) {
      throw new Error('No product size IDs are available for FBS stock sync; sync the product catalog first')
    }

    const stocks = await fetchFbsStocks(
      client,
      warehouse.externalId.toString(),
      chrtIds,
    )
    const stockMap = new Map(stocks.map((stock) => [stock.chrtId, stock.amount]))
    const mutations: Prisma.PrismaPromise<unknown>[] = []

    for (const chrtId of chrtIds) {
      const existing = existingMap.get(chrtId)
      const catalog = catalogMap.get(chrtId)
      const amount = stockMap.get(chrtId) ?? 0
      if (!existing && (!catalog || amount <= 0)) continue

      if (!existing) discovered += 1
      updated += 1
      wbStockUnits += amount
      mutations.push(
        prisma.fbsAssortmentItem.upsert({
          where: {
            warehouseId_chrtId: {
              warehouseId: warehouse.id,
              chrtId,
            },
          },
          create: {
            wbAccountId,
            warehouseId: warehouse.id,
            productId: catalog?.productId ?? null,
            productSizeId: catalog?.id ?? null,
            nmId: catalog?.product.nmId ?? existing?.nmId ?? 0,
            chrtId,
            barcode: catalog?.barcode ?? existing?.barcode ?? '',
            vendorCode: catalog?.product.vendorCode ?? existing?.vendorCode ?? null,
            wbStock: amount,
            wbStockSyncedAt: new Date(),
          },
          update: {
            productId: catalog?.productId ?? undefined,
            productSizeId: catalog?.id ?? undefined,
            nmId: catalog?.product.nmId ?? undefined,
            barcode: catalog?.barcode ?? undefined,
            vendorCode: catalog?.product.vendorCode ?? undefined,
            wbStock: amount,
            wbStockSyncedAt: new Date(),
          },
        }),
      )
    }

    if (mutations.length) await prisma.$transaction(mutations)
  }

  return {
    readOnly: true,
    warehouses: warehouses.length,
    catalogSizes: catalogSizes.length,
    updated,
    discovered,
    wbStockUnits,
  }
}

function collectMarkingRows(value: unknown, result: Array<Record<string, unknown>>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMarkingRows(item, result))
    return
  }
  if (!value || typeof value !== 'object') return
  const row = value as Record<string, unknown>
  const keys = Object.keys(row).map((key) => key.toLowerCase())
  if (keys.some((key) => ['nmid', 'chrtid', 'gtin', 'barcode'].includes(key))) result.push(row)
  Object.values(row).forEach((nested) => collectMarkingRows(nested, result))
}

function valueByKey(row: Record<string, unknown>, names: string[]) {
  const entry = Object.entries(row).find(([key]) => names.includes(key.toLowerCase()))
  return entry?.[1]
}

export async function syncFbsMarkingReport(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
) {
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))
  const report = await fetchFbsMarkingReport(client, dateFrom, dateTo)
  const rows: Array<Record<string, unknown>> = []
  collectMarkingRows(report, rows)

  let updated = 0
  for (const row of rows) {
    const nmId = Number(valueByKey(row, ['nmid', 'nm_id']))
    const chrtId = Number(valueByKey(row, ['chrtid', 'chrt_id']))
    const gtinValue = valueByKey(row, ['gtin'])
    const gtin = gtinValue == null ? null : String(gtinValue)
    const where = Number.isFinite(chrtId)
      ? { wbAccountId, chrtId }
      : Number.isFinite(nmId)
        ? { wbAccountId, nmId }
        : null
    if (!where) continue
    const result = await prisma.fbsAssortmentItem.updateMany({
      where,
      data: { requiresKiz: true, ...(gtin ? { markingGtin: gtin } : {}) },
    })
    updated += result.count
  }

  return { readOnly: true, rows: rows.length, updated, period: { dateFrom, dateTo } }
}

export { createMovement }
