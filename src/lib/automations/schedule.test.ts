import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAutomationScheduleRules,
  defaultAutomationSchedule,
  expandAutomationScheduleTimes,
  formatAutomationSchedule,
  getNextAutomationRunAt,
} from './schedule'

test('builds several daily times', () => {
  const schedule = { ...defaultAutomationSchedule(), times: ['18:30', '09:00', '09:00'] }
  assert.deepEqual(expandAutomationScheduleTimes(schedule), ['09:00', '18:30'])
  assert.deepEqual(buildAutomationScheduleRules(schedule).map((rule) => rule.pattern), [
    '0 0 9 * * *',
    '0 30 18 * * *',
  ])
})

test('expands an interval within a day', () => {
  const schedule = {
    ...defaultAutomationSchedule(),
    timeMode: 'interval' as const,
    interval: { startTime: '09:00', endTime: '12:00', everyMinutes: 90 },
  }
  assert.deepEqual(expandAutomationScheduleTimes(schedule), ['09:00', '10:30', '12:00'])
})

test('builds weekly, multi-weekly and monthly cron rules', () => {
  const weekly = { ...defaultAutomationSchedule(), cadence: 'weekly' as const, weekdays: [1, 5] }
  assert.equal(buildAutomationScheduleRules(weekly)[0].pattern, '0 0 10 * * 1,5')

  const multi = { ...weekly, cadence: 'every-n-weeks' as const, weekInterval: 3 }
  assert.equal(buildAutomationScheduleRules(multi)[0].pattern, '0 0 10 * * 1,5')
  assert.match(formatAutomationSchedule(multi), /Каждые 3 нед\./)

  const monthly = { ...defaultAutomationSchedule(), cadence: 'monthly' as const, monthDays: [1, 15, 31] }
  assert.equal(buildAutomationScheduleRules(monthly)[0].pattern, '0 0 10 1,15,31 * *')
})

test('calculates the next Moscow run for a monthly schedule', () => {
  const schedule = {
    ...defaultAutomationSchedule('10:00'),
    cadence: 'monthly' as const,
    monthDays: [15],
  }
  const next = getNextAutomationRunAt(schedule, new Date('2026-08-16T08:00:00Z'))
  assert.equal(next.toISOString(), '2026-09-15T07:00:00.000Z')
})
