import { createHash } from 'crypto'
import { encrypt } from '@/lib/encryption'
import type { KizParsedCode } from '@/types/fbs'

export const GROUP_SEPARATOR = '\u001d'

const VISIBLE_GS_PATTERNS = /(?:<GS>|\{GS\}|\\u001[dD]|\u241d)/g

export function normalizeKizCode(input: string): string {
  const withGs = input.replace(VISIBLE_GS_PATTERNS, GROUP_SEPARATOR).trim()
  const withoutScannerPrefix = withGs.startsWith(']d2') ? withGs.slice(3) : withGs
  return withoutScannerPrefix.replace(/[\r\n]+$/g, '')
}

export function extractFbsSgtinCodes(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []

  const metaRecord = metadata as Record<string, unknown>
  const sgtinEntry = Object.entries(metaRecord).find(([key]) => key.toLowerCase() === 'sgtin')?.[1]
  if (sgtinEntry == null) return []

  const rawValue =
    typeof sgtinEntry === 'object' && !Array.isArray(sgtinEntry)
      ? Object.entries(sgtinEntry as Record<string, unknown>)
          .find(([key]) => key.toLowerCase() === 'value')?.[1]
      : sgtinEntry
  const candidates = Array.isArray(rawValue) ? rawValue : [rawValue]
  const result = new Map<string, string>()

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = normalizeKizCode(candidate)
    if (normalized) result.set(normalized, normalized)
  }

  return Array.from(result.values())
}

export function getWbKizGtinValidationStatus(
  expectedGtin: string | null | undefined,
  actualGtin: string | null | undefined,
): 'VALID' | 'GTIN_MISMATCH' {
  return expectedGtin && actualGtin && expectedGtin !== actualGtin
    ? 'GTIN_MISMATCH'
    : 'VALID'
}

export function hashKizCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode, 'utf8').digest('hex')
}

export function parseKizCode(input: string): KizParsedCode {
  const normalized = normalizeKizCode(input)
  if (!normalized) throw new Error('КИЗ пуст')

  const values = new Map<string, string>()
  let cursor = 0

  while (cursor < normalized.length) {
    if (normalized[cursor] === GROUP_SEPARATOR) {
      cursor += 1
      continue
    }

    const ai = normalized.slice(cursor, cursor + 2)
    if (!['01', '21', '91', '92'].includes(ai)) {
      cursor += 1
      continue
    }
    cursor += 2

    if (ai === '01') {
      const value = normalized.slice(cursor, cursor + 14)
      if (!/^\d{14}$/.test(value)) throw new Error('КИЗ содержит некорректный GTIN (AI 01)')
      values.set(ai, value)
      cursor += 14
      continue
    }

    const nextGs = normalized.indexOf(GROUP_SEPARATOR, cursor)
    let end = nextGs === -1 ? normalized.length : nextGs

    if (nextGs === -1 && ai === '21') {
      const cryptoStart = findCryptoBlockStart(normalized, cursor)
      if (cryptoStart !== -1) end = cryptoStart
    } else if (nextGs === -1 && ai === '91') {
      const signatureStart = normalized.indexOf('92', cursor)
      if (signatureStart !== -1) end = signatureStart
    }

    values.set(ai, normalized.slice(cursor, end))
    cursor = end
  }

  const gtin = values.get('01') ?? null
  const serial = values.get('21') ?? null
  if (!gtin || !serial) throw new Error('КИЗ должен содержать GTIN (AI 01) и серийный номер (AI 21)')

  return {
    normalized,
    gtin,
    serial,
    verificationKey: values.get('91') ?? null,
    cryptoSignature: values.get('92') ?? null,
  }
}

function findCryptoBlockStart(value: string, from: number): number {
  const direct = value.indexOf(`${GROUP_SEPARATOR}91`, from)
  if (direct !== -1) return direct

  for (let index = value.length - 2; index >= from; index -= 1) {
    if (value.slice(index, index + 2) !== '91') continue
    const signatureStart = value.indexOf('92', index + 2)
    if (signatureStart >= index + 4) return index
  }
  return -1
}

export function maskSerial(serial: string | null): string | null {
  if (!serial) return null
  if (serial.length <= 4) return '•'.repeat(serial.length)
  return `${serial.slice(0, 2)}${'•'.repeat(Math.min(8, serial.length - 4))}${serial.slice(-2)}`
}

export function maskKizCode(parsed: KizParsedCode): string {
  const gtinPart = parsed.gtin ? `01${parsed.gtin.slice(0, 4)}…${parsed.gtin.slice(-4)}` : '01…'
  return `${gtinPart} 21${maskSerial(parsed.serial) ?? '…'}`
}

export function prepareKizForStorage(input: string) {
  const parsed = parseKizCode(input)
  return {
    parsed,
    encryptedCode: encrypt(parsed.normalized),
    codeHash: hashKizCode(parsed.normalized),
    maskedCode: maskKizCode(parsed),
    serialMasked: maskSerial(parsed.serial),
  }
}

export function containsKizSensitiveData(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const normalized = normalizeKizCode(value)
  return normalized.includes('01') && normalized.includes('21') && normalized.length > 24
}
