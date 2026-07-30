import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { calculateReport } from '@/lib/services/report-calculator'
import { getPaginatedStocks } from '@/lib/services/stocks'
import { TOTAL_STOCK_WAREHOUSE_VALUE } from '@/types/stocks'
import type { ReportRow } from '@/types/reports'

const DATE_FROM = '2026-06-22'
const DATE_TO = '2026-06-25'
const OUT_DIR = path.join(process.cwd(), 'output', 'excel')
const OUT_XLSX = path.join(OUT_DIR, `wb_nimba_cancellations_${DATE_FROM}_${DATE_TO}.xlsx`)
const OUT_JSON = path.join(OUT_DIR, `wb_nimba_cancellations_${DATE_FROM}_${DATE_TO}.json`)

const reportOptions = {
  preferPersistedAdStats: true,
  preferLiveAdCostTotals: false,
}

type SheetRow = Record<string, string | number | null>
type CategorySummary = {
  'Категория': string
  'Проблемных строк': number
  'Продажи, руб': number
  'ОП, руб': number
  'Выкуплено, шт': number
  'Доставлено, шт': number
  'Отмены фин. отчета, шт': number
  'Заказы WB, шт': number
  'Отмененные заказы WB, шт': number
  'Реклама расход, руб': number
}

function n(value: unknown) {
  return Number(value ?? 0)
}

function round(value: number, digits = 2) {
  const m = 10 ** digits
  return Math.round((value + Number.EPSILON) * m) / m
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : round((a / b) * 100)
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function displayVendorCode(row: ReportRow) {
  return (row as ReportRow & { displayVendorCode?: string }).displayVendorCode ?? row.vendorCode
}

function stockKey(nmId: number, sizeLabel: string | null | undefined) {
  return `${nmId}:${sizeLabel ?? ''}`
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: SheetRow[]) {
  const data = rows.length ? rows : [{ 'Нет данных': '' }]
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = Object.keys(data[0]).map((key) => ({ wch: Math.min(Math.max(key.length + 4, 14), 40) }))
  XLSX.utils.book_append_sheet(workbook, ws, name.slice(0, 31))
}

function classify(row: {
  sale: number
  op: number
  cancellations: number
  delivered: number
  buyout: number
  adSpend: number
  adOrders: number
  stock: number | null
}) {
  const reasons: string[] = []
  if (row.cancellations > 0 && row.sale <= 0) reasons.push('отмены без продаж')
  if (row.buyout > 0 && row.buyout < 40) reasons.push('низкий выкуп')
  if (row.op < 0) reasons.push('убыток')
  if (row.adSpend > 0 && row.adOrders <= 3) reasons.push('реклама без достаточных заказов')
  if (row.stock === 0 && row.delivered > 0) reasons.push('проверить остаток/размер')
  if (row.cancellations >= 4) reasons.push('много отмен')
  return reasons.join(', ')
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const account = await prisma.wbAccount.findFirstOrThrow({
    where: { isActive: true, name: { contains: 'Nimba', mode: 'insensitive' } },
    select: { id: true, name: true },
  })

  const [report, stocks, products, adRows, orderRows] = await Promise.all([
    calculateReport(account.id, DATE_FROM, DATE_TO, reportOptions),
    getPaginatedStocks({
      wbAccountId: account.id,
      page: 1,
      pageSize: 10000,
      warehouse: TOTAL_STOCK_WAREHOUSE_VALUE,
      sortBy: 'risk',
      sortDir: 'asc',
    }),
    prisma.product.findMany({
      where: { wbAccountId: account.id },
      select: { nmId: true, vendorCode: true, category: true, brand: true, title: true },
    }),
    prisma.adCampaignNmStat.groupBy({
      by: ['nmId'],
      where: {
        source: 'total',
        date: { gte: date(DATE_FROM), lte: date(DATE_TO) },
        campaign: { wbAccountId: account.id },
      },
      _sum: { views: true, clicks: true, spend: true, orders: true, orderSum: true, cartAdds: true },
    }),
    prisma.wbOrder.groupBy({
      by: ['nmId', 'isCancel'],
      where: {
        wbAccountId: account.id,
        date: { gte: date(DATE_FROM), lte: date(DATE_TO) },
      },
      _count: { _all: true },
      _sum: { finishedPrice: true },
    }),
  ])

  const productByNm = new Map(products.map((product) => [product.nmId, product]))
  const adByNm = new Map(adRows.map((row) => [row.nmId, row]))
  const orderByNm = new Map<number, { orders: number; canceledOrders: number; orderRub: number; canceledRub: number }>()
  for (const row of orderRows) {
    const current = orderByNm.get(row.nmId) ?? { orders: 0, canceledOrders: 0, orderRub: 0, canceledRub: 0 }
    current.orders += row._count._all
    current.orderRub += n(row._sum.finishedPrice)
    if (row.isCancel) {
      current.canceledOrders += row._count._all
      current.canceledRub += n(row._sum.finishedPrice)
    }
    orderByNm.set(row.nmId, current)
  }

  const stockRows = stocks.rows.flatMap((row) => (row.sizeRows?.length ? row.sizeRows : [row]))
  const stockByKey = new Map(stockRows.map((row) => [stockKey(row.parentVendorCode ? row.nmId : row.nmId, row.sizeLabel), row]))
  const stockByNm = new Map(stocks.rows.map((row) => [row.nmId, row]))

  const rows = report.rows
    .flatMap((row) => (row.sizeRows?.length ? row.sizeRows : [row]))
    .map((row) => {
      const nmId = row.parentNmId ?? row.nmId
      const product = productByNm.get(nmId)
      const ad = adByNm.get(nmId)
      const orders = orderByNm.get(nmId)
      const stock = stockByKey.get(stockKey(nmId, row.sizeLabel)) ?? stockByNm.get(nmId)
      const sale = n(row.sale)
      const op = n(row.operatingProfit)
      const adSpend = n(ad?._sum.spend)
      const adOrders = ad?._sum.orders ?? 0
      const result = {
        'Артикул': displayVendorCode(row),
        'Размер': row.sizeLabel ?? '',
        'nmId': nmId,
        'Категория': row.subjectName || product?.category || '',
        'Продажи, руб': round(sale),
        'ОП, руб': round(op),
        'Выкуплено, шт': row.boughtWithReturns,
        'Доставлено, шт': row.delivered,
        'Выкуп, %': round(n(row.buyoutPercent)),
        'Отмены фин. отчета, шт': row.cancellations,
        'Возвраты, шт': row.returns,
        'Заказы WB, шт': orders?.orders ?? 0,
        'Отмененные заказы WB, шт': orders?.canceledOrders ?? 0,
        'Отмена заказов WB, %': pct(orders?.canceledOrders ?? 0, orders?.orders ?? 0),
        'Заказы WB, руб': round(orders?.orderRub ?? 0),
        'Отмененные заказы WB, руб': round(orders?.canceledRub ?? 0),
        'Реклама показы': ad?._sum.views ?? 0,
        'Реклама клики': ad?._sum.clicks ?? 0,
        'Реклама расход, руб': round(adSpend),
        'Реклама заказы, шт': adOrders,
        'Реклама order sum, руб': round(n(ad?._sum.orderSum)),
        'CPO рекламы, руб': adOrders === 0 ? 0 : round(adSpend / adOrders),
        'Остаток, шт': stock?.quantity ?? null,
        'Риск остатка': stock?.risk ?? null,
        'Диагноз': classify({
          sale,
          op,
          cancellations: row.cancellations,
          delivered: row.delivered,
          buyout: n(row.buyoutPercent),
          adSpend,
          adOrders,
          stock: stock?.quantity ?? null,
        }),
      } satisfies SheetRow
      return result
    })
    .filter((row) => n(row['Отмены фин. отчета, шт']) > 0 || n(row['Отмененные заказы WB, шт']) > 0 || n(row['ОП, руб']) < 0)
    .sort((a, b) => {
      const cancelDiff = n(b['Отмены фин. отчета, шт']) - n(a['Отмены фин. отчета, шт'])
      return cancelDiff || n(a['ОП, руб']) - n(b['ОП, руб'])
    })

  const summaryByCategory = Array.from(
    rows.reduce((map, row) => {
      const key = String(row['Категория'] || 'Без категории')
      const current = map.get(key) ?? {
        'Категория': key,
        'Проблемных строк': 0,
        'Продажи, руб': 0,
        'ОП, руб': 0,
        'Выкуплено, шт': 0,
        'Доставлено, шт': 0,
        'Отмены фин. отчета, шт': 0,
        'Заказы WB, шт': 0,
        'Отмененные заказы WB, шт': 0,
        'Реклама расход, руб': 0,
      }
      current['Проблемных строк'] += 1
      current['Продажи, руб'] += n(row['Продажи, руб'])
      current['ОП, руб'] += n(row['ОП, руб'])
      current['Выкуплено, шт'] += n(row['Выкуплено, шт'])
      current['Доставлено, шт'] += n(row['Доставлено, шт'])
      current['Отмены фин. отчета, шт'] += n(row['Отмены фин. отчета, шт'])
      current['Заказы WB, шт'] += n(row['Заказы WB, шт'])
      current['Отмененные заказы WB, шт'] += n(row['Отмененные заказы WB, шт'])
      current['Реклама расход, руб'] += n(row['Реклама расход, руб'])
      map.set(key, current)
      return map
    }, new Map<string, CategorySummary>()).values(),
  ).map((row) => ({
    ...row,
    'Выкуп, %': pct(n(row['Выкуплено, шт']), n(row['Доставлено, шт'])),
    'Отмена заказов WB, %': pct(n(row['Отмененные заказы WB, шт']), n(row['Заказы WB, шт'])),
  }))

  const recommendations: SheetRow[] = [
    {
      'Приоритет': 1,
      'Что': 'Ограничить кампанию/товар с расходом без продаж',
      'Почему': 'Туника с поясом леопард пятна: 0 продаж, -2473.41 руб ОП, 2017.93 руб рекламы.',
      'Действие': 'Не увеличивать бюджет; проверить товар в кампании от 03.06 и убрать из продвижения до исправления карточки/оффера.',
    },
    {
      'Приоритет': 2,
      'Что': 'Убрать из продвижения товары с отменами без продаж',
      'Почему': 'Парео зеленый, парео/хлопок/зеленый и ряд цветов дали отмены/логистику без продаж.',
      'Действие': 'Оставить в рекламе только товары с продажами, положительной ОП и выкупом выше 55-60%.',
    },
    {
      'Приоритет': 3,
      'Что': 'Перенести бюджет на товары с подтвержденным выкупом',
      'Почему': 'Нужна связка как у Galioni: трафик на ходовой товар, а не на проблемный ассортимент.',
      'Действие': 'Тестировать детские туники прибыльных размеров и парео оранж; перед усилением проверить остаток размера.',
    },
  ]

  const workbook = XLSX.utils.book_new()
  addSheet(workbook, 'Проблемные товары', rows)
  addSheet(workbook, 'Категории', summaryByCategory as SheetRow[])
  addSheet(workbook, 'Рекомендации', recommendations)
  XLSX.writeFile(workbook, OUT_XLSX)
  fs.writeFileSync(OUT_JSON, JSON.stringify({ rows, summaryByCategory, recommendations }, null, 2), 'utf8')

  console.log(`Excel: ${OUT_XLSX}`)
  console.log(`JSON: ${OUT_JSON}`)
  console.table(rows.slice(0, 15))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
