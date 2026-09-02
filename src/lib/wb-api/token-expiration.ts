const MOSCOW_TIME_ZONE = 'Europe/Moscow'
const DAY_MS = 24 * 60 * 60 * 1000

interface TokenPayload {
  exp?: unknown
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Reads the standard JWT exp claim. This is display metadata only; token validity
 * is still established by the normal authenticated WB API request.
 */
export function extractWbTokenExpiration(apiKey: string): Date | null {
  try {
    const token = apiKey.trim().replace(/^Bearer\s+/i, '')
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return null

    const payload = JSON.parse(decodeBase64Url(parts[1])) as TokenPayload
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null

    const expiration = new Date(payload.exp * 1000)
    return Number.isNaN(expiration.getTime()) ? null : expiration
  } catch {
    return null
  }
}

function moscowCalendarDay(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return Math.floor(Date.UTC(read('year'), read('month') - 1, read('day')) / DAY_MS)
}

export function daysUntilWbTokenExpiration(expiresAt: string | Date, now = new Date()): number {
  const expiration = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return moscowCalendarDay(expiration) - moscowCalendarDay(now)
}

export function shouldWarnAboutWbToken(
  expiresAt: string | Date,
  now = new Date(),
  warningDays = 10
): boolean {
  return daysUntilWbTokenExpiration(expiresAt, now) <= warningDays
}

export function getMoscowDateKey(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
