import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFlexibleScheduleRules,
  defaultFlexibleSchedule,
  expandFlexibleScheduleTimes,
  getNextFlexibleRunAt,
  validateFlexibleSchedule,
  type FlexibleScheduleValidationOptions,
} from './flexible-schedule'
import { SYNC_ALLOWED_TIME_MODES } from '@/lib/sync/catalog'

const syncOptions: FlexibleScheduleValidationOptions = {
  allowedCadences: ['daily', 'weekly'],
  allowedTimeModes: SYNC_ALLOWED_TIME_MODES,
  maxRunsPerDay: 288,
}

test('expands a bounded five-minute sync window', () => {
  const schedule = {
    ...defaultFlexibleSchedule('08:00'),
    timeMode: 'interval' as const,
    interval: { startTime: '08:00', endTime: '08:15', everyMinutes: 5 },
  }
  assert.deepEqual(expandFlexibleScheduleTimes(schedule, syncOptions), ['08:00', '08:05', '08:10', '08:15'])
  assert.deepEqual(buildFlexibleScheduleRules(schedule, syncOptions).map((rule) => rule.pattern), [
    '0 0 8 * * *', '0 5 8 * * *', '0 10 8 * * *', '0 15 8 * * *',
  ])
})

test('supports selected weekdays for sync schedules', () => {
  const schedule = {
    ...defaultFlexibleSchedule('09:30'),
    cadence: 'weekly' as const,
    weekdays: [1, 3, 5],
  }
  assert.equal(buildFlexibleScheduleRules(schedule, syncOptions)[0].pattern, '0 30 9 * * 1,3,5')
  assert.equal(
    getNextFlexibleRunAt(schedule, new Date('2026-09-01T08:00:00.000Z'), syncOptions).toISOString(),
    '2026-09-02T06:30:00.000Z',
  )
})

test('rejects unsupported monthly cadence for sync schedules', () => {
  const schedule = { ...defaultFlexibleSchedule('09:00'), cadence: 'monthly' as const }
  assert.throws(() => validateFlexibleSchedule(schedule, syncOptions), /недоступна/)
})
