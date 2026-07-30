import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { calculateReport } from '@/lib/services/report-calculator'
import { getPaginatedStocks, getStocksSummary } from '@/lib/services/stocks'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { SYNC_JOB_KINDS } from '@/types/sync'
import { AD_STATUS_LABELS, type AdStatus } from '@/types/advertising'
import { TOTAL_STOCK_WAREHOUSE_VALUE } from '@/types/stocks'
import type { ReportRow } from '@/types/reports'
import type { StockSummaryItem } from '@/types/stocks'

const DATE_FROM = '2026-06-22'
const DATE_TO = '2026-06-25'
const OUT_DIR = path.join(process.cwd(), 'output', 'excel')
const OUT_XLSX = path.join(OUT_DIR, `wb_cabinet_factor_analysis_${DATE_FROM}_${DATE_TO}.xlsx`)
const OUT_JSON = path.join(OUT_DIR, `wb_cabinet_factor_analysis_${DATE_FROM}_${DATE_TO}.json`)

const LOCAL_REPORT_OPTIONS = {
  preferPersistedAdStats: true,
  preferLiveAdCostTotals: false,
}

type SheetRow = Record<string, string | number | null>

type AccountAnalysis = {
  accountId: string
  accountName: string
  coverage: SheetRow[]
  dataCounts: SheetRow
  finance: SheetRow
  daily: SheetRow[]
  products: SheetRow[]
  categories: SheetRow[]
  advertisingCampaigns: SheetRow[]
  advertisingProducts: SheetRow[]
  funnel: SheetRow
  stocks: SheetRow
  stockRows: SheetRow[]
  reviewsQuestions: SheetRow
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function periodDays() {
  const days: string[] = []
  let cursor = date(DATE_FROM)
  const end = date(DATE_TO)
  while (cursor <= end) {
    days.push(dateKey(cursor))
    cursor = addDays(cursor, 1)
  }
  return days
}

function num(value: unknown) {
  if (value == null || value === '') return 0
  return Number(value)
}

function round(value: number, digits = 2) {
  const m = 10 ** digits
  return Math.round((value + Number.EPSILON) * m) / m
}

function pct(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : round((numerator / denominator) * 100)
}

function safeDiv(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : round(numerator / denominator)
}

function statusLabel(status: number) {
  return AD_STATUS_LABELS[status as AdStatus] ?? `Статус ${status}`
}

function flattenReportRows(rows: ReportRow[]) {
  return rows.flatMap((row) => (row.sizeRows?.length ? row.sizeRows : [row]))
}

function flattenStockRows(rows: StockSummaryItem[]) {
  return rows.flatMap((row) => (row.sizeRows?.length ? row.sizeRows : [row]))
}

function stockKey(row: Pick<StockSummaryItem, 'nmId' | 'sizeLabel'>) {
  return `${row.nmId}:${row.sizeLabel ?? ''}`
}

function reportStockKey(row: ReportRow) {
  return `${row.parentNmId ?? row.nmId}:${row.sizeLabel ?? ''}`
}

function makeFinanceRow(accountName: string, summary: ReportRow): SheetRow {
  const sale = num(summary.sale)
  const op = num(summary.operatingProfit)
  const adAll = num(summary.adAll)
  const cost = num(summary.costPrice)
  const orderedRub = num(summary.orderedRub)
  return {
    'Кабинет': accountName,
    'Заказано, руб': round(orderedRub),
    'Продажи/выручка, руб': round(sale),
    'ОП, руб': round(op),
    'Маржинальность, %': round(num(summary.marginality)),
    'Рентабельность к себестоимости, %': round(num(summary.rentability)),
    'ОП на ед., руб': round(num(summary.operatingProfitUnit)),
    'Выкуплено с возвратами, шт': summary.boughtWithReturns,
    'Выкуплено без возвратов, шт': summary.boughtWithoutReturns,
    'Доставлено, шт': summary.delivered,
    'Выкуп, %': round(num(summary.buyoutPercent)),
    'Возвраты, шт': summary.returns,
    'Отмены, шт': summary.cancellations,
    'Средняя цена, руб': round(num(summary.avgPrice)),
    'Себестоимость, руб': round(cost),
    'Себестоимость от продаж, %': pct(cost, sale),
    'Реклама, руб': round(adAll),
    'ДРР, %': round(num(summary.drr)),
    'ROMI, %': round(num(summary.romi)),
    'Логистика, руб': round(num(summary.logistics)),
    'Логистика от продаж, %': round(num(summary.logisticsFromSalesPercent)),
    'Хранение, руб': round(num(summary.storageFee)),
    'Хранение от продаж, %': round(num(summary.storageFromSalesPercent)),
    'Комиссия, руб': round(num(summary.commission)),
    'Комиссия от продаж, %': pct(num(summary.commission), sale),
    'Эквайринг, руб': round(num(summary.acquiringFee)),
    'Штрафы, руб': round(num(summary.penalty)),
    'Налоги, руб': round(num(summary.taxes)),
  }
}

function aggregateBy(rows: ReportRow[], keyFn: (row: ReportRow) => string, accountName: string, label: string) {
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) {
    const key = keyFn(row) || 'Без категории'
    const current = groups.get(key) ?? []
    current.push(row)
    groups.set(key, current)
  }

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const sale = items.reduce((sum, row) => sum + num(row.sale), 0)
      const op = items.reduce((sum, row) => sum + num(row.operatingProfit), 0)
      const qty = items.reduce((sum, row) => sum + row.boughtWithReturns, 0)
      const ad = items.reduce((sum, row) => sum + num(row.adAll), 0)
      const cost = items.reduce((sum, row) => sum + num(row.costPrice), 0)
      return {
        'Кабинет': accountName,
        [label]: key,
        'Артикулов': items.length,
        'Продажи, руб': round(sale),
        'ОП, руб': round(op),
        'Маржинальность, %': pct(op, sale),
        'Выкуплено, шт': qty,
        'Средняя цена, руб': safeDiv(sale, qty),
        'ОП на ед., руб': safeDiv(op, qty),
        'Реклама, руб': round(ad),
        'ДРР, %': pct(ad, sale),
        'Себестоимость, руб': round(cost),
      } satisfies SheetRow
    })
    .sort((a, b) => num(b['Продажи, руб']) - num(a['Продажи, руб']))
}

async function analyzeAccount(account: { id: string; name: string; lastSyncAt: Date | null }): Promise<AccountAnalysis> {
  const from = date(DATE_FROM)
  const to = date(DATE_TO)
  const days = periodDays()

  const [
    report,
    dailyReports,
    coverageChecks,
    coverageRows,
    counts,
    products,
    stocks,
    paginatedStocks,
    adCampaignRows,
    adProductRows,
    adDailyRows,
    funnelRows,
    orderRows,
    saleRows,
    reviewAgg,
    reviewCount,
    reviewUnanswered,
    questionCount,
    questionUnanswered,
  ] = await Promise.all([
    calculateReport(account.id, DATE_FROM, DATE_TO, LOCAL_REPORT_OPTIONS),
    Promise.all(days.map((day) => calculateReport(account.id, day, day, LOCAL_REPORT_OPTIONS))),
    Promise.all(
      Object.values(SYNC_JOB_KINDS).map(async (kind) => ({
        kind,
        ...(await getSyncCoverage(account.id, kind, DATE_FROM, DATE_TO)),
      })),
    ),
    prisma.syncDataCoverage.findMany({
      where: {
        wbAccountId: account.id,
        dateTo: { gte: from },
        dateFrom: { lte: to },
      },
      select: { kind: true, dateFrom: true, dateTo: true, syncedAt: true },
      orderBy: [{ kind: 'asc' }, { dateFrom: 'asc' }],
    }),
    Promise.all([
      prisma.realizationReport.count({
        where: {
          wbAccountId: account.id,
          OR: [{ rrDt: { gte: from, lte: to } }, { rrDt: null, dateFrom: { lte: to }, dateTo: { gte: from } }],
        },
      }),
      prisma.wbOrder.count({ where: { wbAccountId: account.id, date: { gte: from, lte: to } } }),
      prisma.wbSale.count({ where: { wbAccountId: account.id, date: { gte: from, lte: to } } }),
      prisma.wbFunnelStat.count({ where: { wbAccountId: account.id, date: { gte: from, lte: to } } }),
      prisma.adCampaignStat.count({ where: { date: { gte: from, lte: to }, campaign: { wbAccountId: account.id } } }),
      prisma.adCampaignNmStat.count({ where: { date: { gte: from, lte: to }, campaign: { wbAccountId: account.id } } }),
    ]),
    prisma.product.findMany({
      where: { wbAccountId: account.id },
      select: {
        nmId: true,
        vendorCode: true,
        title: true,
        category: true,
        brand: true,
        imtId: true,
        sizes: { select: { price: true, discount: true, spp: true, techSize: true, wbSize: true } },
      },
    }),
    getStocksSummary(account.id),
    getPaginatedStocks({
      wbAccountId: account.id,
      page: 1,
      pageSize: 10000,
      warehouse: TOTAL_STOCK_WAREHOUSE_VALUE,
      sortBy: 'risk',
      sortDir: 'asc',
    }),
    prisma.adCampaignStat.groupBy({
      by: ['campaignId'],
      where: { date: { gte: from, lte: to }, source: 'total', campaign: { wbAccountId: account.id } },
      _sum: { views: true, clicks: true, spend: true, orders: true, cartAdds: true, orderSum: true },
    }),
    prisma.adCampaignNmStat.groupBy({
      by: ['campaignId', 'nmId'],
      where: { date: { gte: from, lte: to }, source: 'total', campaign: { wbAccountId: account.id } },
      _sum: { views: true, clicks: true, spend: true, orders: true, cartAdds: true, orderSum: true },
    }),
    prisma.adCampaignStat.groupBy({
      by: ['date'],
      where: { date: { gte: from, lte: to }, source: 'total', campaign: { wbAccountId: account.id } },
      _sum: { views: true, clicks: true, spend: true, orders: true, cartAdds: true, orderSum: true },
      orderBy: { date: 'asc' },
    }),
    prisma.wbFunnelStat.groupBy({
      by: ['date'],
      where: { wbAccountId: account.id, date: { gte: from, lte: to } },
      _sum: { openCount: true, addToCartCount: true, cartCount: true, ordersCount: true, ordersSumRub: true },
      orderBy: { date: 'asc' },
    }),
    prisma.wbOrder.groupBy({
      by: ['date'],
      where: { wbAccountId: account.id, date: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { finishedPrice: true },
      orderBy: { date: 'asc' },
    }),
    prisma.wbSale.groupBy({
      by: ['date', 'isReturn'],
      where: { wbAccountId: account.id, date: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { finishedPrice: true, forPay: true },
      orderBy: { date: 'asc' },
    }),
    prisma.productReview.aggregate({
      where: { wbAccountId: account.id, createdDate: { gte: from, lte: addDays(to, 1) } },
      _avg: { rating: true },
    }),
    prisma.productReview.count({ where: { wbAccountId: account.id, createdDate: { gte: from, lte: addDays(to, 1) } } }),
    prisma.productReview.count({
      where: { wbAccountId: account.id, createdDate: { gte: from, lte: addDays(to, 1) }, isAnswered: false },
    }),
    prisma.productQuestion.count({ where: { wbAccountId: account.id, createdDate: { gte: from, lte: addDays(to, 1) } } }),
    prisma.productQuestion.count({
      where: { wbAccountId: account.id, createdDate: { gte: from, lte: addDays(to, 1) }, isAnswered: false },
    }),
  ])

  const productByNm = new Map(products.map((product) => [product.nmId, product]))
  const campaignIds = Array.from(new Set([...adCampaignRows.map((row) => row.campaignId), ...adProductRows.map((row) => row.campaignId)]))
  const campaigns = await prisma.adCampaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, advertId: true, name: true, status: true, budget: true, bidType: true, paymentType: true, placementSearch: true, placementReco: true },
  })
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))

  const flatStockRows = flattenStockRows(paginatedStocks.rows)
  const stockByKey = new Map(flatStockRows.map((row) => [stockKey(row), row]))
  const stockByNm = new Map<number, StockSummaryItem>()
  for (const row of paginatedStocks.rows) {
    stockByNm.set(row.nmId, row)
  }

  const reportRows = flattenReportRows(report.rows)
  const productsSheet = reportRows
    .map((row) => {
      const displayVendorCode = (row as ReportRow & { displayVendorCode?: string }).displayVendorCode
      const stockRow = stockByKey.get(reportStockKey(row)) ?? stockByNm.get(row.parentNmId ?? row.nmId)
      const product = productByNm.get(row.parentNmId ?? row.nmId)
      const sale = num(row.sale)
      const op = num(row.operatingProfit)
      const ad = num(row.adAll)
      return {
        'Кабинет': account.name,
        'nmId': row.parentNmId ?? row.nmId,
        'Артикул': displayVendorCode ?? row.vendorCode,
        'Размер': row.sizeLabel ?? '',
        'Категория': row.subjectName || product?.category || '',
        'Бренд': row.brandName || product?.brand || '',
        'Название': product?.title ?? '',
        'Продажи, руб': round(sale),
        'ОП, руб': round(op),
        'Маржинальность, %': round(num(row.marginality)),
        'ОП на ед., руб': round(num(row.operatingProfitUnit)),
        'Выкуплено, шт': row.boughtWithReturns,
        'Доставлено, шт': row.delivered,
        'Выкуп, %': round(num(row.buyoutPercent)),
        'Возвраты, шт': row.returns,
        'Отмены, шт': row.cancellations,
        'Средняя цена, руб': round(num(row.avgPrice)),
        'Себестоимость, руб': round(num(row.costPrice)),
        'Реклама, руб': round(ad),
        'ДРР, %': round(num(row.drr)),
        'Логистика, руб': round(num(row.logistics)),
        'Хранение, руб': round(num(row.storageFee)),
        'Комиссия, руб': round(num(row.commission)),
        'Остаток, шт': stockRow?.quantity ?? null,
        'Риск остатка': stockRow?.risk ?? null,
        'Оборачиваемость, дн': stockRow?.turnoverDays == null ? null : round(stockRow.turnoverDays),
        'Фактор': buildProductFactor(row),
      } satisfies SheetRow
    })
    .sort((a, b) => num(b['ОП, руб']) - num(a['ОП, руб']))

  const adCampaignSheet = adCampaignRows
    .map((row) => {
      const campaign = campaignById.get(row.campaignId)
      const views = row._sum.views ?? 0
      const clicks = row._sum.clicks ?? 0
      const spend = num(row._sum.spend)
      const orders = row._sum.orders ?? 0
      const orderSum = num(row._sum.orderSum)
      return {
        'Кабинет': account.name,
        'ID кампании WB': campaign?.advertId ?? '',
        'Кампания': campaign?.name ?? row.campaignId,
        'Статус': campaign ? statusLabel(campaign.status) : '',
        'Тип ставки': campaign?.bidType ?? '',
        'Оплата': campaign?.paymentType ?? '',
        'Поиск': campaign?.placementSearch ? 'да' : 'нет',
        'Рекомендации': campaign?.placementReco ? 'да' : 'нет',
        'Бюджет, руб': campaign?.budget == null ? null : round(num(campaign.budget)),
        'Показы': views,
        'Клики': clicks,
        'CTR, %': pct(clicks, views),
        'CPC, руб': safeDiv(spend, clicks),
        'Добавления в корзину': row._sum.cartAdds ?? 0,
        'Заказы из рекламы, шт': orders,
        'Заказы из рекламы, руб': round(orderSum),
        'Расход, руб': round(spend),
        'CPO, руб': safeDiv(spend, orders),
        'ДРР рекламы к ad order sum, %': pct(spend, orderSum),
      } satisfies SheetRow
    })
    .sort((a, b) => num(b['Расход, руб']) - num(a['Расход, руб']))

  const adProductSheet = adProductRows
    .map((row) => {
      const campaign = campaignById.get(row.campaignId)
      const product = productByNm.get(row.nmId)
      const views = row._sum.views ?? 0
      const clicks = row._sum.clicks ?? 0
      const spend = num(row._sum.spend)
      const orders = row._sum.orders ?? 0
      const orderSum = num(row._sum.orderSum)
      return {
        'Кабинет': account.name,
        'Кампания': campaign?.name ?? row.campaignId,
        'nmId': row.nmId,
        'Артикул': product?.vendorCode ?? '',
        'Категория': product?.category ?? '',
        'Бренд': product?.brand ?? '',
        'Показы': views,
        'Клики': clicks,
        'CTR, %': pct(clicks, views),
        'CPC, руб': safeDiv(spend, clicks),
        'Добавления в корзину': row._sum.cartAdds ?? 0,
        'Заказы из рекламы, шт': orders,
        'Заказы из рекламы, руб': round(orderSum),
        'Расход, руб': round(spend),
        'CPO, руб': safeDiv(spend, orders),
      } satisfies SheetRow
    })
    .sort((a, b) => num(b['Расход, руб']) - num(a['Расход, руб']))

  const dailyByDate = new Map(dailyReports.map((dailyReport) => [dailyReport.dateFrom, makeFinanceRow(account.name, dailyReport.summary)]))
  const ordersByDate = new Map(orderRows.map((row) => [dateKey(row.date), row]))
  const salesByDate = new Map<string, { salesCount: number; salesRub: number; returnCount: number; returnRub: number }>()
  for (const row of saleRows) {
    const key = dateKey(row.date)
    const current = salesByDate.get(key) ?? { salesCount: 0, salesRub: 0, returnCount: 0, returnRub: 0 }
    if (row.isReturn) {
      current.returnCount += row._count._all
      current.returnRub += num(row._sum.finishedPrice)
    } else {
      current.salesCount += row._count._all
      current.salesRub += num(row._sum.finishedPrice)
    }
    salesByDate.set(key, current)
  }
  const adByDate = new Map(adDailyRows.map((row) => [dateKey(row.date), row]))
  const funnelByDate = new Map(funnelRows.map((row) => [dateKey(row.date), row]))

  const dailySheet = days.map((day) => {
    const finance = dailyByDate.get(day) ?? {}
    const orders = ordersByDate.get(day)
    const sales = salesByDate.get(day)
    const ad = adByDate.get(day)
    const funnel = funnelByDate.get(day)
    return {
      'Кабинет': account.name,
      'Дата': day,
      ...finance,
      'Заказы WB, шт': orders?._count._all ?? 0,
      'Заказы WB, руб': round(num(orders?._sum.finishedPrice)),
      'Продажи wb_sales, шт': sales?.salesCount ?? 0,
      'Продажи wb_sales, руб': round(sales?.salesRub ?? 0),
      'Возвраты wb_sales, шт': sales?.returnCount ?? 0,
      'Возвраты wb_sales, руб': round(sales?.returnRub ?? 0),
      'Реклама показы': ad?._sum.views ?? 0,
      'Реклама клики': ad?._sum.clicks ?? 0,
      'Реклама расход, руб': round(num(ad?._sum.spend)),
      'Реклама заказы, шт': ad?._sum.orders ?? 0,
      'Реклама заказы, руб': round(num(ad?._sum.orderSum)),
      'Воронка открытия': funnel?._sum.openCount ?? 0,
      'Воронка корзины': funnel?._sum.addToCartCount ?? 0,
      'Воронка заказы, шт': funnel?._sum.ordersCount ?? 0,
      'Воронка заказы, руб': round(num(funnel?._sum.ordersSumRub)),
    } satisfies SheetRow
  })

  const funnelTotals = funnelRows.reduce(
    (acc, row) => {
      acc.open += row._sum.openCount ?? 0
      acc.addToCart += row._sum.addToCartCount ?? 0
      acc.cart += row._sum.cartCount ?? 0
      acc.orders += row._sum.ordersCount ?? 0
      acc.ordersRub += num(row._sum.ordersSumRub)
      return acc
    },
    { open: 0, addToCart: 0, cart: 0, orders: 0, ordersRub: 0 },
  )

  return {
    accountId: account.id,
    accountName: account.name,
    coverage: [
      ...coverageChecks.map((row) => ({
        'Кабинет': account.name,
        'Тип данных': row.kind,
        'Покрыт период': row.isCovered ? 'да' : 'нет',
        'Синхронизировано': row.syncedAt ?? '',
        'Проверенный период': 'checkedRange' in row ? row.checkedRange ?? '' : '',
      })),
      ...coverageRows.map((row) => ({
        'Кабинет': account.name,
        'Тип данных': `${row.kind} range`,
        'Покрыт период': '',
        'Синхронизировано': row.syncedAt.toISOString(),
        'Проверенный период': `${dateKey(row.dateFrom)} - ${dateKey(row.dateTo)}`,
      })),
    ],
    dataCounts: {
      'Кабинет': account.name,
      'realization_reports строк': counts[0],
      'wb_orders строк': counts[1],
      'wb_sales строк': counts[2],
      'wb_funnel_stats строк': counts[3],
      'ad_campaign_stats строк': counts[4],
      'ad_campaign_nm_stats строк': counts[5],
      'lastSyncAt': account.lastSyncAt?.toISOString() ?? '',
    },
    finance: makeFinanceRow(account.name, report.summary),
    daily: dailySheet,
    products: productsSheet,
    categories: aggregateBy(reportRows, (row) => row.subjectName, account.name, 'Категория'),
    advertisingCampaigns: adCampaignSheet,
    advertisingProducts: adProductSheet,
    funnel: {
      'Кабинет': account.name,
      'Открытия карточек': funnelTotals.open,
      'Добавления в корзину': funnelTotals.addToCart,
      'Корзины': funnelTotals.cart,
      'Заказы, шт': funnelTotals.orders,
      'Заказы, руб': round(funnelTotals.ordersRub),
      'Открытие -> корзина, %': pct(funnelTotals.addToCart, funnelTotals.open),
      'Корзина -> заказ, %': pct(funnelTotals.orders, funnelTotals.cart || funnelTotals.addToCart),
      'Открытие -> заказ, %': pct(funnelTotals.orders, funnelTotals.open),
    },
    stocks: {
      'Кабинет': account.name,
      'Статус': stocks.status,
      'Снимок остатков': stocks.syncedAt ?? '',
      'Остаток, шт': stocks.totalUnits,
      'Себестоимость остатков, руб': round(stocks.stockValue),
      'В пути к клиенту': stocks.inWayToClient,
      'В пути от клиента': stocks.inWayFromClient,
      'Низкий остаток SKU': stocks.lowStockCount,
      'Нет остатка SKU': stocks.outOfStockCount,
      'Излишек SKU': stocks.overstockCount,
      'Есть продажи, нет остатка': stocks.productsWithSalesNoStock,
      'Есть остаток, нет продаж': stocks.productsWithStockNoSales,
    },
    stockRows: paginatedStocks.rows.map((row) => ({
      'Кабинет': account.name,
      'nmId': row.nmId,
      'Артикул': row.vendorCode,
      'Категория': row.category ?? '',
      'Бренд': row.brand ?? '',
      'Название': row.title ?? '',
      'Остаток, шт': row.quantity,
      'В пути к клиенту': row.inWayToClient,
      'В пути от клиента': row.inWayFromClient,
      'Себестоимость остатка, руб': round(row.stockValue),
      'Риск': row.risk,
      'Дней до нуля': row.daysUntilZero == null ? null : round(row.daysUntilZero),
      'Оборачиваемость, дн': row.turnoverDays == null ? null : round(row.turnoverDays),
    })),
    reviewsQuestions: {
      'Кабинет': account.name,
      'Отзывы за период': reviewCount,
      'Средняя оценка': reviewAgg._avg.rating == null ? null : round(reviewAgg._avg.rating, 2),
      'Неотвеченные отзывы': reviewUnanswered,
      'Вопросы за период': questionCount,
      'Неотвеченные вопросы': questionUnanswered,
    },
  }
}

function buildProductFactor(row: ReportRow) {
  const factors: string[] = []
  const sale = num(row.sale)
  const op = num(row.operatingProfit)
  const margin = num(row.marginality)
  const drr = num(row.drr)
  if (sale <= 0) factors.push('нет продаж')
  if (op < 0) factors.push('убыток')
  if (margin >= 20) factors.push('высокая маржа')
  if (margin > 0 && margin < 10) factors.push('низкая маржа')
  if (drr > 10) factors.push('высокий ДРР')
  if (row.buyoutPercent && num(row.buyoutPercent) < 50) factors.push('низкий выкуп')
  if (row.returns > 0) factors.push('возвраты')
  if (row.cancellations > 0) factors.push('отмены')
  return factors.join(', ')
}

function buildComparison(analyses: AccountAnalysis[]) {
  const [galioni, nimba] = [
    analyses.find((item) => item.accountName.toLocaleLowerCase('ru-RU').includes('galioni')),
    analyses.find((item) => item.accountName.toLocaleLowerCase('ru-RU').includes('nimba')),
  ]
  if (!galioni || !nimba) return []

  const metrics = [
    'Заказано, руб',
    'Продажи/выручка, руб',
    'ОП, руб',
    'Маржинальность, %',
    'ОП на ед., руб',
    'Выкуплено с возвратами, шт',
    'Выкуп, %',
    'Возвраты, шт',
    'Средняя цена, руб',
    'Себестоимость от продаж, %',
    'Реклама, руб',
    'ДРР, %',
    'Логистика от продаж, %',
    'Хранение от продаж, %',
    'Комиссия от продаж, %',
  ]

  return metrics.map((metric) => {
    const g = num(galioni.finance[metric])
    const n = num(nimba.finance[metric])
    return {
      'Метрика': metric,
      'WB Galioni': round(g),
      'WB Nimba': round(n),
      'Разница Galioni - Nimba': round(g - n),
      'Galioni / Nimba': n === 0 ? null : round(g / n, 3),
    } satisfies SheetRow
  })
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: SheetRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Нет данных': '' }])
  const keys = Object.keys(rows[0] ?? { 'Нет данных': '' })
  ws['!cols'] = keys.map((key) => ({ wch: Math.min(Math.max(key.length + 4, 14), 36) }))
  XLSX.utils.book_append_sheet(workbook, ws, name.slice(0, 31))
}

function buildFindings(analyses: AccountAnalysis[]) {
  const galioni = analyses.find((item) => item.accountName.toLocaleLowerCase('ru-RU').includes('galioni'))
  const nimba = analyses.find((item) => item.accountName.toLocaleLowerCase('ru-RU').includes('nimba'))
  if (!galioni || !nimba) return []

  const gSale = num(galioni.finance['Продажи/выручка, руб'])
  const nSale = num(nimba.finance['Продажи/выручка, руб'])
  const gOp = num(galioni.finance['ОП, руб'])
  const nOp = num(nimba.finance['ОП, руб'])
  const gUnits = num(galioni.finance['Выкуплено с возвратами, шт'])
  const nUnits = num(nimba.finance['Выкуплено с возвратами, шт'])
  const gAvg = num(galioni.finance['Средняя цена, руб'])
  const nAvg = num(nimba.finance['Средняя цена, руб'])
  const gTop = galioni.products.slice(0, 5).reduce((sum, row) => sum + num(row['Продажи, руб']), 0)
  const nTop = nimba.products.slice(0, 5).reduce((sum, row) => sum + num(row['Продажи, руб']), 0)

  return [
    {
      'Фактор': 'Масштаб продаж',
      'Вывод': `Galioni продал на ${round(gSale - nSale)} руб больше; отношение ${nSale === 0 ? 'н/д' : round(gSale / nSale, 2)}x.`,
    },
    {
      'Фактор': 'Операционная прибыль',
      'Вывод': `ОП Galioni выше на ${round(gOp - nOp)} руб; отношение ${nOp === 0 ? 'н/д' : round(gOp / nOp, 2)}x.`,
    },
    {
      'Фактор': 'Количество и цена',
      'Вывод': `Выкупленные единицы: Galioni ${gUnits}, Nimba ${nUnits}. Средняя цена: Galioni ${gAvg} руб, Nimba ${nAvg} руб.`,
    },
    {
      'Фактор': 'Концентрация топов',
      'Вывод': `Топ-5 товаров дают Galioni ${pct(gTop, gSale)}% продаж, Nimba ${pct(nTop, nSale)}% продаж.`,
    },
    {
      'Фактор': 'Реклама',
      'Вывод': `ДРР: Galioni ${galioni.finance['ДРР, %']}%, Nimba ${nimba.finance['ДРР, %']}%. Расход: Galioni ${galioni.finance['Реклама, руб']} руб, Nimba ${nimba.finance['Реклама, руб']} руб.`,
    },
    {
      'Фактор': 'Остатки',
      'Вывод': `Остаток: Galioni ${galioni.stocks['Остаток, шт']} шт, Nimba ${nimba.stocks['Остаток, шт']} шт. Низкий/нулевой остаток: Galioni ${galioni.stocks['Низкий остаток SKU']}/${galioni.stocks['Нет остатка SKU']}, Nimba ${nimba.stocks['Низкий остаток SKU']}/${nimba.stocks['Нет остатка SKU']}.`,
    },
  ] satisfies SheetRow[]
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const accounts = await prisma.wbAccount.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: 'Galioni', mode: 'insensitive' } },
        { name: { contains: 'Nimba', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, lastSyncAt: true },
    orderBy: { name: 'asc' },
  })

  if (accounts.length === 0) {
    throw new Error('Не найдены активные кабинеты WB Galioni/WB Nimba.')
  }

  const analyses = await Promise.all(accounts.map((account) => analyzeAccount(account)))
  const comparison = buildComparison(analyses)
  const findings = buildFindings(analyses)

  const workbook = XLSX.utils.book_new()
  addSheet(workbook, 'Выводы', findings)
  addSheet(workbook, 'Сравнение', comparison)
  addSheet(workbook, 'Финансы', analyses.map((item) => item.finance))
  addSheet(workbook, 'Покрытие', analyses.flatMap((item) => item.coverage))
  addSheet(workbook, 'Строки данных', analyses.map((item) => item.dataCounts))
  addSheet(workbook, 'Дни', analyses.flatMap((item) => item.daily))
  addSheet(workbook, 'Товары', analyses.flatMap((item) => item.products))
  addSheet(workbook, 'Категории', analyses.flatMap((item) => item.categories))
  addSheet(workbook, 'Реклама кампании', analyses.flatMap((item) => item.advertisingCampaigns))
  addSheet(workbook, 'Реклама товары', analyses.flatMap((item) => item.advertisingProducts))
  addSheet(workbook, 'Воронка', analyses.map((item) => item.funnel))
  addSheet(workbook, 'Остатки сводка', analyses.map((item) => item.stocks))
  addSheet(workbook, 'Остатки товары', analyses.flatMap((item) => item.stockRows))
  addSheet(workbook, 'Отзывы вопросы', analyses.map((item) => item.reviewsQuestions))

  XLSX.writeFile(workbook, OUT_XLSX)
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        period: { dateFrom: DATE_FROM, dateTo: DATE_TO },
        output: OUT_XLSX,
        findings,
        comparison,
        finance: analyses.map((item) => item.finance),
        stocks: analyses.map((item) => item.stocks),
        dataCounts: analyses.map((item) => item.dataCounts),
        topProducts: analyses.map((item) => ({ account: item.accountName, rows: item.products.slice(0, 10) })),
        topAdCampaigns: analyses.map((item) => ({ account: item.accountName, rows: item.advertisingCampaigns.slice(0, 10) })),
        funnel: analyses.map((item) => item.funnel),
        reviewsQuestions: analyses.map((item) => item.reviewsQuestions),
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`Excel: ${OUT_XLSX}`)
  console.log(`JSON: ${OUT_JSON}`)
  console.table(analyses.map((item) => item.finance))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
