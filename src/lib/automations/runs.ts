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
import type {
  AutomationRunQuery,
  AutomationRunRow,
  EnqueuedAutomationRun,
} from '@/types/automations'
import {
  normalizeRunHistoryPageSize,
  type RunHistoryPage,
  type RunHistorySortDirection,
} from '@/types/run-history'

const AUTOMATION_RUN_STATUS_VALUES = new Set(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'])
const AUTOMATION_RUN_SOURCE_VALUES = new Set(['manual', 'scheduled'])

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

function parseMoscowDay(value: string | undefined, endExclusive = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00+03:00`)
  if (Number.isNaN(date.getTime())) return undefined
  if (endExclusive) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function getAutomationRunOrderBy(
  sortBy: AutomationRunQuery['sortBy'],
  direction: RunHistorySortDirection,
): Prisma.AutomationRunOrderByWithRelationInput[] {
  const primary: Prisma.AutomationRunOrderByWithRelationInput = (() => {
    switch (sortBy) {
      case 'status': return { status: direction }
      case 'source': return { source: direction }
      case 'attempts': return { attempts: direction }
      case 'error': return { error: direction }
      default: return { createdAt: direction }
    }
  })()

  return [primary, { createdAt: 'desc' }, { id: 'desc' }]
}

function getAutomationRunWhere(query: AutomationRunQuery): Prisma.AutomationRunWhereInput {
  const createdFrom = parseMoscowDay(query.createdFrom)
  const createdTo = parseMoscowDay(query.createdTo, true)
  const error = query.error?.trim()

  return {
    ...(query.status && query.status !== 'ALL' && AUTOMATION_RUN_STATUS_VALUES.has(query.status)
      ? { status: query.status }
      : {}),
    ...(query.source && query.source !== 'ALL' && AUTOMATION_RUN_SOURCE_VALUES.has(query.source)
      ? { source: query.source }
      : {}),
    ...(createdFrom || createdTo
      ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lt: createdTo } : {}) } }
      : {}),
    ...(error ? { error: { contains: error, mode: 'insensitive' } } : {}),
  }
}

export async function listAutomationRuns(
  query: AutomationRunQuery = {},
): Promise<RunHistoryPage<AutomationRunRow>> {
  const pageSize = normalizeRunHistoryPageSize(query.pageSize)
  const requestedPage = Number.isFinite(query.page)
    ? Math.max(1, Math.trunc(query.page as number))
    : 1
  const sortDirection: RunHistorySortDirection = query.sortDirection === 'asc' ? 'asc' : 'desc'
  const where = getAutomationRunWhere(query)
  const total = await prisma.automationRun.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const rows = await prisma.automationRun.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: getAutomationRunOrderBy(query.sortBy ?? 'createdAt', sortDirection),
  })

  return {
    rows: rows.map((row) => {
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
    }),
    total,
    page,
    pageSize,
  }
}
