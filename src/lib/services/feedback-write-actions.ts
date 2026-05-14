import type { FeedbackWriteActionKind } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { answerWbFeedback, answerWbQuestion } from '@/lib/wb-api/feedbacks'
import type { FeedbackWriteLogRow, FeedbackWriteResult } from '@/types/feedback'

const WRITE_INTERVAL_MS = 334
const accountQueues = new Map<string, Promise<unknown>>()
const accountLastWriteAt = new Map<string, number>()

type FeedbackWriteTarget =
  | {
      entityType: 'review'
      localEntityId: string
      externalId: string
      answerText: string
      edit: boolean
    }
  | {
      entityType: 'question'
      localEntityId: string
      externalId: string
      answerText: string
      edit: boolean
    }

function validateAnswerText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length < 2) throw new Error('Ответ должен быть не короче 2 символов')
  if (trimmed.length > 5000) throw new Error('Ответ должен быть не длиннее 5000 символов')
  return trimmed
}

function toLogRow(row: {
  id: string
  kind: FeedbackWriteActionKind
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  entityType: string
  externalId: string
  answerText: string
  error: string | null
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}): FeedbackWriteLogRow {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    entityType: row.entityType,
    externalId: row.externalId,
    answerText: row.answerText,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  }
}

async function throttleAccount(wbAccountId: string) {
  const last = accountLastWriteAt.get(wbAccountId) ?? 0
  const elapsed = Date.now() - last
  if (elapsed < WRITE_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, WRITE_INTERVAL_MS - elapsed))
  }
  accountLastWriteAt.set(wbAccountId, Date.now())
}

async function runForAccount<T>(wbAccountId: string, fn: () => Promise<T>): Promise<T> {
  const previous = accountQueues.get(wbAccountId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  const queued = next.finally(() => {
    if (accountQueues.get(wbAccountId) === queued) accountQueues.delete(wbAccountId)
  })
  accountQueues.set(wbAccountId, queued)
  return next
}

function getKind(target: FeedbackWriteTarget): FeedbackWriteActionKind {
  if (target.entityType === 'question') return 'QUESTION_ANSWER_UPSERT'
  return target.edit ? 'REVIEW_ANSWER_UPDATE' : 'REVIEW_ANSWER_CREATE'
}

async function executeWrite(
  wbAccountId: string,
  userId: string | undefined,
  target: FeedbackWriteTarget,
) {
  const answerText = validateAnswerText(target.answerText)
  const kind = getKind(target)
  const log = await prisma.feedbackWriteActionLog.create({
    data: {
      wbAccountId,
      userId,
      kind,
      entityType: target.entityType,
      localEntityId: target.localEntityId,
      externalId: target.externalId,
      answerText,
    },
  })

  return runForAccount(wbAccountId, async () => {
    await prisma.feedbackWriteActionLog.update({
      where: { id: log.id },
      data: { status: 'RUNNING', startedAt: new Date(), error: null },
    })

    try {
      await throttleAccount(wbAccountId)
      const account = await prisma.wbAccount.findUnique({
        where: { id: wbAccountId },
        select: { apiKey: true },
      })
      if (!account) throw new Error('Кабинет WB не найден')

      const client = new WbApiClient(decrypt(account.apiKey))
      if (target.entityType === 'review') {
        await answerWbFeedback(client, {
          id: target.externalId,
          text: answerText,
          edit: target.edit,
        })
        await prisma.productReview.update({
          where: { id: target.localEntityId },
          data: {
            answerText,
            isAnswered: true,
            answerEditable: target.edit ? false : true,
            answerState: 'wbRu',
            fetchedAt: new Date(),
          },
        })
      } else {
        await answerWbQuestion(client, {
          id: target.externalId,
          text: answerText,
        })
        await prisma.productQuestion.update({
          where: { id: target.localEntityId },
          data: {
            answerText,
            isAnswered: true,
            answerEditable: target.edit ? false : true,
            answerCreatedDate: new Date(),
            state: 'wbRu',
            fetchedAt: new Date(),
          },
        })
      }

      const finished = await prisma.feedbackWriteActionLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCEEDED',
          result: {
            method: target.entityType === 'review'
              ? (target.edit ? 'PATCH /api/v1/feedbacks/answer' : 'POST /api/v1/feedbacks/answer')
              : 'PATCH /api/v1/questions',
          },
          finishedAt: new Date(),
        },
      })
      return toLogRow(finished)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка WB API'
      const failed = await prisma.feedbackWriteActionLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          error: message,
          finishedAt: new Date(),
        },
      })
      return toLogRow(failed)
    }
  })
}

export async function writeFeedbackAnswer(
  wbAccountId: string,
  userId: string | undefined,
  target: FeedbackWriteTarget,
): Promise<FeedbackWriteResult> {
  const log = await executeWrite(wbAccountId, userId, target)
  return {
    total: 1,
    succeeded: log.status === 'SUCCEEDED' ? 1 : 0,
    failed: log.status === 'FAILED' ? 1 : 0,
    logs: [log],
  }
}

export async function writeManyFeedbackAnswers(
  wbAccountId: string,
  userId: string | undefined,
  targets: FeedbackWriteTarget[],
): Promise<FeedbackWriteResult> {
  const logs: FeedbackWriteLogRow[] = []
  for (const target of targets) {
    logs.push(await executeWrite(wbAccountId, userId, target))
  }

  return {
    total: logs.length,
    succeeded: logs.filter((log) => log.status === 'SUCCEEDED').length,
    failed: logs.filter((log) => log.status === 'FAILED').length,
    logs,
  }
}
