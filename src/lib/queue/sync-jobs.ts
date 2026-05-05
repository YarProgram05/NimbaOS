import { prisma } from '@/lib/db'
import {
  DEFAULT_SYNC_JOB_OPTIONS,
  getSyncQueue,
  type SyncJobData,
} from '@/lib/queue'
import { toPrismaSyncJobKind, toSyncJobPayloadJson } from '@/lib/sync/job-runs'
import type { EnqueuedSyncJob } from '@/types/sync'

export async function enqueueSyncJob(data: SyncJobData): Promise<EnqueuedSyncJob> {
  const activeRun = await prisma.syncJobRun.findFirst({
    where: {
      kind: toPrismaSyncJobKind(data.kind),
      wbAccountId: data.wbAccountId ?? null,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (activeRun) {
    return {
      id: activeRun.id,
      kind: data.kind,
      status: activeRun.status as EnqueuedSyncJob['status'],
      bullJobId: activeRun.bullJobId,
    }
  }

  const run = await prisma.syncJobRun.create({
    data: {
      kind: toPrismaSyncJobKind(data.kind),
      status: 'QUEUED',
      wbAccountId: data.wbAccountId ?? null,
      payload: toSyncJobPayloadJson(data),
    },
  })

  const queue = await getSyncQueue()
  const job = await queue.add(
    data.kind,
    { ...data, runId: run.id },
    DEFAULT_SYNC_JOB_OPTIONS,
  )

  const updated = await prisma.syncJobRun.update({
    where: { id: run.id },
    data: { bullJobId: String(job.id ?? '') || null },
  })

  return {
    id: updated.id,
    kind: data.kind,
    status: updated.status as EnqueuedSyncJob['status'],
    bullJobId: updated.bullJobId,
  }
}

export async function createRunForBullJob(data: SyncJobData, bullJobId: string | undefined) {
  return prisma.syncJobRun.create({
    data: {
      kind: toPrismaSyncJobKind(data.kind),
      status: 'QUEUED',
      wbAccountId: data.wbAccountId ?? null,
      payload: toSyncJobPayloadJson(data),
      bullJobId: bullJobId ? String(bullJobId) : null,
    },
  })
}
