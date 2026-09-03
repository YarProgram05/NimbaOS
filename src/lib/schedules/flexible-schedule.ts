import type { FlexibleSchedule, ScheduleCadence, ScheduleTimeMode } from '@/types/schedules'

const MOSCOW_UTC_OFFSET_HOURS = 3

export interface FlexibleScheduleRule {
  idSuffix: string
  pattern: string
  scheduledTime: string
}

export interface FlexibleScheduleValidationOptions {
  allowedCadences?: ScheduleCadence[]
  allowedTimeModes?: ScheduleTimeMode[]
  maxRunsPerDay?: number
}

function validateTime(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Укажите время в формате ЧЧ:ММ')
  const [hours, minutes] = value.split(':').map(Number)
  if (hours > 23 || minutes > 59) throw new Error(`Некорректное время: ${value}`)
  return hours * 60 + minutes
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function uniqueSortedNumbers(values: number[], min: number, max: number): number[] {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= min && value <= max)))
    .sort((a, b) => a - b)
}

function uniqueSortedTimes(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((a, b) => validateTime(a) - validateTime(b))
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function defaultFlexibleSchedule(timeOfDay = '10:00'): FlexibleSchedule {
  validateTime(timeOfDay)
  const today = moscowDateParts(new Date())
  return {
    cadence: 'daily',
    timeMode: 'times',
    times: [timeOfDay],
    interval: { startTime: '09:00', endTime: '18:00', everyMinutes: 60 },
    weekdays: [1],
    weekInterval: 2,
    anchorDate: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    monthDays: [1],
  }
}

export function normalizeFlexibleSchedule(
  value: unknown,
  fallbackTime = '10:00',
  options: FlexibleScheduleValidationOptions = {},
): FlexibleSchedule {
  const fallback = defaultFlexibleSchedule(fallbackTime)
  if (!value || typeof value !== 'object') return validateFlexibleSchedule(fallback, options)
  const raw = value as Partial<FlexibleSchedule>
  const interval = raw.interval && typeof raw.interval === 'object' ? raw.interval : fallback.interval

  const schedule: FlexibleSchedule = {
    cadence: ['daily', 'weekly', 'every-n-weeks', 'monthly'].includes(String(raw.cadence))
      ? raw.cadence as FlexibleSchedule['cadence']
      : fallback.cadence,
    timeMode: raw.timeMode === 'interval' ? 'interval' : 'times',
    times: Array.isArray(raw.times) ? raw.times.filter((time): time is string => typeof time === 'string') : fallback.times,
    interval: {
      startTime: typeof interval.startTime === 'string' ? interval.startTime : fallback.interval.startTime,
      endTime: typeof interval.endTime === 'string' ? interval.endTime : fallback.interval.endTime,
      everyMinutes: Number(interval.everyMinutes ?? fallback.interval.everyMinutes),
    },
    weekdays: Array.isArray(raw.weekdays) ? raw.weekdays.map(Number) : fallback.weekdays,
    weekInterval: Number(raw.weekInterval ?? fallback.weekInterval),
    anchorDate: typeof raw.anchorDate === 'string' ? raw.anchorDate : fallback.anchorDate,
    monthDays: Array.isArray(raw.monthDays) ? raw.monthDays.map(Number) : fallback.monthDays,
  }

  return validateFlexibleSchedule(schedule, options)
}

export function validateFlexibleSchedule(
  value: FlexibleSchedule,
  options: FlexibleScheduleValidationOptions = {},
): FlexibleSchedule {
  const schedule: FlexibleSchedule = {
    ...value,
    times: uniqueSortedTimes(value.times),
    weekdays: uniqueSortedNumbers(value.weekdays, 1, 7),
    monthDays: uniqueSortedNumbers(value.monthDays, 1, 31),
    weekInterval: Math.trunc(value.weekInterval),
    interval: { ...value.interval, everyMinutes: Math.trunc(value.interval.everyMinutes) },
  }
  const maxRunsPerDay = options.maxRunsPerDay ?? 96

  if (options.allowedCadences && !options.allowedCadences.includes(schedule.cadence)) {
    throw new Error('Эта периодичность недоступна для выбранной задачи')
  }
  if (options.allowedTimeModes && !options.allowedTimeModes.includes(schedule.timeMode)) {
    throw new Error('Этот режим времени недоступен для выбранной задачи')
  }

  if (schedule.timeMode === 'times') {
    if (schedule.times.length === 0) throw new Error('Добавьте хотя бы одно время запуска')
    if (schedule.times.length > 24) throw new Error('Можно указать не более 24 запусков в день')
  } else {
    const start = validateTime(schedule.interval.startTime)
    const end = validateTime(schedule.interval.endTime)
    if (end < start) throw new Error('Конец интервала должен быть позже начала')
    if (schedule.interval.everyMinutes < 5 || schedule.interval.everyMinutes > 720) {
      throw new Error('Интервал запуска должен быть от 5 до 720 минут')
    }
    if (Math.floor((end - start) / schedule.interval.everyMinutes) + 1 > maxRunsPerDay) {
      throw new Error(`В одном дне может быть не более ${maxRunsPerDay} запусков`)
    }
  }

  if (schedule.cadence === 'weekly' || schedule.cadence === 'every-n-weeks') {
    if (schedule.weekdays.length === 0) throw new Error('Выберите хотя бы один день недели')
  }
  if (schedule.cadence === 'every-n-weeks') {
    if (schedule.weekInterval < 2 || schedule.weekInterval > 12) {
      throw new Error('Интервал недель должен быть от 2 до 12')
    }
    if (!isIsoDate(schedule.anchorDate)) throw new Error('Укажите дату начала отсчёта недель')
  }
  if (schedule.cadence === 'monthly' && schedule.monthDays.length === 0) {
    throw new Error('Выберите хотя бы один день месяца')
  }

  return schedule
}

export function expandFlexibleScheduleTimes(
  schedule: FlexibleSchedule,
  options: FlexibleScheduleValidationOptions = {},
): string[] {
  const normalized = validateFlexibleSchedule(schedule, options)
  if (normalized.timeMode === 'times') return normalized.times
  const start = validateTime(normalized.interval.startTime)
  const end = validateTime(normalized.interval.endTime)
  const times: string[] = []
  for (let minute = start; minute <= end; minute += normalized.interval.everyMinutes) {
    times.push(formatTime(minute))
  }
  return times
}

function cronDayOfWeek(day: number): number {
  return day === 7 ? 0 : day
}

export function buildFlexibleScheduleRules(
  schedule: FlexibleSchedule,
  options: FlexibleScheduleValidationOptions = {},
): FlexibleScheduleRule[] {
  const normalized = validateFlexibleSchedule(schedule, options)
  const times = expandFlexibleScheduleTimes(normalized, options)
  const dayExpression = normalized.weekdays.map(cronDayOfWeek).sort((a, b) => a - b).join(',')
  const monthDayExpression = normalized.monthDays.join(',')

  return times.map((time) => {
    const [hours, minutes] = time.split(':').map(Number)
    const pattern = normalized.cadence === 'daily'
      ? `0 ${minutes} ${hours} * * *`
      : normalized.cadence === 'monthly'
        ? `0 ${minutes} ${hours} ${monthDayExpression} * *`
        : `0 ${minutes} ${hours} * * ${dayExpression}`
    return { idSuffix: time.replace(':', ''), pattern, scheduledTime: time }
  })
}

function weekday(parts: { year: number; month: number; day: number }): number {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  return day === 0 ? 7 : day
}

function utcDayNumber(parts: { year: number; month: number; day: number }): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000)
}

function mondayDayNumber(parts: { year: number; month: number; day: number }): number {
  return utcDayNumber(parts) - (weekday(parts) - 1)
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function flexibleScheduleMatchesMoscowDate(
  schedule: FlexibleSchedule,
  parts: { year: number; month: number; day: number },
  options: FlexibleScheduleValidationOptions = {},
): boolean {
  const normalized = validateFlexibleSchedule(schedule, options)
  if (normalized.cadence === 'daily') return true
  if (normalized.cadence === 'monthly') return normalized.monthDays.includes(parts.day)
  if (!normalized.weekdays.includes(weekday(parts))) return false
  if (normalized.cadence === 'weekly') return true

  const anchorMonday = mondayDayNumber(parseIsoDate(normalized.anchorDate))
  const candidateMonday = mondayDayNumber(parts)
  const weekDifference = Math.floor((candidateMonday - anchorMonday) / 7)
  return positiveModulo(weekDifference, normalized.weekInterval) === 0
}

function moscowDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day') }
}

function addCalendarDays(parts: { year: number; month: number; day: number }, days: number) {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12))
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
}

function moscowWallTimeToUtc(parts: { year: number; month: number; day: number }, time: string): Date {
  const total = validateTime(time)
  return new Date(Date.UTC(
    parts.year, parts.month - 1, parts.day,
    Math.floor(total / 60) - MOSCOW_UTC_OFFSET_HOURS, total % 60,
  ))
}

export function getNextFlexibleRunAt(
  schedule: FlexibleSchedule,
  now = new Date(),
  options: FlexibleScheduleValidationOptions = {},
): Date {
  const normalized = validateFlexibleSchedule(schedule, options)
  const times = expandFlexibleScheduleTimes(normalized, options)
  const today = moscowDateParts(now)

  for (let offset = 0; offset <= 400; offset++) {
    const date = addCalendarDays(today, offset)
    if (!flexibleScheduleMatchesMoscowDate(normalized, date, options)) continue
    for (const time of times) {
      const candidate = moscowWallTimeToUtc(date, time)
      if (candidate > now) return candidate
    }
  }

  throw new Error('Не удалось определить следующий запуск в пределах 400 дней')
}

export function getNextFlexibleRuns(
  schedule: FlexibleSchedule,
  count: number,
  now = new Date(),
  options: FlexibleScheduleValidationOptions = {},
): Date[] {
  const result: Date[] = []
  let cursor = now
  for (let index = 0; index < count; index++) {
    const next = getNextFlexibleRunAt(schedule, cursor, options)
    result.push(next)
    cursor = new Date(next.getTime() + 1)
  }
  return result
}

export function flexibleScheduleFingerprint(
  schedule: FlexibleSchedule,
  options: FlexibleScheduleValidationOptions = {},
): string {
  const normalized = validateFlexibleSchedule(schedule, options)
  const effectiveSchedule: Record<string, unknown> = {
    cadence: normalized.cadence,
    timeMode: normalized.timeMode,
  }

  if (normalized.timeMode === 'times') {
    effectiveSchedule.times = normalized.times
  } else {
    effectiveSchedule.interval = normalized.interval
  }

  if (normalized.cadence === 'weekly' || normalized.cadence === 'every-n-weeks') {
    effectiveSchedule.weekdays = normalized.weekdays
  }
  if (normalized.cadence === 'every-n-weeks') {
    effectiveSchedule.weekInterval = normalized.weekInterval
    effectiveSchedule.anchorDate = normalized.anchorDate
  }
  if (normalized.cadence === 'monthly') {
    effectiveSchedule.monthDays = normalized.monthDays
  }

  return JSON.stringify(effectiveSchedule)
}

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function formatFlexibleSchedule(
  schedule: FlexibleSchedule,
  options: FlexibleScheduleValidationOptions = {},
): string {
  const normalized = validateFlexibleSchedule(schedule, options)
  const times = normalized.timeMode === 'times'
    ? normalized.times.join(', ')
    : `${normalized.interval.startTime}–${normalized.interval.endTime}, каждые ${normalized.interval.everyMinutes} мин.`
  if (normalized.cadence === 'daily') return `Каждый день · ${times}`
  if (normalized.cadence === 'monthly') return `Ежемесячно: ${normalized.monthDays.join(', ')} числа · ${times}`
  const days = normalized.weekdays.map((day) => WEEKDAY_SHORT[day - 1]).join(', ')
  return normalized.cadence === 'weekly'
    ? `${days} · ${times}`
    : `Каждые ${normalized.weekInterval} нед.: ${days} · ${times}`
}

export function primaryFlexibleTime(
  schedule: FlexibleSchedule,
  options: FlexibleScheduleValidationOptions = {},
): string {
  return expandFlexibleScheduleTimes(schedule, options)[0]
}
