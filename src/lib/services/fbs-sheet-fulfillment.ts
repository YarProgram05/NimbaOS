import { prisma } from '@/lib/db'
import { summarizeFbsDeliveryHandoffs, type FbsHandoffSupply } from '@/lib/automations/fbs-delivery-handoff'
import { FBS_SHEET_SOURCE, moscowDateString, parseSheetDate, validateFbsAccountTechnicalKey,
  type FbsSheetExistingRow } from '@/lib/automations/fbs-sheet'

const MAX_FULFILLMENT_ORDERS = 50_000
const SUPPLY_QUERY_BATCH_SIZE = 1_000

export interface FbsFulfillmentAccount {
  wbAccountId: string
  technicalKey: string
}

export interface FbsFulfillmentSourceDiagnostic {
  reason: 'MISSING_LOCAL_ORDER' | 'INVALID_SHEET_ORDER_DATE' | 'CONFLICTING_SHEET_ORDER_DATE'
    | 'SHEET_ORDER_DATE_MISMATCH' | 'MISSING_TARGET_COVERAGE' | 'SUPPLY_ACCOUNT_MISMATCH'
  wbAccountId: string
  orderKey?: string
  rowNumber?: number
}

function moscowDayStart(value: string) {
  const date = new Date(`${value}T00:00:00+03:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || moscowDateString(date) !== value) {
    throw new Error(`Некорректная дата накопительного показателя FBS: ${value}`)
  }
  return date
}

function coveredDateTo(result: unknown) {
  if (!result || typeof result !== 'object') return null
  const period = (result as { period?: unknown }).period
  if (!period || typeof period !== 'object') return null
  const value = (period as { dateTo?: unknown }).dateTo
  if (typeof value !== 'string') return null
  try { moscowDayStart(value); return value } catch { return null }
}

/** Cumulative facts from the earliest locally known or previously accounted WB order. */
export async function loadFbsSheetFulfillment(input: {
  accounts: FbsFulfillmentAccount[]
  targetDate: string
  existingRows: FbsSheetExistingRow[]
}) {
  const endExclusive = new Date(moscowDayStart(input.targetDate).getTime() + 86_400_000)
  const asOf = new Date(endExclusive.getTime() - 1)
  const accountsByKey = new Map<string, string>()
  const technicalKeysByAccount = new Map<string, string>()
  for (const account of input.accounts) {
    const key = validateFbsAccountTechnicalKey(account.technicalKey)
    if (!account.wbAccountId.trim()) throw new Error('Не указан кабинет накопительного показателя FBS')
    if (accountsByKey.has(key) || technicalKeysByAccount.has(account.wbAccountId)) {
      throw new Error('Кабинет или технический ключ повторяется в накопительном показателе FBS')
    }
    accountsByKey.set(key, account.wbAccountId)
    technicalKeysByAccount.set(account.wbAccountId, key)
  }
  if (!accountsByKey.size) throw new Error('Нет активных кабинетов для накопительного показателя FBS')
  const accountIds = Array.from(technicalKeysByAccount.keys())
  const sourceDiagnostics: FbsFulfillmentSourceDiagnostic[] = []
  const sheetOrders = new Map<string, { wbAccountId: string; externalOrderId: string; date: string | null; rowNumber: number }>()
  let earliestSheetDate: string | null = null
  for (const row of input.existingRows) {
    if (String(row.values[9] ?? '').trim() !== FBS_SHEET_SOURCE) continue
    const match = String(row.values[10] ?? '').trim().match(/^fbs-order:([a-z0-9-]+):([0-9]+)$/)
    if (!match) continue
    const wbAccountId = accountsByKey.get(match[1])
    if (!wbAccountId) continue
    const externalOrderId = BigInt(match[2]).toString()
    if (externalOrderId === '0') continue
    const orderKey = `${wbAccountId}:${externalOrderId}`
    let date = parseSheetDate(row.values[0])
    if (date) {
      try { moscowDayStart(date) } catch { date = null }
    }
    if (date && date > input.targetDate) continue
    if (!date) sourceDiagnostics.push({ reason: 'INVALID_SHEET_ORDER_DATE', wbAccountId, orderKey, rowNumber: row.rowNumber })
    if (date && (!earliestSheetDate || date < earliestSheetDate)) earliestSheetDate = date
    const previous = sheetOrders.get(orderKey)
    if (previous && previous.date !== date) {
      sourceDiagnostics.push({ reason: 'CONFLICTING_SHEET_ORDER_DATE', wbAccountId, orderKey, rowNumber: row.rowNumber })
    }
    sheetOrders.set(orderKey, { wbAccountId, externalOrderId, date, rowNumber: row.rowNumber })
  }

  const [orders, coverage] = await Promise.all([
    prisma.fbsOrder.findMany({
      where: { wbAccountId: { in: accountIds }, createdAtWb: { lt: endExclusive } },
      select: {
        wbAccountId: true, externalOrderId: true, createdAtWb: true, fetchedAt: true,
        supplierStatus: true, wbStatus: true, shipmentApplied: true,
        supply: { select: { wbAccountId: true, externalId: true, done: true, closedAt: true } },
        // Retain earlier handoffs even when the current order points at another supply.
        // The summarizer applies the report cutoff to acceptance observations only.
        events: { select: { supplierStatus: true, wbStatus: true, supplyExternalId: true, observedAt: true },
          orderBy: { observedAt: 'asc' } },
      },
      orderBy: [{ createdAtWb: 'asc' }, { externalOrderId: 'asc' }],
      take: MAX_FULFILLMENT_ORDERS + 1,
    }),
    Promise.all(accountIds.map(async (wbAccountId) => ({
      wbAccountId,
      run: await prisma.syncJobRun.findFirst({
        where: { wbAccountId, kind: 'FBS_OPERATIONAL', status: 'SUCCEEDED' },
        select: { result: true, finishedAt: true }, orderBy: { finishedAt: 'desc' },
      }),
    }))),
  ])
  if (orders.length > MAX_FULFILLMENT_ORDERS) {
    throw new Error(`Накопительный показатель FBS не рассчитан: более ${MAX_FULFILLMENT_ORDERS} заказов в выбранных кабинетах`)
  }
  for (const { wbAccountId, run } of coverage) {
    const coveredTo = coveredDateTo(run?.result)
    if (!run?.finishedAt || !coveredTo || coveredTo < input.targetDate) {
      sourceDiagnostics.push({ reason: 'MISSING_TARGET_COVERAGE', wbAccountId })
    }
  }
  const localOrders = new Map(orders.map((order) => [`${order.wbAccountId}:${order.externalOrderId}`, order]))
  const missingLocalOrderKeys: string[] = []
  for (const [orderKey, sheetOrder] of Array.from(sheetOrders)) {
    const localOrder = localOrders.get(orderKey)
    if (!localOrder) {
      missingLocalOrderKeys.push(`fbs-order:${technicalKeysByAccount.get(sheetOrder.wbAccountId)}:${sheetOrder.externalOrderId}`)
      sourceDiagnostics.push({ reason: 'MISSING_LOCAL_ORDER', wbAccountId: sheetOrder.wbAccountId,
        orderKey, rowNumber: sheetOrder.rowNumber })
    } else if (sheetOrder.date && sheetOrder.date !== moscowDateString(localOrder.createdAtWb)) {
      sourceDiagnostics.push({ reason: 'SHEET_ORDER_DATE_MISMATCH', wbAccountId: sheetOrder.wbAccountId,
        orderKey, rowNumber: sheetOrder.rowNumber })
    }
  }
  const earliestLocalDate = orders.length ? moscowDateString(orders[0].createdAtWb) : null
  const dateFrom = [earliestLocalDate, earliestSheetDate].filter((date): date is string => Boolean(date)).sort()[0] ?? input.targetDate
  const supplies = new Map<string, FbsHandoffSupply>()
  const historicalSupplyIds = new Map<string, Set<string>>()
  for (const order of orders) {
    if (order.supply) {
      if (order.supply.wbAccountId !== order.wbAccountId) {
        sourceDiagnostics.push({ reason: 'SUPPLY_ACCOUNT_MISMATCH', wbAccountId: order.wbAccountId,
          orderKey: `${order.wbAccountId}:${order.externalOrderId}` })
      } else supplies.set(`${order.wbAccountId}:${order.supply.externalId}`, order.supply)
    }
    for (const event of order.events) {
      const externalId = event.supplyExternalId?.trim()
      if (!externalId || supplies.has(`${order.wbAccountId}:${externalId}`)) continue
      const ids = historicalSupplyIds.get(order.wbAccountId) ?? new Set<string>()
      ids.add(externalId)
      historicalSupplyIds.set(order.wbAccountId, ids)
    }
  }
  for (const [wbAccountId, idSet] of Array.from(historicalSupplyIds)) {
    const ids = Array.from(idSet).filter((externalId) => !supplies.has(`${wbAccountId}:${externalId}`))
    for (let offset = 0; offset < ids.length; offset += SUPPLY_QUERY_BATCH_SIZE) {
      const historical = await prisma.fbsSupply.findMany({
        where: { wbAccountId, externalId: { in: ids.slice(offset, offset + SUPPLY_QUERY_BATCH_SIZE) } },
        select: { wbAccountId: true, externalId: true, done: true, closedAt: true },
      })
      for (const supply of historical) supplies.set(`${supply.wbAccountId}:${supply.externalId}`, supply)
    }
  }
  const summary = summarizeFbsDeliveryHandoffs({
    orders: orders.map((order) => ({
      wbAccountId: order.wbAccountId, externalOrderId: order.externalOrderId.toString(),
      createdAtWb: order.createdAtWb, observedAt: order.fetchedAt,
      supplierStatus: order.supplierStatus, wbStatus: order.wbStatus,
      shipmentApplied: order.shipmentApplied,
      supplyExternalId: order.supply?.wbAccountId === order.wbAccountId ? order.supply.externalId : null,
      events: order.events,
    })),
    supplies: Array.from(supplies.values()), dateFrom, dateTo: input.targetDate, asOf,
  })
  const sourceIncomplete = sourceDiagnostics.length > 0
  return {
    ...summary,
    status: sourceIncomplete ? 'INCOMPLETE' as const : summary.status,
    units: sourceIncomplete ? null : summary.units,
    confirmedAcceptance: sourceIncomplete ? null : summary.confirmedAcceptance,
    unknownAcceptance: sourceIncomplete ? null : summary.unknownAcceptance,
    confirmedAcceptanceLowerBound: summary.confirmedAcceptanceOrderKeys.length,
    sourceStatus: sourceIncomplete ? 'INCOMPLETE' as const : 'COMPLETE_LOCAL_HISTORY' as const,
    sourceBasis: 'LOCAL_FBS_ORDERS_AND_WB_SUPPLIES' as const,
    sourceDiagnostics,
    missingLocalOrderKeys,
    ordersInSource: orders.length,
  }
}
