import assert from 'node:assert/strict'
import test from 'node:test'
import { getFbsOrderMetadataState } from './metadata'

test('WB metadata is ready when an attached KIZ is validated regardless of circulation state', () => {
  assert.deepEqual(
    getFbsOrderMetadataState({
      metadata: { sgtin: '[REDACTED]' },
      requiresKiz: true,
      hasKiz: true,
      wbKizValidationStatus: 'VALID',
    }),
    { ready: true, label: 'Получены', issue: null },
  )
})

test('WB metadata explains a missing KIZ instead of using a generic blocked label', () => {
  assert.deepEqual(
    getFbsOrderMetadataState({
      metadata: { sgtin: '[REDACTED]' },
      requiresKiz: true,
      hasKiz: false,
      wbKizValidationStatus: null,
    }),
    {
      ready: false,
      label: 'Нет КИЗа',
      issue: 'WB не вернул закреплённый КИЗ для этого заказа',
    },
  )
})

test('WB metadata exposes a safe GTIN conflict explanation', () => {
  const state = getFbsOrderMetadataState({
    metadata: { sgtin: '[REDACTED]' },
    requiresKiz: true,
    hasKiz: true,
    wbKizValidationStatus: 'GTIN_MISMATCH',
  })
  assert.equal(state.ready, false)
  assert.equal(state.label, 'Конфликт')
  assert.match(state.issue ?? '', /GTIN/)
})
