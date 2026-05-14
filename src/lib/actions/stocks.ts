'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enqueueStocksSyncAction } from '@/lib/actions/sync'
import type { ActionResult } from '@/types'
import type { EnqueuedSyncJob } from '@/types/sync'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

export async function syncStocksAction(
  wbAccountId: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  await requireSession()
  return enqueueStocksSyncAction(wbAccountId)
}
