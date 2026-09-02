import assert from 'node:assert/strict'
import test from 'node:test'
import {
  daysUntilWbTokenExpiration,
  extractWbTokenExpiration,
  getMoscowDateKey,
  shouldWarnAboutWbToken,
} from './token-expiration'

function fakeToken(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`
}

test('extractWbTokenExpiration reads a standard JWT exp claim', () => {
  const expiration = extractWbTokenExpiration(fakeToken({ exp: 1_800_000_000 }))
  assert.equal(expiration?.toISOString(), '2027-01-15T08:00:00.000Z')
})

test('extractWbTokenExpiration safely rejects opaque or malformed tokens', () => {
  assert.equal(extractWbTokenExpiration('opaque-token'), null)
  assert.equal(extractWbTokenExpiration(fakeToken({ exp: 'tomorrow' })), null)
})

test('expiration countdown follows Moscow calendar days', () => {
  const now = new Date('2026-09-02T20:30:00.000Z') // 2026-09-02 23:30 MSK
  assert.equal(daysUntilWbTokenExpiration('2026-09-12T10:00:00.000Z', now), 10)
  assert.equal(getMoscowDateKey(now), '2026-09-02')
  assert.equal(shouldWarnAboutWbToken('2026-09-12T10:00:00.000Z', now), true)
  assert.equal(shouldWarnAboutWbToken('2026-09-13T10:00:00.000Z', now), false)
  assert.equal(shouldWarnAboutWbToken('2026-09-01T10:00:00.000Z', now), true)
})
