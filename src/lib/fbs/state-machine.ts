import type { FbsSupplierStatus, FbsWbStatus } from '@/types/fbs'

export interface FbsOrderState {
  supplierStatus: FbsSupplierStatus
  wbStatus: FbsWbStatus
  reservationApplied: boolean
  shipmentApplied: boolean
  hasKiz: boolean
  requiresKiz: boolean
}

export type FbsTransitionAction =
  | 'RESERVE'
  | 'RELEASE'
  | 'SHIP'
  | 'UNASSIGN_KIZ'
  | 'MARK_HANDED_OVER'
  | 'CREATE_WITHDRAWAL_TASK'
  | 'MARK_RETURN_EXPECTED'

const PRE_HANDOFF_CANCELLATIONS = new Set([
  'canceled',
  'canceled_by_client',
  'declined_by_client',
  'defect',
])

const POST_HANDOFF_RETURN_STATUSES = new Set([
  'canceled_by_client',
  'defect',
])

export function isFbsOrderCanceledBeforeHandoff(input: {
  supplierStatus: FbsSupplierStatus
  wbStatus: FbsWbStatus
  shipmentApplied: boolean
}) {
  return (
    !input.shipmentApplied &&
    (input.supplierStatus === 'cancel' || PRE_HANDOFF_CANCELLATIONS.has(input.wbStatus))
  )
}

export function isFbsPostHandoffReturnStatus(wbStatus: FbsWbStatus) {
  return POST_HANDOFF_RETURN_STATUSES.has(wbStatus)
}

export function deriveFbsTransition(
  previous: FbsOrderState | null,
  next: FbsOrderState,
  options: { enforceShipmentGuard?: boolean } = {},
): FbsTransitionAction[] {
  const actions: FbsTransitionAction[] = []
  const wasReserved = previous?.reservationApplied ?? false
  const wasShipped = previous?.shipmentApplied ?? false
  const canceledBeforeHandoff = isFbsOrderCanceledBeforeHandoff({
    supplierStatus: next.supplierStatus,
    wbStatus: next.wbStatus,
    shipmentApplied: wasShipped,
  })

  if (
    !wasReserved &&
    !wasShipped &&
    !canceledBeforeHandoff &&
    (next.supplierStatus === 'new' || next.supplierStatus === 'confirm')
  ) {
    actions.push('RESERVE')
  }

  if (wasReserved && canceledBeforeHandoff) {
    actions.push('RELEASE')
  }
  if (canceledBeforeHandoff && next.hasKiz) actions.push('UNASSIGN_KIZ')

  if (!wasShipped && next.supplierStatus === 'complete') {
    if (next.requiresKiz && !next.hasKiz && options.enforceShipmentGuard !== false) {
      throw new Error('Нельзя передать маркированный заказ без назначенного КИЗа')
    }
    actions.push('SHIP')
    if (next.hasKiz) {
      actions.push('MARK_HANDED_OVER')
      actions.push('CREATE_WITHDRAWAL_TASK')
    }
  }

  if (
    next.wbStatus === 'sold' &&
    next.hasKiz &&
    (previous?.wbStatus !== 'sold' || !previous?.hasKiz) &&
    !actions.includes('CREATE_WITHDRAWAL_TASK')
  ) {
    actions.push('CREATE_WITHDRAWAL_TASK')
  }

  if (
    wasShipped &&
    previous?.wbStatus !== next.wbStatus &&
    POST_HANDOFF_RETURN_STATUSES.has(next.wbStatus) &&
    next.hasKiz
  ) {
    actions.push('MARK_RETURN_EXPECTED')
  }

  return actions
}

export function assertInventoryBalance(onHand: number, reserved: number) {
  if (!Number.isInteger(onHand) || !Number.isInteger(reserved)) {
    throw new Error('Остатки должны быть целыми числами')
  }
  if (onHand < 0) throw new Error('Остаток FBS не может быть отрицательным')
  if (reserved < 0) throw new Error('Резерв FBS не может быть отрицательным')
  if (reserved > onHand) throw new Error('Резерв FBS не может превышать физический остаток')
}

export function isOrderMetadataReady(input: {
  requiresKiz: boolean
  hasKiz: boolean
  metadataStatus?: unknown
}) {
  if (input.requiresKiz && !input.hasKiz) return false
  if (!input.metadataStatus || typeof input.metadataStatus !== 'object') return true

  const status = input.metadataStatus as Record<string, unknown>
  if (status.error || status.errors) return false
  if (status.sgtin === false || status.kiz === false) return false
  return true
}
