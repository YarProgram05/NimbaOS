const MOSCOW_TIME_ZONE = 'Europe/Moscow'
const MOSCOW_UTC_OFFSET_HOURS = 3

interface MoscowDateParts {
  year: number
  month: number
  day: number
}

function moscowDateParts(value: Date): MoscowDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)

  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const raw = parts.find((part) => part.type === type)?.value
    const parsed = raw ? Number(raw) : NaN
    if (!Number.isFinite(parsed)) throw new Error('Не удалось определить московскую дату')
    return parsed
  }

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
  }
}

function moscowWallTimeToUtc(parts: MoscowDateParts, hours: number, minutes: number): Date {
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hours - MOSCOW_UTC_OFFSET_HOURS,
    minutes,
    0,
    0,
  ))
}

function addMoscowCalendarDays(parts: MoscowDateParts, days: number): MoscowDateParts {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0, 0))
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  }
}

export function getNextMoscowRunAt(timeOfDay: string, now = new Date()): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const today = moscowDateParts(now)
  let scheduled = moscowWallTimeToUtc(today, hours, minutes)

  if (scheduled <= now) {
    scheduled = moscowWallTimeToUtc(addMoscowCalendarDays(today, 1), hours, minutes)
  }

  return scheduled
}

export function minutesSinceMoscowScheduledTime(timeOfDay: string, now = new Date()): number {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const today = moscowDateParts(now)
  let scheduled = moscowWallTimeToUtc(today, hours, minutes)

  if (scheduled > now) {
    scheduled = moscowWallTimeToUtc(addMoscowCalendarDays(today, -1), hours, minutes)
  }

  return Math.floor((now.getTime() - scheduled.getTime()) / 60_000)
}
