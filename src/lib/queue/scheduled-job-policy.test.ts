import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SCHEDULED_START_GRACE_MINUTES,
  MAX_SCHEDULED_START_GRACE_MINUTES,
  isScheduledJobTooLate,
  resolveScheduledStartGraceMinutes,
} from './scheduled-job-policy'

test('uses an 18-hour default grace period for scheduled queue delays', () => {
  assert.equal(DEFAULT_SCHEDULED_START_GRACE_MINUTES, 1080)
  assert.equal(resolveScheduledStartGraceMinutes(undefined), 1080)
  assert.equal(isScheduledJobTooLate(14), false)
  assert.equal(isScheduledJobTooLate(1080), false)
  assert.equal(isScheduledJobTooLate(1081), true)
})

test('accepts a configured grace period and normalizes it to whole minutes', () => {
  assert.equal(resolveScheduledStartGraceMinutes('120.9'), 120)
  assert.equal(isScheduledJobTooLate(121, 120), true)
})

test('falls back for invalid values and keeps the grace below one day', () => {
  assert.equal(resolveScheduledStartGraceMinutes('not-a-number'), 1080)
  assert.equal(resolveScheduledStartGraceMinutes('-1'), 1080)
  assert.equal(resolveScheduledStartGraceMinutes('99999'), MAX_SCHEDULED_START_GRACE_MINUTES)
})
