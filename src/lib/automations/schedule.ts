import type { AutomationSchedule } from '@/types/automations'
import {
  buildFlexibleScheduleRules,
  defaultFlexibleSchedule,
  expandFlexibleScheduleTimes,
  flexibleScheduleFingerprint,
  flexibleScheduleMatchesMoscowDate,
  formatFlexibleSchedule,
  getNextFlexibleRunAt,
  normalizeFlexibleSchedule,
  primaryFlexibleTime,
  validateFlexibleSchedule,
} from '@/lib/schedules/flexible-schedule'

export type AutomationScheduleRule = ReturnType<typeof buildFlexibleScheduleRules>[number]

export function defaultAutomationSchedule(timeOfDay = '10:00'): AutomationSchedule {
  return defaultFlexibleSchedule(timeOfDay)
}

export function normalizeAutomationSchedule(value: unknown, fallbackTime = '10:00'): AutomationSchedule {
  return normalizeFlexibleSchedule(value, fallbackTime)
}

export function validateAutomationSchedule(value: AutomationSchedule): AutomationSchedule {
  return validateFlexibleSchedule(value)
}

export function expandAutomationScheduleTimes(schedule: AutomationSchedule): string[] {
  return expandFlexibleScheduleTimes(schedule)
}

export function buildAutomationScheduleRules(schedule: AutomationSchedule): AutomationScheduleRule[] {
  return buildFlexibleScheduleRules(schedule)
}

export function automationScheduleMatchesMoscowDate(
  schedule: AutomationSchedule,
  parts: { year: number; month: number; day: number },
): boolean {
  return flexibleScheduleMatchesMoscowDate(schedule, parts)
}

export function getNextAutomationRunAt(schedule: AutomationSchedule, now = new Date()): Date {
  return getNextFlexibleRunAt(schedule, now)
}

export function automationScheduleFingerprint(schedule: AutomationSchedule): string {
  return flexibleScheduleFingerprint(schedule)
}

export function formatAutomationSchedule(schedule: AutomationSchedule): string {
  return formatFlexibleSchedule(schedule)
}

export function primaryAutomationTime(schedule: AutomationSchedule): string {
  return primaryFlexibleTime(schedule)
}
