import assert from 'node:assert/strict'
import test from 'node:test'
import {
  changeEmailSchema,
  changePasswordSchema,
  isSessionCurrent,
  normalizeEmail,
} from './account-security'

test('normalizeEmail trims and lowercases an email', () => {
  assert.equal(normalizeEmail('  Owner@Example.COM '), 'owner@example.com')
})

test('changeEmailSchema rejects an invalid email', () => {
  assert.equal(
    changeEmailSchema.safeParse({ currentPassword: 'old-password', newEmail: 'wrong' }).success,
    false
  )
})

test('changePasswordSchema requires 12 characters and matching confirmation', () => {
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: 'old-password',
      newPassword: 'short',
      confirmPassword: 'short',
    }).success,
    false
  )

  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: 'old-password',
      newPassword: 'a-secure-password',
      confirmPassword: 'different-password',
    }).success,
    false
  )
})

test('isSessionCurrent rejects legacy, revoked and inactive sessions', () => {
  assert.equal(isSessionCurrent({ isActive: true, sessionVersion: 2 }, 2), true)
  assert.equal(isSessionCurrent({ isActive: true, sessionVersion: 2 }, 1), false)
  assert.equal(isSessionCurrent({ isActive: false, sessionVersion: 2 }, 2), false)
  assert.equal(isSessionCurrent({ isActive: true, sessionVersion: 0 }, undefined), false)
  assert.equal(isSessionCurrent(null, 0), false)
})
