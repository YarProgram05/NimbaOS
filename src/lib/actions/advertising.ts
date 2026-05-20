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
  AdNmStatRow,
  AdSource,
  AdStatRow,
  AdStatus,
  WbAdvertInfoItem,
  WbCampaignBudgetDepositRequest,
  WbPaymentType,
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

function emptyNmAggregate(nmId: number) {
  return {
    nmId,
    views: 0,
    clicks: 0,
    spend: 0,
    orders: 0,
    cartAdds: 0,
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

    const lastBid = latestBid?.bid?.toString() ?? null

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

export async function getCampaignNmStatsAction(
  campaignId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<AdNmStatRow[]>> {
  try {
    await requireManagerSession()
    if (!campaignId) return { success: false, error: 'Кампания не указана' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      select: { wbAccountId: true },
    })
    if (!campaign) return { success: false, error: 'Кампания не найдена' }

    const from = parseDate(dateFrom)
    const to = parseDate(dateTo)
    const nmRows = await prisma.adCampaignNmStat.findMany({
      where: {
        campaignId,
        date: { gte: from, lte: to },
      },
      orderBy: [
        { date: 'asc' },
        { nmId: 'asc' },
        { source: 'asc' },
      ],
    })

    type NmStatDbRow = (typeof nmRows)[number]
    const rowsByDayAndNm = new Map<string, NmStatDbRow[]>()
    for (const row of nmRows) {
      const key = `${serializeDate(row.date)}:${row.nmId}`
      const group = rowsByDayAndNm.get(key) ?? []
      group.push(row)
      rowsByDayAndNm.set(key, group)
    }

    const aggregates = new Map<number, ReturnType<typeof emptyNmAggregate>>()
    for (const rows of Array.from(rowsByDayAndNm.values())) {
      const totalRows = rows.filter((row) => row.source === 'total')
      const rowsForTotals = totalRows.length > 0 ? totalRows : rows.filter((row) => row.source !== 'total')

      for (const row of rowsForTotals) {
        const aggregate = aggregates.get(row.nmId) ?? emptyNmAggregate(row.nmId)
        aggregate.views += row.views
        aggregate.clicks += row.clicks
        aggregate.spend += Number(row.spend)
        aggregate.orders += row.orders
        aggregate.cartAdds += row.cartAdds
        aggregates.set(row.nmId, aggregate)
      }
    }

    const nmIds = Array.from(aggregates.keys())
    if (nmIds.length === 0) return { success: true, data: [] }

    const [products, wbOrders, wbSales, funnelRows] = await Promise.all([
      prisma.product.findMany({
        where: { wbAccountId: campaign.wbAccountId, nmId: { in: nmIds } },
        select: {
          nmId: true,
          vendorCode: true,
          brand: true,
          category: true,
          photoUrl: true,
        },
      }),
      prisma.wbOrder.findMany({
        where: {
          wbAccountId: campaign.wbAccountId,
          nmId: { in: nmIds },
          date: { gte: from, lte: to },
        },
        select: { nmId: true, finishedPrice: true, isCancel: true },
      }),
      prisma.wbSale.findMany({
        where: {
          wbAccountId: campaign.wbAccountId,
          nmId: { in: nmIds },
          date: { gte: from, lte: to },
        },
        select: { nmId: true, priceWithDisc: true, isReturn: true },
      }),
      prisma.wbFunnelStat.findMany({
        where: {
          wbAccountId: campaign.wbAccountId,
          nmId: { in: nmIds },
          date: { gte: from, lte: to },
        },
        select: {
          nmId: true,
          openCount: true,
          addToCartCount: true,
          cartCount: true,
          ordersCount: true,
          ordersSumRub: true,
        },
      }),
    ])

    const productsByNm = new Map(products.map((product) => [product.nmId, product]))
    const ordersByNm = new Map<number, { count: number; revenue: number }>()
    const salesByNm = new Map<number, { sales: number; revenue: number; returns: number }>()
    const funnelByNm = new Map<number, {
      openCount: number
      addToCartCount: number
      cartCount: number
      ordersCount: number
      ordersSumRub: number
    }>()

    for (const order of wbOrders) {
      if (order.isCancel) continue
      const aggregate = ordersByNm.get(order.nmId) ?? { count: 0, revenue: 0 }
      aggregate.count += 1
      aggregate.revenue += Number(order.finishedPrice)
      ordersByNm.set(order.nmId, aggregate)
    }

    for (const sale of wbSales) {
      const aggregate = salesByNm.get(sale.nmId) ?? { sales: 0, revenue: 0, returns: 0 }
      if (sale.isReturn) aggregate.returns += 1
      else {
        aggregate.sales += 1
        aggregate.revenue += Number(sale.priceWithDisc)
      }
      salesByNm.set(sale.nmId, aggregate)
    }

    for (const row of funnelRows) {
      const aggregate = funnelByNm.get(row.nmId) ?? {
        openCount: 0,
        addToCartCount: 0,
        cartCount: 0,
        ordersCount: 0,
        ordersSumRub: 0,
      }
      aggregate.openCount += row.openCount
      aggregate.addToCartCount += row.addToCartCount
      aggregate.cartCount += row.cartCount
      aggregate.ordersCount += row.ordersCount
      aggregate.ordersSumRub += Number(row.ordersSumRub)
      funnelByNm.set(row.nmId, aggregate)
    }

    const data = Array.from(aggregates.values())
      .map((aggregate) => {
        const product = productsByNm.get(aggregate.nmId)
        const orderMetrics = ordersByNm.get(aggregate.nmId) ?? { count: 0, revenue: 0 }
        const saleMetrics = salesByNm.get(aggregate.nmId) ?? { sales: 0, revenue: 0, returns: 0 }
        const funnelMetrics = funnelByNm.get(aggregate.nmId) ?? {
          openCount: 0,
          addToCartCount: 0,
          cartCount: 0,
          ordersCount: 0,
          ordersSumRub: 0,
        }

        return {
          nmId: aggregate.nmId,
          vendorCode: product?.vendorCode ?? null,
          brandName: product?.brand ?? null,
          subjectName: product?.category ?? null,
          photoUrl: product?.photoUrl ?? null,
          views: aggregate.views,
          clicks: aggregate.clicks,
          ctr: aggregate.views > 0 ? ((aggregate.clicks / aggregate.views) * 100).toFixed(2) : '0.00',
          cpc: aggregate.clicks > 0 ? (aggregate.spend / aggregate.clicks).toFixed(2) : '0.00',
          spend: aggregate.spend.toFixed(2),
          orders: aggregate.orders,
          cartAdds: aggregate.cartAdds,
          cpo: aggregate.orders > 0 ? (aggregate.spend / aggregate.orders).toFixed(2) : '0.00',
          wbOrders: orderMetrics.count,
          wbOrderRevenue: orderMetrics.revenue.toFixed(2),
          sales: saleMetrics.sales,
          salesRevenue: saleMetrics.revenue.toFixed(2),
          returns: saleMetrics.returns,
          funnelOpenCount: funnelMetrics.openCount,
          funnelAddToCartCount: funnelMetrics.addToCartCount,
          funnelCartCount: funnelMetrics.cartCount,
          funnelOrdersCount: funnelMetrics.ordersCount,
          funnelOrdersSum: funnelMetrics.ordersSumRub.toFixed(2),
        }
      })
      .sort((a, b) => Number(b.spend) - Number(a.spend) || b.views - a.views)

    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки статистики по артикулам' }
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

    const localLogs = await prisma.adActionLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    })

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
