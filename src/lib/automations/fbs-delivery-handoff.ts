import { moscowDateString } from './fbs-sheet'

export const FBS_HANDOFF_DATE_BASIS = 'WB_SUPPLY_CLOSED_AT' as const
// WB sorted the individual order / it reached a pickup point / the buyer received it.
// accepted_by_carrier refers to a delivery service in the seller country, not WB acceptance.
// https://dev.wildberries.ru/en/docs/openapi/orders-fbs
// https://dev.wildberries.ru/docs/openapi-other/sandbox-environment
export const FBS_WB_ACCEPTANCE_STATUSES = ['sorted', 'ready_for_pickup', 'sold'] as const

export interface FbsHandoffStatusEvidence {
  supplierStatus?: string | null
  wbStatus?: string | null
  supplyExternalId?: string | null
  // An observation can reject an impossible later closure; it is never the handoff date.
  observedAt?: Date | null
}

export interface FbsHandoffOrder extends FbsHandoffStatusEvidence {
  wbAccountId: string
  externalOrderId: string
  createdAtWb?: Date | null
  shipmentApplied?: boolean
  events?: FbsHandoffStatusEvidence[]
}

export interface FbsHandoffSupply {
  wbAccountId: string
  externalId: string
  done: boolean
  closedAt: Date | null
}

export type FbsHandoffUnknownReason =
  | 'MISSING_SUPPLY'
  | 'SUPPLY_NOT_CLOSED'
  | 'MISSING_CLOSED_AT'
  | 'INVALID_CLOSED_AT'
  | 'CLOSED_BEFORE_ORDER'
  | 'CLOSED_AFTER_OBSERVATION'
  | 'HANDOFF_WITHOUT_SUPPLY_EVIDENCE'

export interface FbsHandoffDiagnostic {
  orderKey: string
  supplyExternalId: string | null
  reason: FbsHandoffUnknownReason
}

export interface FbsAcceptanceDiagnostic {
  orderKey: string
  wbStatus: string
  reason: 'MISSING_OBSERVED_AT' | 'INVALID_OBSERVED_AT' | 'OBSERVED_AFTER_CUTOFF' | 'OBSERVED_BEFORE_HANDOFF'
}

// WB defines one assembly order as one item, regardless of orderUid, skus, or marking codes.
// https://dev.wildberries.ru/openapi/orders-fbs/
// Closing a supply transfers its orders to complete. This is not per-item WB acceptance.
// EXACT refers only to supplied WB system evidence; the caller must establish source coverage.
export function summarizeFbsDeliveryHandoffs(params: {
  orders: FbsHandoffOrder[]
  supplies: FbsHandoffSupply[]
  dateFrom: string
  dateTo: string
  // The knowledge cutoff for individual acceptance statuses, not a physical acceptance date.
  asOf: Date
}) {
  const start = moscowDayStart(params.dateFrom)
  const end = moscowDayStart(params.dateTo) + 86_400_000
  if (start >= end) throw new Error('Начало периода передачи в доставку позже окончания')
  const asOf = params.asOf.getTime()
  if (!Number.isFinite(asOf)) throw new Error('Некорректное время среза подтверждений приёмки WB')
  const supplies = new Map<string, FbsHandoffSupply>()
  for (const supply of params.supplies) {
    const key = identity(supply.wbAccountId, supply.externalId)
    const existing = supplies.get(key)
    if (existing && (existing.done !== supply.done || timestamp(existing.closedAt) !== timestamp(supply.closedAt))) {
      throw new Error(`Противоречивые даты или состояния поставки ${key}`)
    }
    supplies.set(key, supply)
  }
  const orders = new Map<string, FbsHandoffOrder[]>()
  for (const order of params.orders) {
    const key = identity(order.wbAccountId, order.externalOrderId)
    orders.set(key, [...(orders.get(key) ?? []), order])
  }
  const diagnostics: FbsHandoffDiagnostic[] = []
  const acceptanceDiagnostics: FbsAcceptanceDiagnostic[] = []
  const confirmedAcceptanceOrderKeys: string[] = []
  const reshipmentOrderKeys: string[] = []
  const firstHandoffs: Array<{
    orderKey: string
    wbAccountId: string
    externalOrderId: string
    supplyExternalId: string
    handedOverAt: Date
  }> = []
  let lowerBound = 0
  let unknown = 0

  for (const [orderKey, records] of Array.from(orders).sort(([left], [right]) => left.localeCompare(right))) {
    const orderDiagnostics = new Map<string, FbsHandoffDiagnostic>()
    const datedSupplies = new Map<string, Date>()
    const referencedSupplies = new Set<string>()
    let hasHandoffEvidence = false
    const diagnose = (reason: FbsHandoffUnknownReason, supplyExternalId: string | null) => {
      orderDiagnostics.set(`${reason}:${supplyExternalId ?? ''}`, { orderKey, supplyExternalId, reason })
    }
    for (const order of records) {
      for (const evidence of [order, ...(order.events ?? [])]) {
        if (!isConfirmedHandoffStatus(evidence)) continue
        hasHandoffEvidence = true
        const supplyExternalId = evidence.supplyExternalId?.trim() || null
        if (supplyExternalId) referencedSupplies.add(supplyExternalId)
        const supply = supplyExternalId ? supplies.get(identity(order.wbAccountId, supplyExternalId)) : undefined
        if (!supply) {
          diagnose('MISSING_SUPPLY', supplyExternalId)
          continue
        }
        if (!supply.done) {
          diagnose('SUPPLY_NOT_CLOSED', supplyExternalId)
          continue
        }
        if (!supply.closedAt) {
          diagnose('MISSING_CLOSED_AT', supplyExternalId)
          continue
        }
        const closedAt = supply.closedAt.getTime()
        if (!Number.isFinite(closedAt)) {
          diagnose('INVALID_CLOSED_AT', supplyExternalId)
          continue
        }
        if (closedAt > asOf) continue
        if (order.createdAtWb && closedAt < order.createdAtWb.getTime()) {
          diagnose('CLOSED_BEFORE_ORDER', supplyExternalId)
          continue
        }
        if (evidence.observedAt && closedAt > evidence.observedAt.getTime()) {
          diagnose('CLOSED_AFTER_OBSERVATION', supplyExternalId)
          continue
        }
        datedSupplies.set(supplyExternalId!, supply.closedAt)
      }
    }
    if (!hasHandoffEvidence && records.some((order) => order.shipmentApplied)) {
      // shipmentApplied survives later transitions, but does not identify the historical supply.
      diagnose('HANDOFF_WITHOUT_SUPPLY_EVIDENCE', null)
    }
    if (referencedSupplies.size > 1) reshipmentOrderKeys.push(orderKey)
    if (orderDiagnostics.size) {
      unknown++
      diagnostics.push(...Array.from(orderDiagnostics.values()))
      // A missing date could precede a known reshipment; do not label it the first handoff.
      continue
    }
    const first = Array.from(datedSupplies).sort(([, left], [, right]) => left.getTime() - right.getTime())[0]
    if (!first) continue
    firstHandoffs.push({
      orderKey,
      wbAccountId: records[0].wbAccountId,
      externalOrderId: records[0].externalOrderId,
      supplyExternalId: first[0],
      handedOverAt: first[1],
    })
    if (first[1].getTime() >= start && first[1].getTime() < end) {
      lowerBound++
      let acceptanceConfirmed = false
      const seenAcceptanceDiagnostics = new Set<string>()
      for (const evidence of records.flatMap((order) => [order, ...(order.events ?? [])])) {
        const wbStatus = evidence.wbStatus?.trim() ?? ''
        if (!(FBS_WB_ACCEPTANCE_STATUSES as readonly string[]).includes(wbStatus)) continue
        let reason: FbsAcceptanceDiagnostic['reason'] | null = null
        if (!evidence.observedAt) reason = 'MISSING_OBSERVED_AT'
        else if (!Number.isFinite(evidence.observedAt.getTime())) reason = 'INVALID_OBSERVED_AT'
        else if (evidence.observedAt.getTime() > asOf) reason = 'OBSERVED_AFTER_CUTOFF'
        else if (evidence.observedAt.getTime() < first[1].getTime()) reason = 'OBSERVED_BEFORE_HANDOFF'
        if (!reason) acceptanceConfirmed = true
        else if (!seenAcceptanceDiagnostics.has(`${wbStatus}:${reason}`)) {
          seenAcceptanceDiagnostics.add(`${wbStatus}:${reason}`)
          acceptanceDiagnostics.push({ orderKey, wbStatus, reason })
        }
      }
      if (acceptanceConfirmed) confirmedAcceptanceOrderKeys.push(orderKey)
    }
  }

  return {
    metricKind: 'WB_SYSTEM_DELIVERY' as const,
    dateBasis: FBS_HANDOFF_DATE_BASIS,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    asOf: params.asOf.toISOString(),
    status: unknown ? 'INCOMPLETE' as const : 'EXACT' as const,
    units: unknown ? null : lowerBound,
    lowerBound,
    unknown,
    diagnostics,
    reshipmentOrderKeys,
    firstHandoffs,
    confirmedAcceptance: unknown ? null : confirmedAcceptanceOrderKeys.length,
    // This is absence of evidence in the same handoff cohort, not evidence of non-acceptance.
    unknownAcceptance: unknown ? null : lowerBound - confirmedAcceptanceOrderKeys.length,
    confirmedAcceptanceOrderKeys,
    acceptanceDiagnostics,
  }
}

function isConfirmedHandoffStatus(evidence: FbsHandoffStatusEvidence) {
  const wbStatus = evidence.wbStatus?.trim()
  if (wbStatus === 'canceled' || wbStatus === 'declined_by_client') return false
  return evidence.supplierStatus?.trim() === 'complete' || [
    'sorted', 'ready_for_pickup', 'sold', 'canceled_by_client', 'defect', 'accepted_by_carrier',
  ].includes(wbStatus ?? '')
}

function identity(account: string, externalId: string) {
  if (!account.trim() || !externalId.trim()) throw new Error('Нет кабинета или внешнего ID для метрики передачи')
  return `${account.trim()}:${externalId.trim()}`
}

function timestamp(value: Date | null) {
  return value ? value.getTime() : null
}

function moscowDayStart(value: string) {
  const date = new Date(`${value}T00:00:00+03:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || moscowDateString(date) !== value) {
    throw new Error(`Некорректная дата периода передачи в доставку: ${value}`)
  }
  return date.getTime()
}
