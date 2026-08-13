import { prisma } from '@/lib/db'
import type { FbsWorkspaceData } from '@/types/fbs'
import { getFbsOrderMetadataState } from '@/lib/fbs/metadata'
import { summarizeFbsAnalytics } from '@/lib/fbs/analytics'
import { decrypt } from '@/lib/encryption'
import { toKizIdentificationCode } from '@/lib/fbs/kiz'

const TERMINAL_SUPPLIER_STATUSES = ['complete', 'cancel']
const TERMINAL_WB_STATUSES = ['sold', 'canceled', 'canceled_by_client', 'declined_by_client', 'defect']
const FBS_HISTORY_LOAD_LIMIT = 100

export async function getFbsWorkspaceData(input: {
  wbAccountId: string
  canOperate: boolean
  canViewFullKiz: boolean
  canEnableWbWrites: boolean
  dateFrom?: string
  dateTo?: string
}): Promise<FbsWorkspaceData> {
  const financeDateTo = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999Z`) : new Date()
  const financeDateFrom = input.dateFrom
    ? new Date(`${input.dateFrom}T00:00:00.000Z`)
    : new Date(financeDateTo.getTime() - 29 * 24 * 60 * 60 * 1000)
  const operationalDateTo = input.dateTo
    ? new Date(`${input.dateTo}T23:59:59.999+03:00`)
    : new Date()
  const operationalDateFrom = input.dateFrom
    ? new Date(`${input.dateFrom}T00:00:00.000+03:00`)
    : new Date(operationalDateTo.getTime() - 29 * 24 * 60 * 60 * 1000)

  const [
    account,
    warehouses,
    supplies,
    catalogCandidates,
    orders,
    kizUnits,
    complianceTasks,
    operationBatches,
    recentActions,
    analyticsOrders,
    financialCandidates,
    costPrices,
    historyCounts,
    openOrders,
    overdueOrders,
    openComplianceTasks,
    quarantinedKiz,
  ] = await Promise.all([
    prisma.wbAccount.findUniqueOrThrow({
      where: { id: input.wbAccountId },
      select: { id: true, name: true, taxRate: true },
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
      take: FBS_HISTORY_LOAD_LIMIT,
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
      take: FBS_HISTORY_LOAD_LIMIT,
      orderBy: { createdAtWb: 'desc' },
      include: {
        warehouse: { select: { name: true } },
        supply: { select: { externalId: true } },
        assortmentItem: { select: { requiresKiz: true } },
        kizUnits: {
          select: {
            maskedCode: true,
            encryptedCode: true,
            circulationState: true,
            wbValidationStatus: true,
          },
          take: 1,
        },
        complianceTasks: {
          where: { type: { in: ['WITHDRAWAL_REMOTE_SALE', 'WITHDRAWAL_B2B'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            kizUnit: {
              select: {
                maskedCode: true,
                encryptedCode: true,
                circulationState: true,
                wbValidationStatus: true,
              },
            },
          },
        },
        kizEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: {
            kizUnit: {
              select: {
                maskedCode: true,
                encryptedCode: true,
                circulationState: true,
                wbValidationStatus: true,
              },
            },
          },
        },
      },
    }),
    prisma.kizUnit.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: FBS_HISTORY_LOAD_LIMIT,
      orderBy: { updatedAt: 'desc' },
      include: {
        warehouse: { select: { name: true } },
        assortmentItem: { select: { vendorCode: true } },
        currentOrder: { select: { externalOrderId: true } },
      },
    }),
    prisma.kizComplianceTask.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: FBS_HISTORY_LOAD_LIMIT,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        kizUnit: { select: { maskedCode: true, encryptedCode: true } },
        order: { select: { externalOrderId: true } },
      },
    }),
    prisma.kizOperationBatch.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          select: { type: true, status: true },
        },
      },
    }),
    prisma.fbsActionLog.findMany({
      where: { wbAccountId: input.wbAccountId },
      take: FBS_HISTORY_LOAD_LIMIT,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fbsOrder.findMany({
      where: {
        wbAccountId: input.wbAccountId,
        createdAtWb: { gte: operationalDateFrom, lte: operationalDateTo },
      },
      select: {
        externalOrderId: true,
        nmId: true,
        vendorCode: true,
        supplierStatus: true,
        wbStatus: true,
      },
    }),
    prisma.realizationReport.findMany({
      where: {
        wbAccountId: input.wbAccountId,
        OR: [
          { rrDt: { gte: financeDateFrom, lte: financeDateTo } },
          {
            rrDt: null,
            dateFrom: { lte: financeDateTo },
            dateTo: { gte: financeDateFrom },
          },
        ],
      },
      select: {
        orderId: true,
        deliveryMethod: true,
        nmId: true,
        vendorCode: true,
        docTypeName: true,
        quantity: true,
        retailPriceWithDisc: true,
        ppvzSppPrc: true,
        ppvzForPay: true,
        deliveryRub: true,
        storageFee: true,
        acceptance: true,
        additionalPayment: true,
        penalty: true,
        deduction: true,
      },
    }),
    prisma.costPrice.findMany({
      where: { wbAccountId: input.wbAccountId },
      select: { vendorCode: true, costPrice: true },
    }),
    Promise.all([
      prisma.fbsSupply.count({ where: { wbAccountId: input.wbAccountId } }),
      prisma.fbsOrder.count({ where: { wbAccountId: input.wbAccountId } }),
      prisma.kizUnit.count({ where: { wbAccountId: input.wbAccountId } }),
      prisma.kizComplianceTask.count({ where: { wbAccountId: input.wbAccountId } }),
      prisma.fbsActionLog.count({ where: { wbAccountId: input.wbAccountId } }),
    ]),
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

  const candidateOrderIds = Array.from(
    new Set(
      financialCandidates
        .map((row) => row.orderId)
        .filter((orderId): orderId is bigint => orderId !== null),
    ),
  )
  const operationalFbsMatches = candidateOrderIds.length
    ? await prisma.fbsOrder.findMany({
        where: {
          wbAccountId: input.wbAccountId,
          externalOrderId: { in: candidateOrderIds },
        },
        select: { externalOrderId: true },
      })
    : []
  const knownFbsOrderIds = new Set(
    operationalFbsMatches.map((order) => order.externalOrderId.toString()),
  )
  const analytics = summarizeFbsAnalytics({
    orders: analyticsOrders,
    financeRows: financialCandidates,
    knownFbsOrderIds,
    costPriceByVendorCode: new Map(
      costPrices.map((row) => [row.vendorCode.trim().toLocaleLowerCase('ru-RU'), Number(row.costPrice)]),
    ),
    taxRate: Number(account.taxRate),
  })

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

  return {
    account: { id: account.id, name: account.name },
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
      fbsOrders: analytics.orders,
      fbsCancellations: analytics.cancellations,
      fbsRevenue: analytics.revenue.toFixed(2),
      fbsToTransfer: analytics.toTransfer.toFixed(2),
      fbsSales: analytics.sales,
      fbsReturns: analytics.returns,
      fbsOperatingProfit: analytics.operatingProfit.toFixed(2),
      fbsMarginality: analytics.marginality.toFixed(2),
      fbsProfitability: analytics.profitability.toFixed(2),
      fbsBuyoutPercent: analytics.buyoutPercent.toFixed(2),
    },
    rowCounts: {
      warehouses: warehouses.length,
      assortment: assortment.length,
      supplies: historyCounts[0],
      orders: historyCounts[1],
      kizUnits: historyCounts[2],
      complianceTasks: historyCounts[3],
      recentActions: historyCounts[4],
      financeByArticle: analytics.financeByArticle.length,
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
      const canUseHistoricalKiz =
        order.shipmentApplied || ['sold', 'canceled_by_client', 'defect'].includes(order.wbStatus)
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
        kizCode: getKizDisplayCode(effectiveKiz, input.canViewFullKiz),
        metadataReady: metadata.ready,
        metadataLabel: metadata.label,
        metadataIssue: metadata.issue,
        isB2b: order.isB2b,
      }
    }),
    kizUnits: kizUnits.map((unit) => ({
      id: unit.id,
      code: getKizDisplayCode(unit, input.canViewFullKiz),
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
      code: getKizDisplayCode(task.kizUnit, input.canViewFullKiz),
      externalOrderId: task.order?.externalOrderId.toString() ?? null,
      documentNumber: task.documentNumber,
    })),
    operationBatches: operationBatches.map((batch) => ({
      id: batch.id,
      filename: batch.filename,
      createdAt: batch.createdAt.toISOString(),
      taskCount: batch.taskCount,
      taskTypes: Array.from(new Set(batch.tasks.map((task) => task.type))),
      pendingCount: batch.tasks.filter((task) => ['OPEN', 'EXPORTED'].includes(task.status)).length,
      confirmedCount: batch.tasks.filter((task) => task.status === 'CONFIRMED').length,
    })),
    recentActions: recentActions.map((action) => ({
      id: action.id,
      kind: action.kind,
      status: action.status,
      error: action.error,
      createdAt: action.createdAt.toISOString(),
    })),
    financeByArticle: analytics.financeByArticle.map((row) => ({
      ...row,
      revenue: row.revenue.toFixed(2),
      toTransfer: row.toTransfer.toFixed(2),
      operatingProfit: row.operatingProfit.toFixed(2),
      marginality: row.marginality.toFixed(2),
      profitability: row.profitability.toFixed(2),
      buyoutPercent: row.buyoutPercent.toFixed(2),
    })),
  }
}

function getKizDisplayCode(
  unit: { maskedCode: string; encryptedCode: string } | null | undefined,
  canViewFullKiz: boolean,
): string | null {
  if (!unit) return null
  if (!canViewFullKiz) return unit.maskedCode

  try {
    return toKizIdentificationCode(decrypt(unit.encryptedCode))
  } catch {
    return unit.maskedCode
  }
}
