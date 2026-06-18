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
import {
  articleVersionGroupKey,
  buildArticleVersionMap,
  findArticleVersionsForPeriod,
  resolveArticleVersion,
} from '@/lib/services/article-versions'
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

function emptyNmAggregate(nmId: number, key: string, vendorCode: string | null) {
  return {
    key,
    nmId,
    vendorCode,
    views: 0,
    clicks: 0,
    spend: 0,
    orders: 0,
    cartAdds: 0,
    orderSum: 0,
  }
}

type NmStatLike = {
  date: Date
  source: string
  nmId: number
  views: number
  clicks: number
  spend: { toString(): string } | number
  orders: number
  cartAdds: number
}

type ProductImtLike = {
  nmId: number
  imtId: number | null
}

type ProductAdvertisingMeta = ProductImtLike & {
  vendorCode?: string | null
  brand?: string | null
  category?: string | null
  photoUrl?: string | null
}

function numberFromDecimal(value: { toString(): string } | number): number {
  return typeof value === 'number' ? value : Number(value)
}

async function getAdvertisingProducts(
  wbAccountId: string,
  nmIds: number[],
  includeDetails = false,
): Promise<ProductAdvertisingMeta[]> {
  if (nmIds.length === 0) return []

  try {
    const rows = includeDetails
      ? await prisma.$queryRawUnsafe<ProductAdvertisingMeta[]>(
          `
            SELECT
              "nmId",
              "imtId",
              "vendorCode",
              "brand",
              "category",
              "photoUrl"
            FROM "products"
            WHERE "wbAccountId" = $1
              AND "nmId" = ANY($2::int[])
          `,
          wbAccountId,
          nmIds,
        )
      : await prisma.$queryRawUnsafe<ProductAdvertisingMeta[]>(
          `
            SELECT
              "nmId",
              "imtId"
            FROM "products"
            WHERE "wbAccountId" = $1
              AND "nmId" = ANY($2::int[])
          `,
          wbAccountId,
          nmIds,
        )

    return rows.map((row) => ({
      ...row,
      nmId: Number(row.nmId),
      imtId: row.imtId === null || row.imtId === undefined ? null : Number(row.imtId),
    }))
  } catch {
    const rows = await prisma.product.findMany({
      where: { wbAccountId, nmId: { in: nmIds } },
      select: includeDetails
        ? {
            nmId: true,
            vendorCode: true,
            brand: true,
            category: true,
            photoUrl: true,
          }
        : {
            nmId: true,
          },
    })

    return rows.map((row) => ({
      ...row,
      imtId: null,
    }))
  }
}

function isMeaningfulAdNmRow(row: NmStatLike): boolean {
  return row.views > 0 ||
    row.clicks > 0 ||
    numberFromDecimal(row.spend) > 0 ||
    row.orders > 0
}

function displayCartAdds(row: NmStatLike): number {
  const hasAdContact = row.views > 0 ||
    row.clicks > 0 ||
    numberFromDecimal(row.spend) > 0

  if (!hasAdContact && row.orders > 0) return row.orders
  return row.cartAdds
}

async function getAdOrderSumByKey(
  campaignId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<Map<string, number>> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      date: Date
      source: string
      nmId: number
      orderSum: { toString(): string } | number
    }>>`
      SELECT
        "date",
        "source",
        "nmId",
        "orderSum"
      FROM "ad_campaign_nm_stats"
      WHERE "campaignId" = ${campaignId}
        AND "date" >= ${dateFrom}
        AND "date" <= ${dateTo}
    `

    return new Map(rows.map((row) => [
      `${serializeDate(row.date)}:${row.source}:${row.nmId}`,
      numberFromDecimal(row.orderSum),
    ]))
  } catch {
    return new Map()
  }
}

function pickPrimaryImtId(
  rows: NmStatLike[],
  productsByNm: Map<number, ProductImtLike>,
): number | null {
  const scoreByImt = new Map<number, {
    spend: number
    views: number
    clicks: number
    cartAdds: number
    orders: number
  }>()

  const totalRows = rows.filter((row) => row.source === 'total')
  const rowsForScore = totalRows.length > 0 ? totalRows : rows

  for (const row of rowsForScore) {
    const imtId = productsByNm.get(row.nmId)?.imtId
    if (!imtId) continue

    const score = scoreByImt.get(imtId) ?? {
      spend: 0,
      views: 0,
      clicks: 0,
      cartAdds: 0,
      orders: 0,
    }
    score.spend += numberFromDecimal(row.spend)
    score.views += row.views
    score.clicks += row.clicks
    score.cartAdds += row.cartAdds
    score.orders += row.orders
    scoreByImt.set(imtId, score)
  }

  let selected: number | null = null
  let selectedScore = {
    spend: -1,
    views: -1,
    clicks: -1,
    cartAdds: -1,
    orders: -1,
  }

  for (const [imtId, score] of Array.from(scoreByImt.entries())) {
    const isBetter =
      score.spend > selectedScore.spend ||
      (score.spend === selectedScore.spend && score.views > selectedScore.views) ||
      (score.spend === selectedScore.spend && score.views === selectedScore.views && score.clicks > selectedScore.clicks) ||
      (score.spend === selectedScore.spend && score.views === selectedScore.views && score.clicks === selectedScore.clicks && score.cartAdds > selectedScore.cartAdds) ||
      (score.spend === selectedScore.spend && score.views === selectedScore.views && score.clicks === selectedScore.clicks && score.cartAdds === selectedScore.cartAdds && score.orders > selectedScore.orders)

    if (isBetter) {
      selected = imtId
      selectedScore = score
    }
  }

  return selected
}

function filterRowsToPrimaryImt<T extends NmStatLike>(
  rows: T[],
  productsByNm: Map<number, ProductImtLike>,
): T[] {
  const primaryImtId = pickPrimaryImtId(rows, productsByNm)
  if (!primaryImtId) return rows
  return rows.filter((row) => productsByNm.get(row.nmId)?.imtId === primaryImtId)
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

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      select: { wbAccountId: true },
    })
    if (!campaign) return { success: false, error: 'Кампания не найдена' }

    const from = parseDate(dateFrom)
    const to = parseDate(dateTo)
    const rows = await prisma.adCampaignStat.findMany({
      where: {
        campaignId,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [
        { date: 'asc' },
        { source: 'asc' },
      ],
    })

    const nmRows = await prisma.adCampaignNmStat.findMany({
      where: {
        campaignId,
        date: { gte: from, lte: to },
      },
      orderBy: [
        { date: 'asc' },
        { source: 'asc' },
        { nmId: 'asc' },
      ],
    })
    const nmIds = Array.from(new Set(nmRows.map((row) => row.nmId)))
    const products = await getAdvertisingProducts(campaign.wbAccountId, nmIds)
    const productsByNm = new Map(products.map((product) => [product.nmId, product]))
    const hasImtIds = products.some((product) => product.imtId !== null)

    if (hasImtIds && nmRows.length > 0) {
      const filteredNmRows = filterRowsToPrimaryImt(nmRows, productsByNm)
        .filter(isMeaningfulAdNmRow)
      const bidByDateSource = new Map(rows.map((row) => [`${serializeDate(row.date)}:${row.source}`, row.bid?.toString() ?? null]))
      const aggregateByDateSource = new Map<string, {
        date: Date
        source: AdSource
        views: number
        clicks: number
        spend: number
        cartAdds: number
        orders: number
      }>()

      for (const row of filteredNmRows) {
        const key = `${serializeDate(row.date)}:${row.source}`
        const aggregate = aggregateByDateSource.get(key) ?? {
          date: row.date,
          source: row.source as AdSource,
          views: 0,
          clicks: 0,
          spend: 0,
          cartAdds: 0,
          orders: 0,
        }
        aggregate.views += row.views
        aggregate.clicks += row.clicks
        aggregate.spend += Number(row.spend)
        aggregate.cartAdds += displayCartAdds(row)
        aggregate.orders += row.orders
        aggregateByDateSource.set(key, aggregate)
      }

      const groupedRows: AdStatRow[] = Array.from(aggregateByDateSource.values())
        .sort((a, b) => serializeDate(a.date).localeCompare(serializeDate(b.date)) || a.source.localeCompare(b.source))
        .map((row) => ({
          date: serializeDate(row.date),
          source: row.source,
          views: row.views,
          clicks: row.clicks,
          ctr: row.views > 0 ? ((row.clicks / row.views) * 100).toFixed(4) : '0.0000',
          cpc: row.clicks > 0 ? (row.spend / row.clicks).toFixed(2) : '0.00',
          spend: row.spend.toFixed(2),
          orders: row.orders,
          cartAdds: row.cartAdds,
          bid: bidByDateSource.get(`${serializeDate(row.date)}:${row.source}`) ?? null,
        }))

      return { success: true, data: groupedRows }
    }

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

    const allNmIds = Array.from(new Set(nmRows.map((row) => row.nmId)))
    const [products, articleVersions] = await Promise.all([
      getAdvertisingProducts(campaign.wbAccountId, allNmIds, true),
      findArticleVersionsForPeriod(campaign.wbAccountId, from, to),
    ])
    const productsByNm = new Map(products.map((product) => [product.nmId, product]))
    const versionsByNm = buildArticleVersionMap(articleVersions)
    const rowsForAggregation = (products.some((product) => product.imtId !== null)
      ? filterRowsToPrimaryImt(nmRows, productsByNm)
      : nmRows)
      .filter(isMeaningfulAdNmRow)
    const adOrderSumByKey = await getAdOrderSumByKey(campaignId, from, to)

    type NmStatDbRow = (typeof nmRows)[number]
    const rowsByDayAndNm = new Map<string, NmStatDbRow[]>()
    for (const row of rowsForAggregation) {
      const key = `${serializeDate(row.date)}:${row.nmId}`
      const group = rowsByDayAndNm.get(key) ?? []
      group.push(row)
      rowsByDayAndNm.set(key, group)
    }

    const aggregates = new Map<string, ReturnType<typeof emptyNmAggregate>>()
    for (const rows of Array.from(rowsByDayAndNm.values())) {
      const totalRows = rows.filter((row) => row.source === 'total')
      const rowsForTotals = totalRows.length > 0 ? totalRows : rows.filter((row) => row.source !== 'total')

      for (const row of rowsForTotals) {
        const version = resolveArticleVersion(versionsByNm, row.nmId, row.date)
        const key = articleVersionGroupKey(row.nmId, version)
        const product = productsByNm.get(row.nmId)
        const aggregate = aggregates.get(key) ?? emptyNmAggregate(
          row.nmId,
          key,
          version?.vendorCode ?? product?.vendorCode ?? null,
        )
        aggregate.views += row.views
        aggregate.clicks += row.clicks
        aggregate.spend += Number(row.spend)
        aggregate.orders += row.orders
        aggregate.cartAdds += displayCartAdds(row)
        aggregate.orderSum += adOrderSumByKey.get(`${serializeDate(row.date)}:${row.source}:${row.nmId}`) ?? 0
        aggregates.set(key, aggregate)
      }
    }

    const nmIds = Array.from(new Set(Array.from(aggregates.values()).map((aggregate) => aggregate.nmId)))
    if (nmIds.length === 0) return { success: true, data: [] }

    const [wbOrders, wbSales, funnelRows] = await Promise.all([
      prisma.wbOrder.findMany({
        where: {
          wbAccountId: campaign.wbAccountId,
          nmId: { in: nmIds },
          date: { gte: from, lte: to },
        },
        select: { nmId: true, date: true, finishedPrice: true, isCancel: true },
      }),
      prisma.wbSale.findMany({
        where: {
          wbAccountId: campaign.wbAccountId,
          nmId: { in: nmIds },
          date: { gte: from, lte: to },
        },
        select: { nmId: true, date: true, priceWithDisc: true, isReturn: true },
      }),
      prisma.wbFunnelStat.findMany({
        where: {
          wbAccountId: campaign.wbAccountId,
          nmId: { in: nmIds },
          date: { gte: from, lte: to },
        },
        select: {
          nmId: true,
          date: true,
          openCount: true,
          addToCartCount: true,
          cartCount: true,
          ordersCount: true,
          ordersSumRub: true,
        },
      }),
    ])

    const ordersByKey = new Map<string, { count: number; revenue: number }>()
    const salesByKey = new Map<string, { sales: number; revenue: number; returns: number }>()
    const funnelByKey = new Map<string, {
      openCount: number
      addToCartCount: number
      cartCount: number
      ordersCount: number
      ordersSumRub: number
    }>()

    for (const order of wbOrders) {
      if (order.isCancel) continue
      const key = articleVersionGroupKey(order.nmId, resolveArticleVersion(versionsByNm, order.nmId, order.date))
      const aggregate = ordersByKey.get(key) ?? { count: 0, revenue: 0 }
      aggregate.count += 1
      aggregate.revenue += Number(order.finishedPrice)
      ordersByKey.set(key, aggregate)
    }

    for (const sale of wbSales) {
      const key = articleVersionGroupKey(sale.nmId, resolveArticleVersion(versionsByNm, sale.nmId, sale.date))
      const aggregate = salesByKey.get(key) ?? { sales: 0, revenue: 0, returns: 0 }
      if (sale.isReturn) aggregate.returns += 1
      else {
        aggregate.sales += 1
        aggregate.revenue += Number(sale.priceWithDisc)
      }
      salesByKey.set(key, aggregate)
    }

    for (const row of funnelRows) {
      const key = articleVersionGroupKey(row.nmId, resolveArticleVersion(versionsByNm, row.nmId, row.date))
      const aggregate = funnelByKey.get(key) ?? {
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
      funnelByKey.set(key, aggregate)
    }

    const data = Array.from(aggregates.values())
      .map((aggregate) => {
        const product = productsByNm.get(aggregate.nmId)
        const orderMetrics = ordersByKey.get(aggregate.key) ?? { count: 0, revenue: 0 }
        const saleMetrics = salesByKey.get(aggregate.key) ?? { sales: 0, revenue: 0, returns: 0 }
        const funnelMetrics = funnelByKey.get(aggregate.key) ?? {
          openCount: 0,
          addToCartCount: 0,
          cartCount: 0,
          ordersCount: 0,
          ordersSumRub: 0,
        }

        return {
          nmId: aggregate.nmId,
          vendorCode: aggregate.vendorCode ?? product?.vendorCode ?? null,
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
          adOrderSum: aggregate.orderSum.toFixed(2),
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
