'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enqueueQuestionsSyncAction, enqueueReviewsSyncAction } from '@/lib/actions/sync'
import { prisma } from '@/lib/db'
import { getUnansweredReviewTargetsByFilter } from '@/lib/services/feedback'
import { writeFeedbackAnswer, writeManyFeedbackAnswers } from '@/lib/services/feedback-write-actions'
import type { ActionResult } from '@/types'
import type {
  FeedbackAnswerFilter,
  FeedbackRatingFilter,
  FeedbackSortBy,
  FeedbackSortDir,
  FeedbackTab,
  FeedbackWriteResult,
} from '@/types/feedback'
import type { EnqueuedSyncJob } from '@/types/sync'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

function validateText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length < 2) throw new Error('Ответ должен быть не короче 2 символов')
  if (trimmed.length > 5000) throw new Error('Ответ должен быть не длиннее 5000 символов')
  return trimmed
}

export async function syncReviewsAction(
  wbAccountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  await requireSession()
  return enqueueReviewsSyncAction(wbAccountId, dateFrom, dateTo)
}

export async function syncQuestionsAction(
  wbAccountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  await requireSession()
  return enqueueQuestionsSyncAction(wbAccountId, dateFrom, dateTo)
}

export async function answerFeedbackItemAction(data: {
  wbAccountId: string
  type: FeedbackTab
  id: string
  text: string
}): Promise<ActionResult<FeedbackWriteResult>> {
  const session = await requireSession()

  try {
    const text = validateText(data.text)

    if (data.type === 'reviews') {
      const review = await prisma.productReview.findFirst({
        where: { id: data.id, wbAccountId: data.wbAccountId },
        select: {
          id: true,
          externalId: true,
          isAnswered: true,
          answerEditable: true,
        },
      })
      if (!review) return { success: false, error: 'Отзыв не найден' }
      if (review.isAnswered && review.answerEditable !== true) {
        return { success: false, error: 'Ответ на этот отзыв нельзя редактировать' }
      }

      const result = await writeFeedbackAnswer(data.wbAccountId, session.user.id, {
        entityType: 'review',
        localEntityId: review.id,
        externalId: review.externalId,
        answerText: text,
        edit: review.isAnswered,
      })

      revalidatePath('/reviews')
      return { success: true, data: result }
    }

    const question = await prisma.productQuestion.findFirst({
      where: { id: data.id, wbAccountId: data.wbAccountId },
      select: {
        id: true,
        externalId: true,
        isAnswered: true,
        answerEditable: true,
      },
    })
    if (!question) return { success: false, error: 'Вопрос не найден' }
    if (question.isAnswered && question.answerEditable !== true) {
      return { success: false, error: 'Ответ на этот вопрос нельзя редактировать' }
    }

    const result = await writeFeedbackAnswer(data.wbAccountId, session.user.id, {
      entityType: 'question',
      localEntityId: question.id,
      externalId: question.externalId,
      answerText: text,
      edit: question.isAnswered,
    })

    revalidatePath('/reviews')
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Не удалось отправить ответ' }
  }
}

export async function bulkAnswerReviewsAction(data: {
  wbAccountId: string
  text: string
  selection:
    | { mode: 'ids'; ids: string[] }
    | {
        mode: 'filter'
        search?: string
        rating?: FeedbackRatingFilter
        answerStatus?: FeedbackAnswerFilter
        nmId?: number
        dateFrom?: string
        dateTo?: string
        sortBy?: FeedbackSortBy
        sortDir?: FeedbackSortDir
      }
}): Promise<ActionResult<FeedbackWriteResult>> {
  const session = await requireSession()

  try {
    const text = validateText(data.text)
    const targets = data.selection.mode === 'ids'
      ? await prisma.productReview.findMany({
          where: {
            wbAccountId: data.wbAccountId,
            id: { in: data.selection.ids },
            isAnswered: false,
          },
          select: { id: true, externalId: true },
          orderBy: { createdDate: 'desc' },
        })
      : await getUnansweredReviewTargetsByFilter({
          wbAccountId: data.wbAccountId,
          search: data.selection.search,
          rating: data.selection.rating,
          answerStatus: 'unanswered',
          nmId: data.selection.nmId,
          dateFrom: data.selection.dateFrom,
          dateTo: data.selection.dateTo,
          sortBy: data.selection.sortBy,
          sortDir: data.selection.sortDir,
        })

    if (!targets.length) {
      return { success: false, error: 'Нет неотвеченных отзывов для массовой отправки' }
    }

    const result = await writeManyFeedbackAnswers(
      data.wbAccountId,
      session.user.id,
      targets.map((target) => ({
        entityType: 'review',
        localEntityId: target.id,
        externalId: target.externalId,
        answerText: text,
        edit: false,
      })),
    )

    revalidatePath('/reviews')
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Не удалось отправить массовые ответы' }
  }
}
