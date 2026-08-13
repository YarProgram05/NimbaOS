import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractFbsSgtinCodes,
  getWbKizGtinValidationStatus,
  GROUP_SEPARATOR,
  hashKizCode,
  maskKizCode,
  normalizeKizCode,
  parseKizCode,
  toKizIdentificationCode,
} from './kiz'

test('normalizes scanner prefix and preserves GS separators', () => {
  const raw = `]d2010460123456789021ABC123${GROUP_SEPARATOR}91ABCD${GROUP_SEPARATOR}92SIGNATURE`
  const normalized = normalizeKizCode(raw)
  assert.equal(normalized.startsWith('01'), true)
  assert.equal(normalized.includes(GROUP_SEPARATOR), true)
})

test('parses the marking AIs without exposing the serial in the mask', () => {
  const parsed = parseKizCode(
    `010460123456789021ABC123456${GROUP_SEPARATOR}91ABCD${GROUP_SEPARATOR}92SIGNATURE`,
  )
  assert.equal(parsed.gtin, '04601234567890')
  assert.equal(parsed.serial, 'ABC123456')
  assert.equal(parsed.verificationKey, 'ABCD')
  assert.equal(parsed.cryptoSignature, 'SIGNATURE')
  assert.equal(maskKizCode(parsed).includes('ABC123456'), false)
})

test('uses the normalized full code for a stable SHA-256 identity', () => {
  const plain = `010460123456789021ABC${GROUP_SEPARATOR}91ABCD${GROUP_SEPARATOR}92SIGN`
  assert.equal(hashKizCode(normalizeKizCode(`]d2${plain}`)), hashKizCode(plain))
  assert.equal(hashKizCode(plain).length, 64)
})

test('creates a CRPT upload code without verification key and crypto signature', () => {
  const fullCode = `010460123456789021ABC123${GROUP_SEPARATOR}91ABCD${GROUP_SEPARATOR}92SIGNATURE`
  assert.equal(toKizIdentificationCode(fullCode), '010460123456789021ABC123')
})

test('extracts and normalizes unique SGTIN values from FBS metadata', () => {
  const first = `010460123456789021ABC${GROUP_SEPARATOR}91ABCD${GROUP_SEPARATOR}92SIGN`
  const second = `010460123456789021XYZ${GROUP_SEPARATOR}91EFGH${GROUP_SEPARATOR}92CRYPT`
  assert.deepEqual(
    extractFbsSgtinCodes({
      sgtin: {
        value: [`]d2${first}`, first, second, null],
      },
    }),
    [first, second],
  )
})

test('ignores absent or malformed FBS SGTIN metadata without exposing values', () => {
  assert.deepEqual(extractFbsSgtinCodes(null), [])
  assert.deepEqual(extractFbsSgtinCodes({ sgtin: { value: null } }), [])
  assert.deepEqual(extractFbsSgtinCodes({ sgtin: { value: [123, false] } }), [])
})

test('flags only a known GTIN mismatch in WB metadata', () => {
  assert.equal(getWbKizGtinValidationStatus('04601234567890', '04601234567890'), 'VALID')
  assert.equal(
    getWbKizGtinValidationStatus('04601234567890', '04609999999999'),
    'GTIN_MISMATCH',
  )
  assert.equal(getWbKizGtinValidationStatus(null, '04601234567890'), 'VALID')
})
