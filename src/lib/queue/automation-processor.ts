import type { Job } from 'bullmq'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AUTOMATION_WORKFLOW_KINDS, type AutomationJobData } from '@/lib/queue/automation'
import { createAutomationRunForBullJob, toAutomationPayloadJson } from '@/lib/automations/runs'
import { toPrismaAutomationKind } from '@/lib/automations/mapping'
import { minutesSinceMoscowScheduledTime } from '@/lib/time/moscow'
import {
  automationScheduleFingerprint,
  automationScheduleMatchesMoscowDate,
  normalizeAutomationSchedule,
} from '@/lib/automations/schedule'
import {
  isScheduledJobTooLate,
  resolveScheduledStartGraceMinutes,
} from '@/lib/queue/scheduled-job-policy'
import {
  morningWbReportPayload,
  runMorningWbReportWorkflow,
} from '@/lib/services/morning-wb-report-workflow'
import {
  fbsMovementSheetPayload,
  runFbsMovementSheetWorkflow,
} from '@/lib/services/fbs-movement-sheet-workflow'

function minutesSinceScheduledTime(timeOfDay: string, now = new Date()): number {
  return minutesSinceMoscowScheduledTime(timeOfDay, now)
}

async function shouldSkipScheduledJob(data: AutomationJobData): Promise<string | null> {
  if (data.source !== 'scheduled') return null

  const schedule = await prisma.automationWorkflowSetting.findUnique({
    where: { kind: toPrismaAutomationKind(data.kind) },
    select: { enabled: true, timeOfDay: true, config: true },
  })

  if (!schedule?.enabled) return 'scheduled workflow is disabled'

  const configuredSchedule = normalizeAutomationSchedule(
    schedule.config && typeof schedule.config === 'object'
      ? (schedule.config as { schedule?: unknown }).schedule
      : null,
    schedule.timeOfDay,
  )
  if (
    data.scheduleFingerprint &&
    data.scheduleFingerprint !== automationScheduleFingerprint(configuredSchedule)
  ) {
    return 'scheduled workflow configuration has changed'
  }

  if (configuredSchedule.cadence === 'every-n-weeks') {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    if (!automationScheduleMatchesMoscowDate(configuredSchedule, {
      year: read('year'), month: read('month'), day: read('day'),
    })) {
      return 'scheduled workflow is outside the selected week interval'
    }
  }

  const lateMinutes = minutesSinceScheduledTime(data.scheduledTime ?? schedule.timeOfDay)
  if (isScheduledJobTooLate(lateMinutes, resolveScheduledStartGraceMinutes())) {
    return `scheduled workflow is ${lateMinutes} minutes late`
  }

  return null
}

async function processAutomationJobData(data: AutomationJobData) {
  switch (data.kind) {
    case AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT:
      return runMorningWbReportWorkflow({ targetDate: data.targetDate })
    case AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET:
      return runFbsMovementSheetWorkflow({ targetDate: data.targetDate })
  }
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

function enrichedPayload(data: AutomationJobData) {
  switch (data.kind) {
    case AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT:
      return {
        ...data,
        ...morningWbReportPayload(data.targetDate),
      }
    case AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET:
      return {
        ...data,
        ...fbsMovementSheetPayload(data.targetDate),
      }
  }
}

export async function processAutomationJob(job: Job<AutomationJobData>) {
  const skipReason = await shouldSkipScheduledJob(job.data)
  if (skipReason) {
    return {
      skippedScheduledJob: true,
      reason: skipReason,
      kind: job.data.kind,
    }
  }

  const payload = enrichedPayload(job.data)
  const existingRunId = job.data.runId
  const run = existingRunId
    ? await prisma.automationRun.update({
        where: { id: existingRunId },
        data: {
          status: 'RUNNING',
          bullJobId: String(job.id ?? ''),
          attempts: job.attemptsMade + 1,
          startedAt: new Date(),
          finishedAt: null,
          error: null,
          payload: toAutomationPayloadJson(payload),
        },
      })
    : await createAutomationRunForBullJob(payload, job.id ? String(job.id) : undefined)

  if (!existingRunId) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING',
        attempts: job.attemptsMade + 1,
        startedAt: new Date(),
        finishedAt: null,
        payload: toAutomationPayloadJson(payload),
      },
    })
  }

  try {
    const result = await processAutomationJobData(job.data)
    const accountsFailed =
      result && typeof result === 'object' && typeof (result as { accountsFailed?: unknown }).accountsFailed === 'number'
        ? (result as { accountsFailed: number }).accountsFailed
        : 0
    const hasAccountErrors = accountsFailed > 0
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: hasAccountErrors ? 'FAILED' : 'SUCCEEDED',
        result: result as unknown as Prisma.InputJsonValue,
        error: hasAccountErrors ? getAccountErrors(result) ?? `Ошибки по кабинетам: ${accountsFailed}` : null,
        finishedAt: new Date(),
      },
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown automation error'
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        error: message,
        finishedAt: new Date(),
      },
    })
    throw error
  }
}
