import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { prisma } from '@/lib/db'
import { ensureFbsMovementSheetWorkflow } from './workflows'

function stub(t: TestContext, target: unknown, method: string, replacement: unknown) {
  const object = target as Record<string, unknown>
  const original = object[method]
  object[method] = replacement
  t.after(() => { object[method] = original })
}

function fixture(t: TestContext) {
  const config = {
    spreadsheetId: 'old-sheet', accountKeys: { old: 'old-account' } as Record<string, string>,
    productAliases: { 'old-account:10:101': 'Исходный товар' } as Record<string, string>,
    startDate: '2026-08-10', extraSetting: { preserve: true },
  }
  const workflow = { id: 'workflow', config, updatedAt: new Date('2026-09-07T09:00:00Z'), timeOfDay: '10:30' }
  stub(t, prisma.automationWorkflowSetting, 'upsert', async () => structuredClone(workflow))
  stub(t, prisma.wbAccount, 'findMany', async () => [{ id: 'new', name: 'Nimba' }])
  stub(t, prisma.automationWorkflowAccount, 'upsert', async () => ({ id: 'new-mapping' }))
  stub(t, prisma.automationWorkflowSetting, 'update', async () => assert.fail('discovery must not unconditionally overwrite settings'))
  return workflow
}

test('new account discovery retries after an alias confirmation and preserves the entire latest config', async (t) => {
  const initial = fixture(t)
  let current = structuredClone(initial)
  let attempts = 0
  stub(t, prisma.automationWorkflowSetting, 'findUniqueOrThrow', async () => structuredClone(current))
  stub(t, prisma.automationWorkflowSetting, 'updateMany', async ({ where, data }: {
    where: { updatedAt: Date; config: { equals: unknown } }; data: { config: typeof current.config }
  }) => {
    attempts++
    assert.equal(where.updatedAt.toISOString(), initial.updatedAt.toISOString())
    if (attempts === 1) {
      assert.deepEqual(where.config.equals, initial.config)
      // Keep the same millisecond timestamp: the JSON condition must detect this write too.
      current = { ...current, config: { ...current.config, spreadsheetId: 'new-sheet',
        productAliases: { ...current.config.productAliases, 'old-account:20:201': 'Подтверждённый параллельно товар' },
      } }
      return { count: 0 }
    }
    assert.deepEqual(where.config.equals, current.config)
    current = { ...current, config: data.config }
    return { count: 1 }
  })
  const saved = await ensureFbsMovementSheetWorkflow()
  assert.equal(attempts, 2)
  assert.deepEqual(saved.config, {
    ...current.config,
    spreadsheetId: 'new-sheet', accountKeys: { old: 'old-account', new: 'nimba' },
    productAliases: { 'old-account:10:101': 'Исходный товар', 'old-account:20:201': 'Подтверждённый параллельно товар' },
    extraSetting: { preserve: true },
  })
})

test('another discovery may satisfy the missing key without a second write', async (t) => {
  let current = fixture(t)
  let attempts = 0
  stub(t, prisma.automationWorkflowSetting, 'findUniqueOrThrow', async () => structuredClone(current))
  stub(t, prisma.automationWorkflowSetting, 'updateMany', async () => {
    attempts++
    current = { ...current, config: { ...current.config,
      accountKeys: { ...current.config.accountKeys, new: 'custom-key' },
      productAliases: { ...current.config.productAliases, 'old-account:30:301': 'Ещё одно подтверждение' },
    } }
    return { count: 0 }
  })
  const saved = await ensureFbsMovementSheetWorkflow()
  assert.equal(attempts, 1)
  const config = saved.config as typeof current.config
  assert.equal(config.accountKeys.new, 'custom-key', 'a concurrently selected account key must not be replaced by a default')
  assert.equal(config.productAliases['old-account:30:301'], 'Ещё одно подтверждение')
})

test('persistent concurrent writes stop after the bounded retries and never replace latest aliases', async (t) => {
  let current = fixture(t)
  let attempts = 0
  stub(t, prisma.automationWorkflowSetting, 'findUniqueOrThrow', async () => structuredClone(current))
  stub(t, prisma.automationWorkflowSetting, 'updateMany', async () => {
    attempts++
    current = { ...current, config: { ...current.config,
      productAliases: { ...current.config.productAliases, [`old-account:${attempts}:999`]: `Товар ${attempts}` },
    } }
    return { count: 0 }
  })
  await assert.rejects(() => ensureFbsMovementSheetWorkflow(), /одновременно изменились/)
  assert.equal(attempts, 3)
  assert.equal(Object.keys(current.config.productAliases).length, 4)
  assert.equal(current.config.accountKeys.new, undefined)
})
