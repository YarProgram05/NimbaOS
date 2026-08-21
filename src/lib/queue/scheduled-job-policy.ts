export const DEFAULT_SCHEDULED_START_GRACE_MINUTES = 18 * 60
export const MAX_SCHEDULED_START_GRACE_MINUTES = 24 * 60 - 1

export function resolveScheduledStartGraceMinutes(
  rawValue = process.env.SCHEDULED_START_GRACE_MINUTES,
): number {
  if (!rawValue?.trim()) return DEFAULT_SCHEDULED_START_GRACE_MINUTES

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SCHEDULED_START_GRACE_MINUTES
  }

  return Math.min(Math.floor(parsed), MAX_SCHEDULED_START_GRACE_MINUTES)
}

export function isScheduledJobTooLate(
  lateMinutes: number,
  graceMinutes = resolveScheduledStartGraceMinutes(),
): boolean {
  return lateMinutes > graceMinutes
}
