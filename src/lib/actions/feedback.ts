'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enqueueQuestionsSyncAction, enqueueReviewsSyncAction } from '@/lib/actions/sync'
import type { ActionResult } from '@/types'
import type { EnqueuedSyncJob } from '@/types/sync'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
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


