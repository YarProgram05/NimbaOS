import type { FbsActionKind, FbsActionStatus, KizCirculationState, KizComplianceTaskStatus, KizComplianceTaskType, KizPhysicalState, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { getFbsOrderMetadataState } from '@/lib/fbs/metadata'
import { toKizIdentificationCode } from '@/lib/fbs/kiz'
import {
  FBS_ACTION_KIND_LABELS,
  FBS_ACTION_STATUS_LABELS,
  FBS_SUPPLIER_STATUS_LABELS,
  FBS_WB_STATUS_LABELS,
  KIZ_COMPLIANCE_STATUS_LABELS,
} from '@/lib/fbs/status-labels'
import type { FbsWorkspaceData } from '@/types/fbs'

export type FbsHistorySection = 'orders' | 'kizUnits' | 'complianceTasks' | 'supplies' | 'recentActions'
export type FbsHistoryRow =
  | FbsWorkspaceData['orders'][number]
  | FbsWorkspaceData['kizUnits'][number]
  | FbsWorkspaceData['complianceTasks'][number]
  | FbsWorkspaceData['supplies'][number]
  | FbsWorkspaceData['recentActions'][number]

export interface FbsHistoryPage {
  section: FbsHistorySection
  rows: FbsHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export async function getFbsHistoryPage(input: {
  wbAccountId: string
  section: FbsHistorySection
  query?: string
  filter?: string
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  canViewFullKiz: boolean
}): Promise<FbsHistoryPage> {
  const pageSize = [25, 50, 100].includes(input.pageSize ?? 25) ? input.pageSize ?? 25 : 25
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const query = input.query?.trim() ?? ''
  const direction = input.sortDirection === 'asc' ? 'asc' : 'desc'
  const dateRange = historyDateRange(input.dateFrom, input.dateTo)

  switch (input.section) {
    case 'orders':
      return getOrders({ ...input, query, direction, page, pageSize, dateRange })
    case 'kizUnits':
      return getKizUnits({ ...input, query, direction, page, pageSize, dateRange })
    case 'complianceTasks':
      return getComplianceTasks({ ...input, query, direction, page, pageSize, dateRange })
    case 'supplies':
      return getSupplies({ ...input, query, direction, page, pageSize, dateRange })
    case 'recentActions':
      return getRecentActions({ ...input, query, direction, page, pageSize, dateRange })
  }
}

type ResolvedInput = Parameters<typeof getFbsHistoryPage>[0] & {
  query: string
  direction: 'asc' | 'desc'
  page: number
  pageSize: number
  dateRange: { gte?: Date; lte?: Date } | undefined
}

async function getOrders(input: ResolvedInput): Promise<FbsHistoryPage> {
  const filter = input.filter ?? 'ALL'
  const numericOrderId = /^\d+$/.test(input.query) ? BigInt(input.query) : null
  const matchingSupplierStatuses = matchingKeys(FBS_SUPPLIER_STATUS_LABELS, input.query)
  const matchingWbStatuses = matchingKeys(FBS_WB_STATUS_LABELS, input.query)
  const where: Prisma.FbsOrderWhereInput = {
    wbAccountId: input.wbAccountId,
    ...(input.dateRange ? { createdAtWb: input.dateRange } : {}),
    ...(filter === 'ACTIVE' ? { supplierStatus: { not: 'cancel' }, wbStatus: { notIn: ['canceled', 'canceled_by_client', 'declined_by_client', 'defect'] } } : {}),
    ...(filter === 'CANCELED' ? { OR: [{ supplierStatus: 'cancel' }, { wbStatus: { in: ['canceled', 'canceled_by_client', 'declined_by_client', 'defect'] } }] } : {}),
    ...(filter === 'RETURN' ? { wbStatus: { in: ['canceled_by_client', 'defect'] } } : {}),
    ...(filter === 'NEEDS_KIZ' ? { assortmentItem: { requiresKiz: true }, kizUnits: { none: {} } } : {}),
    ...(input.query ? {
      AND: [{ OR: [
        ...(numericOrderId ? [{ externalOrderId: numericOrderId }] : []),
        { vendorCode: { contains: input.query, mode: 'insensitive' } },
        { barcode: { contains: input.query, mode: 'insensitive' } },
        { warehouse: { name: { contains: input.query, mode: 'insensitive' } } },
        { supplierStatus: { contains: input.query, mode: 'insensitive' } },
        { wbStatus: { contains: input.query, mode: 'insensitive' } },
        ...(matchingSupplierStatuses.length ? [{ supplierStatus: { in: matchingSupplierStatuses } }] : []),
        ...(matchingWbStatuses.length ? [{ wbStatus: { in: matchingWbStatuses } }] : []),
      ] }] } : {}),
  }
  const orderBy: Prisma.FbsOrderOrderByWithRelationInput = ({
    externalOrderId: { externalOrderId: input.direction },
    createdAtWb: { createdAtWb: input.direction },
    vendorCode: { vendorCode: input.direction },
    warehouseName: { warehouse: { name: input.direction } },
    status: { wbStatus: input.direction },
    kizCode: { updatedAt: input.direction },
    metadata: { updatedAt: input.direction },
  } as Record<string, Prisma.FbsOrderOrderByWithRelationInput>)[input.sortKey ?? ''] ?? { createdAtWb: 'desc' }
  const total = await prisma.fbsOrder.count({ where })
  const actualPage = boundedPage(input.page, total, input.pageSize)
  const rows = await prisma.fbsOrder.findMany({
    where,
    skip: (actualPage - 1) * input.pageSize,
    take: input.pageSize,
    orderBy,
    include: {
      warehouse: { select: { name: true } },
      supply: { select: { externalId: true } },
      assortmentItem: { select: { requiresKiz: true } },
      kizUnits: { select: { maskedCode: true, encryptedCode: true, wbValidationStatus: true }, take: 1 },
      complianceTasks: {
        where: { type: { in: ['WITHDRAWAL_REMOTE_SALE', 'WITHDRAWAL_B2B'] } },
        orderBy: { createdAt: 'desc' }, take: 1,
        select: { kizUnit: { select: { maskedCode: true, encryptedCode: true, wbValidationStatus: true } } },
      },
      kizEvents: {
        orderBy: { occurredAt: 'desc' }, take: 1,
        select: { kizUnit: { select: { maskedCode: true, encryptedCode: true, wbValidationStatus: true } } },
      },
    },
  })
  return pageResult('orders', rows.map((order) => {
    const requiresKiz = Boolean(order.assortmentItem?.requiresKiz)
    const canUseHistoricalKiz = order.shipmentApplied || ['sold', 'canceled_by_client', 'defect'].includes(order.wbStatus)
    const effectiveKiz = order.kizUnits[0]
      ?? (canUseHistoricalKiz ? order.complianceTasks[0]?.kizUnit : null)
      ?? (canUseHistoricalKiz ? order.kizEvents[0]?.kizUnit : null)
    const metadata = getFbsOrderMetadataState({
      metadata: order.metadataStatus,
      requiresKiz,
      hasKiz: Boolean(effectiveKiz),
      wbKizValidationStatus: effectiveKiz?.wbValidationStatus ?? null,
    })
    return {
      id: order.id,
      externalOrderId: order.externalOrderId.toString(),
      createdAtWb: order.createdAtWb.toISOString(),
      vendorCode: order.vendorCode,
      barcode: order.barcode,
      warehouseName: order.warehouse?.name ?? null,
      supplyExternalId: order.supply?.externalId ?? null,
      supplierStatus: order.supplierStatus,
      wbStatus: order.wbStatus,
      requiresKiz,
      kizCode: displayCode(effectiveKiz, input.canViewFullKiz),
      metadataReady: metadata.ready,
      metadataLabel: metadata.label,
      metadataIssue: metadata.issue,
      isB2b: order.isB2b,
    }
  }), total, actualPage, input.pageSize)
}

async function getKizUnits(input: ResolvedInput): Promise<FbsHistoryPage> {
  const circulationStates = new Set<KizCirculationState>(['UNKNOWN', 'COMMISSIONING_REQUIRED', 'IN_CIRCULATION', 'WITHDRAWAL_REQUIRED', 'WITHDRAWN', 'RETURN_TO_CIRCULATION_REQUIRED'])
  const physicalStates = new Set<KizPhysicalState>(['IN_STOCK', 'RESERVED', 'HANDED_OVER', 'RETURN_EXPECTED', 'QUARANTINE', 'LOST', 'WRITTEN_OFF'])
  const stateWhere: Prisma.KizUnitWhereInput = circulationStates.has(input.filter as KizCirculationState)
    ? { circulationState: input.filter as KizCirculationState }
    : physicalStates.has(input.filter as KizPhysicalState)
      ? { physicalState: input.filter as KizPhysicalState }
      : {}
  const baseWhere: Prisma.KizUnitWhereInput = {
    wbAccountId: input.wbAccountId,
    ...(input.dateRange ? { createdAt: input.dateRange } : {}),
    ...stateWhere,
  }
  const include = {
    warehouse: { select: { name: true } },
    assortmentItem: { select: { vendorCode: true } },
    currentOrder: { select: { externalOrderId: true } },
  } satisfies Prisma.KizUnitInclude

  if (input.query) {
    const candidates = await prisma.kizUnit.findMany({ where: baseWhere, include })
    const normalizedQuery = input.query.toLocaleLowerCase('ru-RU')
    const matched = candidates.filter((unit) => [
      displayCode(unit, input.canViewFullKiz), unit.gtin, unit.serialMasked,
      unit.assortmentItem?.vendorCode, unit.warehouse?.name,
      unit.currentOrder?.externalOrderId.toString(), unit.physicalState, unit.circulationState,
      KIZ_PHYSICAL_LABELS[unit.physicalState], KIZ_CIRCULATION_LABELS[unit.circulationState],
    ].some((value) => String(value ?? '').toLocaleLowerCase('ru-RU').includes(normalizedQuery)))
    matched.sort((left, right) => compareHistoryValues(kizSortValue(left, input.sortKey), kizSortValue(right, input.sortKey), input.direction))
    const actualPage = boundedPage(input.page, matched.length, input.pageSize)
    const pageRows = matched.slice((actualPage - 1) * input.pageSize, actualPage * input.pageSize)
    return pageResult('kizUnits', pageRows.map((unit) => mapKizUnit(unit, input.canViewFullKiz)), matched.length, actualPage, input.pageSize)
  }

  const total = await prisma.kizUnit.count({ where: baseWhere })
  const actualPage = boundedPage(input.page, total, input.pageSize)
  const rows = await prisma.kizUnit.findMany({
    where: baseWhere, include,
    skip: (actualPage - 1) * input.pageSize, take: input.pageSize,
    orderBy: ({
      code: { maskedCode: input.direction },
      gtin: { gtin: input.direction },
      vendorCode: { assortmentItem: { vendorCode: input.direction } },
      warehouseName: { warehouse: { name: input.direction } },
      physicalState: { physicalState: input.direction },
      circulationState: { circulationState: input.direction },
      wbValidationStatus: { wbValidationStatus: input.direction },
      externalOrderId: { currentOrder: { externalOrderId: input.direction } },
    } as Record<string, Prisma.KizUnitOrderByWithRelationInput>)[input.sortKey ?? ''] ?? { updatedAt: 'desc' },
  })
  return pageResult('kizUnits', rows.map((unit) => mapKizUnit(unit, input.canViewFullKiz)), total, actualPage, input.pageSize)
}

async function getComplianceTasks(input: ResolvedInput): Promise<FbsHistoryPage> {
  const numericOrderId = /^\d+$/.test(input.query) ? BigInt(input.query) : null
  const matchingTaskStatuses = matchingKeys(KIZ_COMPLIANCE_STATUS_LABELS, input.query) as KizComplianceTaskStatus[]
  const where: Prisma.KizComplianceTaskWhereInput = {
    wbAccountId: input.wbAccountId,
    ...(input.dateRange ? { createdAt: input.dateRange } : {}),
    ...(input.filter && input.filter !== 'ALL' ? { status: input.filter as KizComplianceTaskStatus } : {}),
    ...(input.query ? { OR: [
      { documentNumber: { contains: input.query, mode: 'insensitive' } },
      ...(['COMMISSIONING', 'WITHDRAWAL_REMOTE_SALE', 'WITHDRAWAL_B2B', 'RETURN_TO_CIRCULATION', 'RELABEL'].includes(input.query) ? [{ type: input.query as KizComplianceTaskType }] : []),
      ...(['OPEN', 'EXPORTED', 'CONFIRMED', 'CANCELED'].includes(input.query) ? [{ status: input.query as KizComplianceTaskStatus }] : []),
      ...(matchingTaskStatuses.length ? [{ status: { in: matchingTaskStatuses } }] : []),
      ...(numericOrderId ? [{ order: { externalOrderId: numericOrderId } }] : []),
      { kizUnit: { maskedCode: { contains: input.query, mode: 'insensitive' } } },
    ] } : {}),
  }
  const total = await prisma.kizComplianceTask.count({ where })
  const actualPage = boundedPage(input.page, total, input.pageSize)
  const rows = await prisma.kizComplianceTask.findMany({
    where, skip: (actualPage - 1) * input.pageSize, take: input.pageSize,
    orderBy: ({
      type: { type: input.direction },
      code: { kizUnit: { maskedCode: input.direction } },
      externalOrderId: { order: { externalOrderId: input.direction } },
      status: { status: input.direction },
      documentNumber: { documentNumber: input.direction },
    } as Record<string, Prisma.KizComplianceTaskOrderByWithRelationInput>)[input.sortKey ?? ''] ?? { createdAt: 'desc' },
    include: { kizUnit: { select: { maskedCode: true, encryptedCode: true } }, order: { select: { externalOrderId: true } } },
  })
  return pageResult('complianceTasks', rows.map((task) => ({
    id: task.id, type: task.type, status: task.status, dueAt: task.dueAt?.toISOString() ?? null,
    code: displayCode(task.kizUnit, input.canViewFullKiz), externalOrderId: task.order?.externalOrderId.toString() ?? null,
    documentNumber: task.documentNumber,
  })), total, actualPage, input.pageSize)
}

async function getSupplies(input: ResolvedInput): Promise<FbsHistoryPage> {
  const where: Prisma.FbsSupplyWhereInput = {
    wbAccountId: input.wbAccountId,
    ...(input.dateRange ? { createdAt: input.dateRange } : {}),
    ...(input.filter === 'OPEN' ? { done: false } : {}),
    ...(input.filter === 'CLOSED' ? { done: true } : {}),
    ...(input.filter === 'B2B' ? { isB2b: true } : {}),
    ...(input.query ? { OR: [
      { name: { contains: input.query, mode: 'insensitive' } },
      { externalId: { contains: input.query, mode: 'insensitive' } },
      { warehouse: { name: { contains: input.query, mode: 'insensitive' } } },
    ] } : {}),
  }
  const total = await prisma.fbsSupply.count({ where })
  const actualPage = boundedPage(input.page, total, input.pageSize)
  const rows = await prisma.fbsSupply.findMany({
    where, skip: (actualPage - 1) * input.pageSize, take: input.pageSize,
    orderBy: ({
      name: { name: input.direction },
      warehouseName: { warehouse: { name: input.direction } },
      orderCount: { orders: { _count: input.direction } },
      isB2b: { isB2b: input.direction },
      done: { done: input.direction },
    } as Record<string, Prisma.FbsSupplyOrderByWithRelationInput>)[input.sortKey ?? ''] ?? { createdAt: 'desc' },
    include: { warehouse: { select: { name: true } }, _count: { select: { orders: true } } },
  })
  return pageResult('supplies', rows.map((supply) => ({
    id: supply.id, externalId: supply.externalId, name: supply.name, done: supply.done,
    isB2b: supply.isB2b, warehouseName: supply.warehouse?.name ?? null, orderCount: supply._count.orders,
  })), total, actualPage, input.pageSize)
}

async function getRecentActions(input: ResolvedInput): Promise<FbsHistoryPage> {
  const actionKinds: FbsActionKind[] = ['ATTACH_KIZ', 'SET_ORDER_STATUS', 'MOVE_TO_SUPPLY', 'CLOSE_SUPPLY', 'PUBLISH_STOCKS']
  const actionStatuses: FbsActionStatus[] = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']
  const matchingKinds = actionKinds.filter((value) => value.toLowerCase().includes(input.query.toLowerCase()))
  const matchingStatuses = actionStatuses.filter((value) => value.toLowerCase().includes(input.query.toLowerCase()))
  matchingKinds.push(...matchingKeys(FBS_ACTION_KIND_LABELS, input.query).filter((value): value is FbsActionKind => actionKinds.includes(value as FbsActionKind)))
  matchingStatuses.push(...matchingKeys(FBS_ACTION_STATUS_LABELS, input.query).filter((value): value is FbsActionStatus => actionStatuses.includes(value as FbsActionStatus)))
  const where: Prisma.FbsActionLogWhereInput = {
    wbAccountId: input.wbAccountId,
    ...(input.dateRange ? { createdAt: input.dateRange } : {}),
    ...(input.query ? { OR: [
      ...(matchingKinds.length ? [{ kind: { in: matchingKinds } }] : []),
      ...(matchingStatuses.length ? [{ status: { in: matchingStatuses } }] : []),
      { error: { contains: input.query, mode: 'insensitive' } },
    ] } : {}),
  }
  const total = await prisma.fbsActionLog.count({ where })
  const actualPage = boundedPage(input.page, total, input.pageSize)
  const rows = await prisma.fbsActionLog.findMany({
    where, skip: (actualPage - 1) * input.pageSize, take: input.pageSize,
    orderBy: { createdAt: input.direction },
  })
  return pageResult('recentActions', rows.map((row) => ({
    id: row.id, kind: row.kind, status: row.status, error: row.error, createdAt: row.createdAt.toISOString(),
  })), total, actualPage, input.pageSize)
}

function mapKizUnit(unit: Prisma.KizUnitGetPayload<{
  include: { warehouse: { select: { name: true } }; assortmentItem: { select: { vendorCode: true } }; currentOrder: { select: { externalOrderId: true } } }
}>, canViewFullKiz: boolean): FbsWorkspaceData['kizUnits'][number] {
  return {
    id: unit.id, code: displayCode(unit, canViewFullKiz), gtin: unit.gtin, serialMasked: unit.serialMasked,
    physicalState: unit.physicalState, circulationState: unit.circulationState, wbValidationStatus: unit.wbValidationStatus,
    warehouseName: unit.warehouse?.name ?? null, vendorCode: unit.assortmentItem?.vendorCode ?? null,
    externalOrderId: unit.currentOrder?.externalOrderId.toString() ?? null, lastScannedAt: unit.lastScannedAt?.toISOString() ?? null,
  }
}

function displayCode(unit: { maskedCode: string; encryptedCode: string } | null | undefined, canViewFullKiz: boolean) {
  if (!unit) return null
  if (!canViewFullKiz) return unit.maskedCode
  try { return toKizIdentificationCode(decrypt(unit.encryptedCode)) } catch { return unit.maskedCode }
}

function boundedPage(page: number, total: number, pageSize: number) {
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
}

function historyDateRange(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined
  return {
    ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000+03:00`) } : {}),
    ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999+03:00`) } : {}),
  }
}

function pageResult(section: FbsHistorySection, rows: FbsHistoryRow[], total: number, page: number, pageSize: number): FbsHistoryPage {
  return { section, rows, total, page, pageSize }
}

function compareHistoryValues(left: string, right: string, direction: 'asc' | 'desc') {
  const comparison = left.localeCompare(right, 'ru', { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? comparison : -comparison
}

function kizSortValue(unit: { maskedCode: string; gtin: string | null; physicalState: string; circulationState: string; wbValidationStatus: string | null; warehouse: { name: string } | null; assortmentItem: { vendorCode: string | null } | null; currentOrder: { externalOrderId: bigint } | null }, key?: string) {
  return String(({
    code: unit.maskedCode, gtin: unit.gtin, vendorCode: unit.assortmentItem?.vendorCode,
    warehouseName: unit.warehouse?.name, physicalState: unit.physicalState, circulationState: unit.circulationState,
    wbValidationStatus: unit.wbValidationStatus, externalOrderId: unit.currentOrder?.externalOrderId,
  } as Record<string, unknown>)[key ?? 'code'] ?? '')
}

function matchingKeys(labels: Record<string, string>, query: string) {
  const normalized = query.trim().toLocaleLowerCase('ru-RU')
  if (!normalized) return []
  return Object.entries(labels)
    .filter(([key, label]) => key.toLocaleLowerCase('ru-RU').includes(normalized) || label.toLocaleLowerCase('ru-RU').includes(normalized))
    .map(([key]) => key)
}

const KIZ_PHYSICAL_LABELS: Record<string, string> = {
  IN_STOCK: 'На складе', RESERVED: 'В резерве', HANDED_OVER: 'Передан WB',
  RETURN_EXPECTED: 'Ожидается возврат', QUARANTINE: 'Карантин', LOST: 'Утрачен', WRITTEN_OFF: 'Списан',
}

const KIZ_CIRCULATION_LABELS: Record<string, string> = {
  UNKNOWN: 'Статус в ЧЗ не указан', COMMISSIONING_REQUIRED: 'Нужен ввод', IN_CIRCULATION: 'В обороте',
  WITHDRAWAL_REQUIRED: 'Требуется вывод из оборота', WITHDRAWN: 'Выведен из оборота',
  RETURN_TO_CIRCULATION_REQUIRED: 'Требуется возврат в оборот',
}
