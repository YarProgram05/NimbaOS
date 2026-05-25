import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getAutomationQueue, type AutomationJobData } from '@/lib/queue/automation'
import {
  fromPrismaAutomationKind,
  parseAutomationSource,
  parseTargetDate,
  toPrismaAutomationKind,
  type PrismaAutomationWorkflowKind,
} from '@/lib/automations/mapping'
import type { AutomationRunRow, EnqueuedAutomationRun } from '@/types/automations'

export function toAutomationPayloadJson(payload: unknown): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue
}

function getPeriodFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as { dateFrom?: unknown; dateTo?: unknown }
  if (typeof data.dateFrom === 'string' && typeof data.dateTo === 'string') {
    return `${data.dateFrom} - ${data.dateTo}`
  }
  return null
}

function getResultSummary(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const data = result as { accountsProcessed?: unknown; accountsFailed?: unknown; targetDate?: unknown }
  if (typeof data.accountsProcessed === 'number' && typeof data.accountsFailed === 'number') {
    return `Кабинетов: ${data.accountsProcessed}, ошибок: ${data.accountsFailed}`
  }
  if (typeof data.targetDate === 'string') return data.targetDate
  return null
}

function getAccountErrors(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const data = result as {
    accounts?: Array<{
      accountName?: unknown
      sheetName?: unknown
      status?: unknown
      error?: unknown
    }>
  }
  if (!Array.isArray(data.accounts)) return null

  const errors = data.accounts
    .filter((account) => account.status === 'FAILED' && typeof account.error === 'string' && account.error.trim())
    .map((account) => {
      const name = typeof account.accountName === 'string' && account.accountName.trim()
        ? account.accountName.trim()
        : 'Кабинет'
      const sheet = typeof account.sheetName === 'string' && account.sheetName.trim()
        ? ` (${account.sheetName.trim()})`
        : ''
      return `${name}${sheet}: ${String(account.error).trim()}`
    })

  return errors.length > 0 ? errors.join('; ') : null
}

export async function enqueueAutomationRun(data: AutomationJobData): Promise<EnqueuedAutomationRun> {
  const prismaKind = toPrismaAutomationKind(data.kind)
  const activeRun = await prisma.automationRun.findFirst({
    where: {
      kind: prismaKind,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (activeRun) {
    return {
      id: activeRun.id,
      kind: data.kind,
      status: activeRun.status as EnqueuedAutomationRun['status'],
      bullJobId: activeRun.bullJobId,
    }
  }

  const run = await prisma.automationRun.create({
    data: {
      workflowId: data.workflowId ?? null,
      kind: prismaKind,
      status: 'QUEUED',
      source: data.source,
      payload: toAutomationPayloadJson(data),
    },
  })

  const queue = await getAutomationQueue()
  const job = await queue.add(data.kind, { ...data, runId: run.id }, undefined)

  const updated = await prisma.automationRun.update({
    where: { id: run.id },
    data: { bullJobId: String(job.id ?? '') || null },
  })

  return {
    id: updated.id,
    kind: data.kind,
    status: updated.status as EnqueuedAutomationRun['status'],
    bullJobId: updated.bullJobId,
  }
}

export async function createAutomationRunForBullJob(data: AutomationJobData, bullJobId: string | undefined) {
  return prisma.automationRun.create({
    data: {
      workflowId: data.workflowId ?? null,
      kind: toPrismaAutomationKind(data.kind),
      status: 'QUEUED',
      source: data.source,
      payload: toAutomationPayloadJson(data),
      bullJobId: bullJobId ? String(bullJobId) : null,
    },
  })
}

export async function listAutomationRuns(limit = 50): Promise<AutomationRunRow[]> {
  const rows = await prisma.automationRun.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((row) => {
    const accountErrors = getAccountErrors(row.result)

    return {
      id: row.id,
      kind: fromPrismaAutomationKind(row.kind as PrismaAutomationWorkflowKind),
      status: row.status as AutomationRunRow['status'],
      source: parseAutomationSource(row.payload),
      bullJobId: row.bullJobId,
      targetDate: parseTargetDate(row.payload),
      period: getPeriodFromPayload(row.payload),
      resultSummary: getResultSummary(row.result),
      error: accountErrors ?? row.error,
      attempts: row.attempts,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      durationMs: row.startedAt && row.finishedAt
        ? row.finishedAt.getTime() - row.startedAt.getTime()
        : null,
    }
  })
}
