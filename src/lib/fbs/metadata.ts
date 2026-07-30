export interface FbsOrderMetadataState {
  ready: boolean
  label: string
  issue: string | null
}

const VALID_WB_KIZ_STATUSES = new Set(['VALID', 'attached'])

const WB_KIZ_ISSUES: Record<string, string> = {
  GTIN_MISMATCH: 'GTIN КИЗа не совпадает с GTIN артикула',
  ORDER_CONFLICT: 'КИЗ уже закреплён за другим заказом',
  STATE_CONFLICT: 'Текущее состояние КИЗа не позволяет закрепить его за заказом',
}

export function getFbsOrderMetadataState(input: {
  metadata: unknown
  requiresKiz: boolean
  hasKiz: boolean
  wbKizValidationStatus: string | null
}): FbsOrderMetadataState {
  if (input.requiresKiz && !input.hasKiz) {
    return {
      ready: false,
      label: 'Нет КИЗа',
      issue: 'WB не вернул закреплённый КИЗ для этого заказа',
    }
  }

  if (
    input.requiresKiz &&
    input.wbKizValidationStatus &&
    !VALID_WB_KIZ_STATUSES.has(input.wbKizValidationStatus)
  ) {
    return {
      ready: false,
      label: 'Конфликт',
      issue:
        WB_KIZ_ISSUES[input.wbKizValidationStatus] ??
        `КИЗ не прошёл проверку WB: ${input.wbKizValidationStatus}`,
    }
  }

  if (
    input.requiresKiz &&
    !VALID_WB_KIZ_STATUSES.has(input.wbKizValidationStatus ?? '')
  ) {
    return {
      ready: false,
      label: 'Не подтверждено',
      issue: 'КИЗ есть в NimbaOS, но его привязка к заказу ещё не подтверждена метаданными WB',
    }
  }

  if (input.metadata && typeof input.metadata === 'object') {
    const serialized = JSON.stringify(input.metadata).toLowerCase()
    if (serialized.includes('error') || serialized.includes('false')) {
      return {
        ready: false,
        label: 'Ошибка WB',
        issue: 'WB вернул ошибку или неподтверждённое значение метаданных',
      }
    }
  }

  if (!input.requiresKiz && !input.metadata) {
    return { ready: true, label: 'Не требуются', issue: null }
  }

  return { ready: true, label: 'Получены', issue: null }
}
