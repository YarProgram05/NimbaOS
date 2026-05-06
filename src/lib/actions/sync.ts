'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { prisma } from '@/lib/db'
import { enqueueSyncJob } from '@/lib/queue/sync-jobs'
import { deleteSyncJobRun, listSyncJobRuns } from '@/lib/sync/job-runs'
import { listSyncSchedules, updateSyncSchedule } from '@/lib/sync/schedules'
import type { ActionResult } from '@/types'
import {
  SYNC_JOB_KINDS,
  type EnqueuedSyncJob,
  type SyncJobKind,
  type SyncJobRunRow,
  type SyncScheduleRow,
  type UpdateSyncScheduleInput,
} from '@/types/sync'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

async function requireManagerSession() {
  const session = await requireSession()
  if (!checkRole(session, 'MANAGER')) throw new Error('Недостаточно прав')
  return session
}

function serializeDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function lastDaysPeriod(days: number) {
  const dateTo = new Date()
  const dateFrom = new Date(dateTo)
  dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1))
  return {
    dateFrom: serializeDate(dateFrom),
    dateTo: serializeDate(dateTo),
  }
}

export async function getSyncJobRunsAction(): Promise<ActionResult<SyncJobRunRow[]>> {
  try {
    await requireSession()
    return { success: true, data: await listSyncJobRuns() }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки задач' }
  }
}

export async function deleteSyncJobRunAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireManagerSession()
    if (!id) return { success: false, error: 'Задача не указана' }

    await deleteSyncJobRun(id)
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка удаления задачи' }
  }
}

export async function getSyncSchedulesAction(
  wbAccountId: string,
): Promise<ActionResult<SyncScheduleRow[]>> {
  try {
    await requireSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    return { success: true, data: await listSyncSchedules(wbAccountId) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки расписания' }
  }
}

export async function updateSyncScheduleAction(
  input: UpdateSyncScheduleInput,
): Promise<ActionResult<SyncScheduleRow>> {
  try {
    await requireManagerSession()
    if (!input.wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    return { success: true, data: await updateSyncSchedule(input) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка сохранения расписания' }
  }
}

export async function enqueueProductsSyncAction(
  wbAccountId: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  try {
    await requireManagerSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    await prisma.wbAccount.findUniqueOrThrow({ where: { id: wbAccountId }, select: { id: true } })

    const job = await enqueueSyncJob({
      kind: SYNC_JOB_KINDS.PRODUCTS_REFRESH,
      source: 'manual',
      wbAccountId,
    })

    return { success: true, data: job }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
  }
}

export async function enqueueReportsSyncAction(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  try {
    await requireManagerSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    await prisma.wbAccount.findUniqueOrThrow({ where: { id: wbAccountId }, select: { id: true } })

    const job = await enqueueSyncJob({
      kind: SYNC_JOB_KINDS.REPORTS_PERIOD,
      source: 'manual',
      wbAccountId,
      dateFrom,
      dateTo,
    })

    return { success: true, data: job }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
  }
}

export async function enqueuePlanSyncAction(
  planId: string,
  mode: 'today' | 'full' | 'custom',
  customFrom?: string,
  customTo?: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  try {
    await requireManagerSession()
    if (!planId) return { success: false, error: 'План не указан' }

    const plan = await prisma.salesPlan.findUnique({
      where: { id: planId },
      select: { wbAccountId: true, dateFrom: true, dateTo: true },
    })
    if (!plan) return { success: false, error: 'План не найден' }

    let dateFrom: string
    let dateTo: string
    if (mode === 'today') {
      dateFrom = serializeDate(new Date())
      dateTo = dateFrom
    } else if (mode === 'custom' && customFrom) {
      dateFrom = customFrom
      dateTo = customTo ?? serializeDate(plan.dateTo)
    } else {
      dateFrom = serializeDate(plan.dateFrom)
      dateTo = serializeDate(plan.dateTo)
    }

    const job = await enqueueSyncJob({
      kind: SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
      source: 'manual',
      wbAccountId: plan.wbAccountId,
      planId,
      dateFrom,
      dateTo,
    })

    return { success: true, data: job }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
  }
}

export async function enqueueAdCampaignsSyncAction(
  wbAccountId: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  try {
    await requireManagerSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    await prisma.wbAccount.findUniqueOrThrow({ where: { id: wbAccountId }, select: { id: true } })

    const job = await enqueueSyncJob({
      kind: SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS,
      source: 'manual',
      wbAccountId,
    })

    return { success: true, data: job }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
  }
}

export async function enqueueAdStatsSyncAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, wbAccountId: true, advertId: true },
    })
    if (!campaign) return { success: false, error: 'Кампания не найдена' }

    const job = await enqueueSyncJob({
      kind: SYNC_JOB_KINDS.ADVERTISING_STATS,
      source: 'manual',
      wbAccountId: campaign.wbAccountId,
      campaignId: campaign.id,
      advertId: campaign.advertId,
      dateFrom,
      dateTo,
    })

    return { success: true, data: job }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
  }
}

export async function enqueueAdClustersSyncAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, wbAccountId: true, advertId: true },
    })
    if (!campaign) return { success: false, error: 'Кампания не найдена' }

    const job = await enqueueSyncJob({
      kind: SYNC_JOB_KINDS.ADVERTISING_CLUSTERS,
      source: 'manual',
      wbAccountId: campaign.wbAccountId,
      campaignId: campaign.id,
      advertId: campaign.advertId,
      dateFrom,
      dateTo,
    })

    return { success: true, data: job }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
  }
}

export async function enqueueManualSyncAction(
  kind: SyncJobKind,
  wbAccountId: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  const { dateFrom, dateTo } = lastDaysPeriod(7)

  switch (kind) {
    case SYNC_JOB_KINDS.PRODUCTS_REFRESH:
      return enqueueProductsSyncAction(wbAccountId)
    case SYNC_JOB_KINDS.REPORTS_PERIOD:
      return enqueueReportsSyncAction(wbAccountId, dateFrom, dateTo)
    case SYNC_JOB_KINDS.SALES_PLAN_PERIOD:
      try {
        await requireManagerSession()
        if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
        const job = await enqueueSyncJob({
          kind: SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
          source: 'manual',
          wbAccountId,
          dateFrom,
          dateTo,
        })
        return { success: true, data: job }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
      }
    case SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS:
      return enqueueAdCampaignsSyncAction(wbAccountId)
    case SYNC_JOB_KINDS.ADVERTISING_STATS:
      try {
        await requireManagerSession()
        if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
        const job = await enqueueSyncJob({
          kind: SYNC_JOB_KINDS.ADVERTISING_STATS,
          source: 'manual',
          wbAccountId,
          dateFrom,
          dateTo,
        })
        return { success: true, data: job }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Ошибка постановки задачи' }
      }
    case SYNC_JOB_KINDS.ADVERTISING_CLUSTERS:
      return { success: false, error: 'Кластеры запускаются из карточки кампании с выбранным периодом' }
  }
}
