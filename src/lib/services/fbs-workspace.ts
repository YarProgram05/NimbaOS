import { prisma } from '@/lib/db'
import type { FbsWorkspaceData } from '@/types/fbs'
import { getFbsOrderMetadataState } from '@/lib/fbs/metadata'

const TERMINAL_SUPPLIER_STATUSES = ['complete', 'cancel']
const TERMINAL_WB_STATUSES = ['sold', 'canceled', 'canceled_by_client', 'declined_by_client', 'defect']

export async function getFbsWorkspaceData(input: {
  wbAccountId: string
  canOperate: boolean
  canViewFullKiz: boolean
  canEnableWbWrites: boolean
  dateFrom?: string
  dateTo?: string
}): Promise<FbsWorkspaceData> {
  const dateTo = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999Z`) : new Date()
  const dateFrom = input.dateFrom
    ? new Date(`${input.dateFrom}T00:00:00.000Z`)
    : new Date(dateTo.getTime() - 29 * 24 * 60 * 60 * 1000)

  const [
    account,
    warehouses,
    supplies,
    catalogCandidates,
    orders,
    kizUnits,
    complianceTasks,
    recentActions,
    financialRows,
    openOrders,
    overdueOrders,
    openComplianceTasks,
    quarantinedKiz,
  ] = await Promise.all([
    prisma.wbAccount.findUniqueOrThrow({
      where: { id: input.wbAccountId },
      select: { id: true, name: true },
    }),
    prisma.fbsSellerWarehouse.findMany({
      where: { wbAccountId: input.wbAccountId },
      include: {
        assortmentItems: {
          where: { isEnabled: true },
          orderBy: [{ vendorCode: 'asc' }, { chrtId: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.fbsSupply.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: 200,
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
      include: {
        warehouse: { select: { name: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.productSize.findMany({
      where: {
        chrtId: { not: null },
        product: { wbAccountId: input.wbAccountId },
      },
      take: 5_000,
      orderBy: [{ product: { vendorCode: 'asc' } }, { techSize: 'asc' }],
      select: {
        id: true,
        chrtId: true,
        barcode: true,
        techSize: true,
        product: { select: { nmId: true, vendorCode: true } },
      },
    }),
    prisma.fbsOrder.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: 200,
      orderBy: { createdAtWb: 'desc' },
      include: {
        warehouse: { select: { name: true } },
        supply: { select: { externalId: true } },
        assortmentItem: { select: { requiresKiz: true } },
        kizUnits: {
          select: {
            maskedCode: true,
            circulationState: true,
            wbValidationStatus: true,
          },
          take: 1,
        },
      },
    }),
    prisma.kizUnit.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: 200,
      orderBy: { updatedAt: 'desc' },
      include: {
        warehouse: { select: { name: true } },
        assortmentItem: { select: { vendorCode: true } },
        currentOrder: { select: { externalOrderId: true } },
      },
    }),
    prisma.kizComplianceTask.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: 200,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        kizUnit: { select: { maskedCode: true } },
        order: { select: { externalOrderId: true } },
      },
    }),
    prisma.fbsActionLog.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: 30,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.realizationReport.findMany({
      where: {
        wbAccountId: input.wbAccountId,
        deliveryMethod: { contains: 'fbs', mode: 'insensitive' },
        OR: [
          { rrDt: { gte: dateFrom, lte: dateTo } },
          { rrDt: null, dateFrom: { gte: dateFrom, lte: dateTo } },
        ],
      },
      select: {
        nmId: true,
        vendorCode: true,
        docTypeName: true,
        quantity: true,
        ppvzForPay: true,
      },
    }),
    prisma.fbsOrder.count({
      where: {
        wbAccountId: input.wbAccountId,
        supplierStatus: { notIn: TERMINAL_SUPPLIER_STATUSES },
        wbStatus: { notIn: TERMINAL_WB_STATUSES },
      },
    }),
    prisma.fbsOrder.count({
      where: {
        wbAccountId: input.wbAccountId,
        deliveryDate: { lt: new Date() },
        supplierStatus: { notIn: TERMINAL_SUPPLIER_STATUSES },
        wbStatus: { notIn: TERMINAL_WB_STATUSES },
      },
    }),
    prisma.kizComplianceTask.count({
      where: { wbAccountId: input.wbAccountId, status: { in: ['OPEN', 'EXPORTED'] } },
    }),
    prisma.kizUnit.count({
      where: { wbAccountId: input.wbAccountId, physicalState: 'QUARANTINE' },
    }),
  ])

  const assortment = warehouses.flatMap((warehouse) =>
    warehouse.assortmentItems.map((item) => ({
      id: item.id,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      nmId: item.nmId,
      chrtId: item.chrtId,
      barcode: item.barcode,
      vendorCode: item.vendorCode,
      requiresKiz: item.requiresKiz,
      markingGtin: item.markingGtin,
      onHand: item.onHand,
      reserved: item.reserved,
      available: item.onHand - item.reserved,
      wbStock: item.wbStock,
    })),
  )
  const totals = assortment.reduce(
    (sum, item) => ({
      onHand: sum.onHand + item.onHand,
      reserved: sum.reserved + item.reserved,
      available: sum.available + item.available,
      wbStock: sum.wbStock + item.wbStock,
      stockMismatch: sum.stockMismatch + Math.abs(item.available - item.wbStock),
    }),
    { onHand: 0, reserved: 0, available: 0, wbStock: 0, stockMismatch: 0 },
  )

  let fbsRevenue = 0
  let fbsSales = 0
  let fbsReturns = 0
  const financeByArticle = new Map<
    string,
    { nmId: number; vendorCode: string; sales: number; returns: number; revenue: number }
  >()
  for (const row of financialRows) {
    const quantity = Math.abs(row.quantity)
    const key = `${row.nmId}:${row.vendorCode}`
    const article = financeByArticle.get(key) ?? {
      nmId: row.nmId,
      vendorCode: row.vendorCode,
      sales: 0,
      returns: 0,
      revenue: 0,
    }
    if (row.docTypeName.toLowerCase().includes('возврат')) {
      fbsReturns += quantity
      fbsRevenue -= Number(row.ppvzForPay)
      article.returns += quantity
      article.revenue -= Number(row.ppvzForPay)
    } else if (row.docTypeName.toLowerCase().includes('продаж')) {
      fbsSales += quantity
      fbsRevenue += Number(row.ppvzForPay)
      article.sales += quantity
      article.revenue += Number(row.ppvzForPay)
    }
    financeByArticle.set(key, article)
  }

  return {
    account,
    generatedAt: new Date().toISOString(),
    permissions: {
      canOperate: input.canOperate,
      canViewFullKiz: input.canViewFullKiz,
      canEnableWbWrites: input.canEnableWbWrites,
    },
    metrics: {
      ...totals,
      openOrders,
      overdueOrders,
      openComplianceTasks,
      quarantinedKiz,
      fbsRevenue: fbsRevenue.toFixed(2),
      fbsSales,
      fbsReturns,
    },
    warehouses: warehouses.map((warehouse) => {
      const items = warehouse.assortmentItems
      const onHand = items.reduce((sum, item) => sum + item.onHand, 0)
      const reserved = items.reduce((sum, item) => sum + item.reserved, 0)
      return {
        id: warehouse.id,
        externalId: warehouse.externalId.toString(),
        name: warehouse.name,
        writeEnabled: warehouse.writeEnabled,
        onHand,
        reserved,
        available: onHand - reserved,
        wbStock: items.reduce((sum, item) => sum + item.wbStock, 0),
      }
    }),
    supplies: supplies.map((supply) => ({
      id: supply.id,
      externalId: supply.externalId,
      name: supply.name,
      done: supply.done,
      isB2b: supply.isB2b,
      warehouseName: supply.warehouse?.name ?? null,
      orderCount: supply._count.orders,
    })),
    catalogCandidates: catalogCandidates.map((size) => ({
      productSizeId: size.id,
      nmId: size.product.nmId,
      chrtId: size.chrtId as number,
      barcode: size.barcode,
      vendorCode: size.product.vendorCode,
      size: size.techSize,
    })),
    assortment,
    orders: orders.map((order) => {
      const requiresKiz = Boolean(order.assortmentItem?.requiresKiz)
      const metadata = getFbsOrderMetadataState({
        metadata: order.metadataStatus,
        requiresKiz,
        hasKiz: order.kizUnits.length > 0,
        wbKizValidationStatus: order.kizUnits[0]?.wbValidationStatus ?? null,
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
        kizMasked: order.kizUnits[0]?.maskedCode ?? null,
        metadataReady: metadata.ready,
        metadataLabel: metadata.label,
        metadataIssue: metadata.issue,
        isB2b: order.isB2b,
      }
    }),
    kizUnits: kizUnits.map((unit) => ({
      id: unit.id,
      maskedCode: unit.maskedCode,
      gtin: unit.gtin,
      serialMasked: unit.serialMasked,
      physicalState: unit.physicalState,
      circulationState: unit.circulationState,
      wbValidationStatus: unit.wbValidationStatus,
      warehouseName: unit.warehouse?.name ?? null,
      vendorCode: unit.assortmentItem?.vendorCode ?? null,
      externalOrderId: unit.currentOrder?.externalOrderId.toString() ?? null,
      lastScannedAt: unit.lastScannedAt?.toISOString() ?? null,
    })),
    complianceTasks: complianceTasks.map((task) => ({
      id: task.id,
      type: task.type,
      status: task.status,
      dueAt: task.dueAt?.toISOString() ?? null,
      maskedCode: task.kizUnit.maskedCode,
      externalOrderId: task.order?.externalOrderId.toString() ?? null,
      documentNumber: task.documentNumber,
    })),
    recentActions: recentActions.map((action) => ({
      id: action.id,
      kind: action.kind,
      status: action.status,
      error: action.error,
      createdAt: action.createdAt.toISOString(),
    })),
    financeByArticle: Array.from(financeByArticle.values())
      .sort((left, right) => right.revenue - left.revenue)
      .map((row) => ({ ...row, revenue: row.revenue.toFixed(2) })),
  }
}
