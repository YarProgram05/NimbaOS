'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import {
  getBidPlacement,
  fetchAdvertInfoByIds,
  fetchUpdHistory,
  depositBudget,
  pauseCampaign,
  setBid,
  startCampaign,
  stopCampaign,
} from '@/lib/wb-api/advertising'
import { WbApiClient } from '@/lib/wb-api/client'
import {
  enqueueAdCampaignsSyncAction,
  enqueueAdStatsSyncAction,
  enqueueAdClustersSyncAction,
} from '@/lib/actions/sync'
import type { ActionResult } from '@/types'
import type { EnqueuedSyncJob } from '@/types/sync'
import {
  AD_STATUS_LABELS,
} from '@/types/advertising'
import type {
  AdActionLogRow,
  AdCampaignDetail,
  AdCampaignRow,
  AdClusterRow,
  AdSource,
  AdStatRow,
  AdStatus,
  WbAdvertInfoItem,
  WbCampaignBudgetDepositRequest,
  WbPaymentType,
  WbUpdHistoryItem,
} from '@/types/advertising'

type CampaignWithAccount = Awaited<ReturnType<typeof prisma.adCampaign.findUnique>> & {
  wbAccount: { id: string; apiKey: string }
}

async function requireManagerSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  if (!checkRole(session, 'MANAGER')) throw new Error('Недостаточно прав')
  return session
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function serializeDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toFixedString(value: number | string | null | undefined, decimals = 2): string | null {
  if (value === null || value === undefined) return null
  return Number(value).toFixed(decimals)
}

function getStatusLabel(status: number): string {
  return AD_STATUS_LABELS[status as AdStatus] ?? `Статус ${status}`
}

function mapCampaignRow(campaign: {
  id: string
  wbAccountId: string
  advertId: number
  name: string
  status: number
  bidType: string | null
  paymentType: string | null
  placementSearch: boolean
  placementReco: boolean
  budget: { toString(): string } | null
  createdAt: Date
  updatedAt: Date
}): AdCampaignRow {
  return {
    id: campaign.id,
    wbAccountId: campaign.wbAccountId,
    advertId: campaign.advertId,
    name: campaign.name,
    status: campaign.status as AdStatus,
    statusLabel: getStatusLabel(campaign.status),
    bidType: campaign.bidType,
    paymentType: campaign.paymentType,
    placementSearch: campaign.placementSearch,
    placementReco: campaign.placementReco,
    budget: campaign.budget?.toString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  }
}

async function getCampaignWithAccount(campaignId: string) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: {
      wbAccount: {
        select: {
          id: true,
          apiKey: true,
        },
      },
    },
  })

  if (!campaign) throw new Error('Кампания не найдена')
  return campaign as CampaignWithAccount
}

function extractBidRubles(
  advert: WbAdvertInfoItem,
  bidType: string | null | undefined,
  paymentType: WbPaymentType | null | undefined,
  placementSearch: boolean,
  placementReco: boolean,
): number | null {
  const placement = getBidPlacement(
    bidType,
    paymentType,
    placementSearch,
    placementReco,
  )

  const nmSettings = advert.nm_settings ?? []
  if (nmSettings.length === 0) return null

  const perNmValues: number[] = []

  for (const nm of nmSettings) {
    const bids = nm.bids_kopecks
    if (!bids) continue

    const selected: number[] = []

    if (placement === 'search' || placement === 'combined') {
      if (bids.search !== undefined) selected.push(Number(bids.search))
    }
    if (placement === 'recommendations' || placement === 'combined') {
      if (bids.recommendations !== undefined) selected.push(Number(bids.recommendations))
    }

    if (selected.length > 0) {
      perNmValues.push(selected.reduce((sum, value) => sum + value, 0) / selected.length)
    }
  }

  if (perNmValues.length === 0) return null
  return perNmValues.reduce((sum, value) => sum + value, 0) / perNmValues.length / 100
}

async function fetchLiveAdvertInfo(campaign: CampaignWithAccount) {
  const client = new WbApiClient(decrypt(campaign.wbAccount.apiKey))
  const adverts = await fetchAdvertInfoByIds(client, [campaign.advertId])
  return { client, advert: adverts[0] ?? null }
}

function mapStatRow(row: {
  date: Date
  source: string
  views: number
  clicks: number
  ctr: { toString(): string }
  cpc: { toString(): string
  }
  spend: { toString(): string }
  orders: number
  cartAdds: number
  bid: { toString(): string } | null
}): AdStatRow {
  return {
    date: serializeDate(row.date),
    source: row.source as AdSource,
    views: row.views,
    clicks: row.clicks,
    ctr: row.ctr.toString(),
    cpc: row.cpc.toString(),
    spend: row.spend.toString(),
    orders: row.orders,
    cartAdds: row.cartAdds,
    bid: row.bid?.toString() ?? null,
  }
}

function mapClusterRow(row: {
  id: string
  cluster: string
  ctr: { toString(): string }
  position: { toString(): string }
  views: number
  clicks: number
  cartAdds: number
  orders: number
  cpm: { toString(): string }
  dateFrom: Date
  dateTo: Date
}): AdClusterRow {
  return {
    id: row.id,
    cluster: row.cluster,
    ctr: row.ctr.toString(),
    position: row.position.toString(),
    views: row.views,
    clicks: row.clicks,
    cartAdds: row.cartAdds,
    orders: row.orders,
    cpm: row.cpm.toString(),
    dateFrom: serializeDate(row.dateFrom),
    dateTo: serializeDate(row.dateTo),
  }
}

function buildWbLogRow(item: WbUpdHistoryItem, index: number): AdActionLogRow | null {
  const createdAt = item.updTime ?? item.upd_time
  if (!createdAt) return null

  return {
    id: `wb-${index}-${createdAt}`,
    source: 'wb',
    action: item.action ?? item.type ?? item.paymentType ?? item.payment_type ?? 'wb_update',
    valueBefore: item.from != null ? String(item.from) : null,
    valueAfter: item.to != null
      ? String(item.to)
      : item.updSum != null
        ? String(item.updSum)
        : item.upd_sum != null
          ? String(item.upd_sum)
          : item.sum != null
            ? String(item.sum)
            : null,
    note: item.text ?? item.param ?? (item.advertStatus != null ? `status=${item.advertStatus}` : null),
    createdAt: new Date(createdAt).toISOString(),
  }
}

export async function getCampaignsAction(
  wbAccountId: string,
): Promise<ActionResult<AdCampaignRow[]>> {
  try {
    await requireManagerSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    const campaigns = await prisma.adCampaign.findMany({
      where: { wbAccountId },
      orderBy: [
        { status: 'asc' },
        { updatedAt: 'desc' },
      ],
    })

    return {
      success: true,
      data: campaigns.map(mapCampaignRow),
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки кампаний' }
  }
}

export async function syncCampaignsAction(
  wbAccountId: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  return enqueueAdCampaignsSyncAction(wbAccountId)
}

export async function getCampaignDetailAction(
  campaignId: string,
): Promise<ActionResult<AdCampaignDetail>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }

    const campaign = await getCampaignWithAccount(campaignId)

    const latestBid = await prisma.adCampaignStat.findFirst({
      where: { campaignId, source: 'total', bid: { not: null } },
      orderBy: { date: 'desc' },
    }).catch(() => null)

    let lastBid = latestBid?.bid?.toString() ?? null

    if (!lastBid) {
      try {
        const { advert } = await fetchLiveAdvertInfo(campaign)
        if (advert) {
          const liveBid = extractBidRubles(
            advert,
            campaign.bidType,
            campaign.paymentType as WbPaymentType | null,
            campaign.placementSearch,
            campaign.placementReco,
          )
          lastBid = toFixedString(liveBid)
        }
      } catch {
        // Keep DB fallback if live fetch failed.
      }
    }

    return {
      success: true,
      data: {
        ...mapCampaignRow(campaign),
        lastBid,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки кампании' }
  }
}

export async function getCampaignStatsAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<AdStatRow[]>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    const rows = await prisma.adCampaignStat.findMany({
      where: {
        campaignId,
        date: {
          gte: parseDate(dateFrom),
          lte: parseDate(dateTo),
        },
      },
      orderBy: [
        { date: 'asc' },
        { source: 'asc' },
      ],
    })

    return { success: true, data: rows.map(mapStatRow) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки статистики' }
  }
}

export async function syncCampaignStatsAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  return enqueueAdStatsSyncAction(campaignId, dateFrom, dateTo)
}

export async function getCampaignClustersAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<AdClusterRow[]>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    const rows = await prisma.adCampaignCluster.findMany({
      where: {
        campaignId,
        dateFrom: parseDate(dateFrom),
        dateTo: parseDate(dateTo),
      },
      orderBy: [
        { clicks: 'desc' },
        { views: 'desc' },
      ],
    })

    return { success: true, data: rows.map(mapClusterRow) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки кластеров' }
  }
}

export async function syncCampaignClustersAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  return enqueueAdClustersSyncAction(campaignId, dateFrom, dateTo)
}

export async function setBidAction(
  campaignId: string,
  cpm: number,
): Promise<ActionResult<void>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!Number.isFinite(cpm) || cpm <= 0) {
      return { success: false, error: 'Ставка должна быть больше 0' }
    }

    const campaign = await getCampaignWithAccount(campaignId)
    const { client, advert } = await fetchLiveAdvertInfo(campaign)
    if (!advert) return { success: false, error: 'Не удалось получить данные кампании из WB' }

    const nmIds = Array.from(new Set((advert.nm_settings ?? []).map((item) => item.nm_id)))
    if (nmIds.length === 0) {
      return { success: false, error: 'В кампании нет карточек для изменения ставки' }
    }

    const previousBid = extractBidRubles(
      advert,
      campaign.bidType,
      campaign.paymentType as WbPaymentType | null,
      campaign.placementSearch,
      campaign.placementReco,
    )

    await setBid(
      client,
      campaign.advertId,
      nmIds,
      Math.round(cpm * 100),
      getBidPlacement(
        campaign.bidType,
        campaign.paymentType as WbPaymentType | null,
        campaign.placementSearch,
        campaign.placementReco,
      ),
    )

    await prisma.adActionLog.create({
      data: {
        campaignId,
        action: 'bid_change',
        valueBefore: previousBid ?? null,
        valueAfter: cpm,
      },
    })

    revalidatePath(`/advertising/${campaignId}`)
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка изменения ставки' }
  }
}

export async function depositBudgetAction(
  campaignId: string,
  amount: number,
  sourceType: WbCampaignBudgetDepositRequest['type'] = 0,
): Promise<ActionResult<void>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Сумма должна быть больше 0' }
    }

    const campaign = await getCampaignWithAccount(campaignId)
    const client = new WbApiClient(decrypt(campaign.wbAccount.apiKey))

    await depositBudget(client, campaign.advertId, {
      sum: Math.round(amount),
      type: sourceType,
      return: true,
    })

    await prisma.$transaction([
      prisma.adActionLog.create({
        data: {
          campaignId,
          action: 'deposit',
          valueBefore: campaign.budget ? Number(campaign.budget) : null,
          valueAfter: amount,
          note: `source=${sourceType}`,
        },
      }),
      prisma.adCampaign.update({
        where: { id: campaignId },
        data: {
          budget: campaign.budget ? Number(campaign.budget) + amount : amount,
        },
      }),
    ])

    revalidatePath(`/advertising/${campaignId}`)
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка пополнения бюджета' }
  }
}

export async function startCampaignAction(
  campaignId: string,
): Promise<ActionResult<void>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }

    const campaign = await getCampaignWithAccount(campaignId)
    const client = new WbApiClient(decrypt(campaign.wbAccount.apiKey))

    await startCampaign(client, campaign.advertId)

    await prisma.$transaction([
      prisma.adActionLog.create({
        data: {
          campaignId,
          action: 'start',
          note: 'Campaign started',
        },
      }),
      prisma.adCampaign.update({
        where: { id: campaignId },
        data: { status: 9 },
      }),
    ])

    revalidatePath(`/advertising/${campaignId}`)
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка запуска кампании' }
  }
}

export async function pauseCampaignAction(
  campaignId: string,
): Promise<ActionResult<void>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }

    const campaign = await getCampaignWithAccount(campaignId)
    const client = new WbApiClient(decrypt(campaign.wbAccount.apiKey))

    await pauseCampaign(client, campaign.advertId)

    await prisma.$transaction([
      prisma.adActionLog.create({
        data: {
          campaignId,
          action: 'pause',
          note: 'Campaign paused',
        },
      }),
      prisma.adCampaign.update({
        where: { id: campaignId },
        data: { status: 11 },
      }),
    ])

    revalidatePath(`/advertising/${campaignId}`)
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка паузы кампании' }
  }
}

export async function stopCampaignAction(
  campaignId: string,
): Promise<ActionResult<void>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }

    const campaign = await getCampaignWithAccount(campaignId)
    const client = new WbApiClient(decrypt(campaign.wbAccount.apiKey))

    await stopCampaign(client, campaign.advertId)

    await prisma.$transaction([
      prisma.adActionLog.create({
        data: {
          campaignId,
          action: 'stop',
          note: 'Campaign stopped',
        },
      }),
      prisma.adCampaign.update({
        where: { id: campaignId },
        data: { status: 7 },
      }),
    ])

    revalidatePath(`/advertising/${campaignId}`)
    return { success: true, data: undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка остановки кампании' }
  }
}

export async function getCampaignLogAction(
  campaignId: string,
): Promise<ActionResult<AdActionLogRow[]>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }

    const campaign = await getCampaignWithAccount(campaignId)

    const localLogs = await prisma.adActionLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    })

    let wbLogs: AdActionLogRow[] = []
    try {
      const client = new WbApiClient(decrypt(campaign.wbAccount.apiKey))
      const today = new Date()
      const history = await fetchUpdHistory(
        client,
        serializeDate(addDays(today, -30)),
        serializeDate(today),
      )
      wbLogs = history
        .filter((item) => (item.advertId ?? item.advert_id) === campaign.advertId)
        .map(buildWbLogRow)
        .filter((item): item is AdActionLogRow => item !== null)
    } catch {
      wbLogs = []
    }

    const merged: AdActionLogRow[] = [
      ...localLogs.map((log) => ({
        id: log.id,
        source: 'local' as const,
        action: log.action,
        valueBefore: log.valueBefore?.toString() ?? null,
        valueAfter: log.valueAfter?.toString() ?? null,
        note: log.note,
        createdAt: log.createdAt.toISOString(),
      })),
      ...wbLogs,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { success: true, data: merged }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки журнала' }
  }
}

export async function exportAdStatsXlsxAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<{ base64: string; filename: string }>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      select: { name: true },
    })
    if (!campaign) return { success: false, error: 'Кампания не найдена' }

    const [stats, clusters] = await Promise.all([
      prisma.adCampaignStat.findMany({
        where: {
          campaignId,
          date: { gte: parseDate(dateFrom), lte: parseDate(dateTo) },
        },
        orderBy: [{ date: 'asc' }, { source: 'asc' }],
      }),
      prisma.adCampaignCluster.findMany({
        where: {
          campaignId,
          dateFrom: parseDate(dateFrom),
          dateTo: parseDate(dateTo),
        },
        orderBy: [{ clicks: 'desc' }, { views: 'desc' }],
      }),
    ])

    const wb = XLSX.utils.book_new()

    const statsSheet = XLSX.utils.aoa_to_sheet([
      ['Дата', 'Источник', 'Просмотры', 'Клики', 'CTR', 'CPC', 'Затраты', 'Заказы', 'Корзины', 'Ставка'],
      ...stats.map((row) => [
        serializeDate(row.date),
        row.source,
        row.views,
        row.clicks,
        row.ctr.toString(),
        row.cpc.toString(),
        row.spend.toString(),
        row.orders,
        row.cartAdds,
        row.bid?.toString() ?? '',
      ]),
    ])
    XLSX.utils.book_append_sheet(wb, statsSheet, 'Статистика')

    const clustersSheet = XLSX.utils.aoa_to_sheet([
      ['Кластер', 'CTR', 'Позиция', 'Показы', 'Клики', 'Корзины', 'Заказы', 'CPM'],
      ...clusters.map((row) => [
        row.cluster,
        row.ctr.toString(),
        row.position.toString(),
        row.views,
        row.clicks,
        row.cartAdds,
        row.orders,
        row.cpm.toString(),
      ]),
    ])
    XLSX.utils.book_append_sheet(wb, clustersSheet, 'Кластеры')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64 = Buffer.from(buf).toString('base64')
    const filename = `advertising_${campaign.name.replace(/[^\w\u0400-\u04ff]/gi, '_')}_${dateFrom}_${dateTo}.xlsx`

    return { success: true, data: { base64, filename } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка экспорта' }
  }
}
