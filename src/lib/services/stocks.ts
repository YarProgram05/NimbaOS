import { prisma } from '@/lib/db'
import {
  TOTAL_STOCK_WAREHOUSE_VALUE,
  type GetStocksOptions,
  type PaginatedStocks,
  type StockRisk,
  type StockSummaryItem,
  type StockWarehouseSummary,
  type StocksSummary,
} from '@/types/stocks'

const LOW_STOCK_QTY = 3
const LOW_STOCK_DAYS = 7
const OVERSTOCK_DAYS = 60
const SALES_WINDOW_DAYS = 30
const TOTAL_STOCK_WAREHOUSE_LABEL = 'Общий остаток'

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function riskRank(risk: StockRisk): number {
  if (risk === 'out_of_stock') return 1
  if (risk === 'low_stock') return 2
  if (risk === 'overstock') return 3
  if (risk === 'no_sales') return 4
  return 5
}

function calculateRisk(quantity: number, sales30: number): { risk: StockRisk; daysUntilZero: number | null } {
  if (quantity <= 0) return { risk: 'out_of_stock', daysUntilZero: 0 }

  if (sales30 > 0) {
    const dailySales = sales30 / SALES_WINDOW_DAYS
    const daysUntilZero = quantity / dailySales
    if (daysUntilZero <= LOW_STOCK_DAYS) return { risk: 'low_stock', daysUntilZero }
    if (daysUntilZero > OVERSTOCK_DAYS) return { risk: 'overstock', daysUntilZero }
    return { risk: 'ok', daysUntilZero }
  }

  if (quantity <= LOW_STOCK_QTY) return { risk: 'low_stock', daysUntilZero: null }
  return { risk: 'no_sales', daysUntilZero: null }
}

function emptySummary(): StocksSummary {
  return {
    status: 'missing',
    syncedAt: null,
    totalUnits: 0,
    stockValue: 0,
    inWayToClient: 0,
    inWayFromClient: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    overstockCount: 0,
    productsWithSalesNoStock: 0,
    productsWithStockNoSales: 0,
    items: [],
    warehouses: [],
  }
}

async function buildStocksData(wbAccountId: string): Promise<{
  summary: StocksSummary
  rows: StockSummaryItem[]
  brands: string[]
  categories: string[]
  warehouseOptions: StockWarehouseSummary[]
}> {
  const snapshot = await prisma.stockSnapshot.findFirst({
    where: { wbAccountId },
    orderBy: { syncedAt: 'desc' },
    select: { id: true, syncedAt: true },
  })

  if (!snapshot) {
    return {
      summary: emptySummary(),
      rows: [],
      brands: [],
      categories: [],
      warehouseOptions: [],
    }
  }

  const today = new Date()
  const salesFrom = addDays(today, -SALES_WINDOW_DAYS)
  const [products, stockItems, costPrices, salesRows] = await Promise.all([
    prisma.product.findMany({
      where: { wbAccountId },
      select: {
        id: true,
        nmId: true,
        vendorCode: true,
        brand: true,
        category: true,
        title: true,
        photoUrl: true,
      },
      orderBy: { vendorCode: 'asc' },
    }),
    prisma.stockItem.findMany({
      where: { snapshotId: snapshot.id },
      include: { warehouse: true },
    }),
    prisma.costPrice.findMany({
      where: { wbAccountId },
      select: { vendorCode: true, costPrice: true },
    }),
    prisma.wbSale.findMany({
      where: {
        wbAccountId,
        isReturn: false,
        date: { gte: salesFrom, lte: today },
      },
      select: { nmId: true },
    }),
  ])

  const productByNmId = new Map(products.map((product) => [product.nmId, product]))
  const costByVendor = new Map(costPrices.map((row) => [row.vendorCode, Number(row.costPrice)]))
  const salesByNmId = new Map<number, number>()
  for (const sale of salesRows) {
    salesByNmId.set(sale.nmId, (salesByNmId.get(sale.nmId) ?? 0) + 1)
  }

  const totalsByNmId = new Map<number, { quantity: number; inWayToClient: number; inWayFromClient: number }>()
  const byWarehouse = new Map<number, StockWarehouseSummary>()

  for (const item of stockItems) {
    const current = totalsByNmId.get(item.nmId) ?? { quantity: 0, inWayToClient: 0, inWayFromClient: 0 }
    current.quantity += item.quantity
    current.inWayToClient += item.inWayToClient
    current.inWayFromClient += item.inWayFromClient
    totalsByNmId.set(item.nmId, current)

    const product = productByNmId.get(item.nmId)
    const costPrice = product ? costByVendor.get(product.vendorCode) ?? 0 : 0
    const warehouse = byWarehouse.get(item.warehouseId) ?? {
      warehouseId: item.warehouseId,
      warehouseName: item.warehouse.name,
      regionName: item.warehouse.regionName,
      quantity: 0,
      inWayToClient: 0,
      inWayFromClient: 0,
      stockValue: 0,
    }
    warehouse.quantity += item.quantity
    warehouse.inWayToClient += item.inWayToClient
    warehouse.inWayFromClient += item.inWayFromClient
    warehouse.stockValue += item.quantity * costPrice
    byWarehouse.set(item.warehouseId, warehouse)
  }

  const riskByNmId = new Map<number, { risk: StockRisk; daysUntilZero: number | null }>()
  let totalUnits = 0
  let stockValue = 0
  let inWayToClient = 0
  let inWayFromClient = 0
  let lowStockCount = 0
  let outOfStockCount = 0
  let overstockCount = 0
  let productsWithSalesNoStock = 0
  let productsWithStockNoSales = 0

  for (const product of products) {
    const total = totalsByNmId.get(product.nmId) ?? { quantity: 0, inWayToClient: 0, inWayFromClient: 0 }
    const sales30 = salesByNmId.get(product.nmId) ?? 0
    const risk = calculateRisk(total.quantity, sales30)
    const costPrice = costByVendor.get(product.vendorCode) ?? 0

    totalUnits += total.quantity
    stockValue += total.quantity * costPrice
    inWayToClient += total.inWayToClient
    inWayFromClient += total.inWayFromClient
    if (risk.risk === 'low_stock') lowStockCount++
    if (risk.risk === 'out_of_stock') outOfStockCount++
    if (risk.risk === 'overstock') overstockCount++
    if (sales30 > 0 && total.quantity <= 0) productsWithSalesNoStock++
    if (sales30 === 0 && total.quantity > 0) productsWithStockNoSales++
    riskByNmId.set(product.nmId, risk)
  }

  const rowGroups = new Map<string, {
    nmId: number
    warehouseName: string
    quantity: number
    inWayToClient: number
    inWayFromClient: number
  }>()

  for (const item of stockItems) {
    const key = `${item.nmId}:${item.warehouseId}`
    const group = rowGroups.get(key) ?? {
      nmId: item.nmId,
      warehouseName: item.warehouse.name,
      quantity: 0,
      inWayToClient: 0,
      inWayFromClient: 0,
    }
    group.quantity += item.quantity
    group.inWayToClient += item.inWayToClient
    group.inWayFromClient += item.inWayFromClient
    rowGroups.set(key, group)
  }

  const rows: StockSummaryItem[] = Array.from(rowGroups.values()).map((item) => {
    const product = productByNmId.get(item.nmId)
    const totalRisk = riskByNmId.get(item.nmId) ?? { risk: 'ok' as StockRisk, daysUntilZero: null }
    const costPrice = product ? costByVendor.get(product.vendorCode) ?? 0 : 0

    return {
      nmId: item.nmId,
      vendorCode: product?.vendorCode ?? String(item.nmId),
      brand: product?.brand ?? null,
      category: product?.category ?? null,
      title: product?.title ?? null,
      photoUrl: product?.photoUrl ?? null,
      warehouseName: item.warehouseName,
      quantity: item.quantity,
      inWayToClient: item.inWayToClient,
      inWayFromClient: item.inWayFromClient,
      stockValue: item.quantity * costPrice,
      daysUntilZero: totalRisk.daysUntilZero,
      risk: totalRisk.risk,
      syncedAt: snapshot.syncedAt.toISOString(),
    }
  })

  for (const product of products) {
    const total = totalsByNmId.get(product.nmId)
    if (total && (total.quantity > 0 || total.inWayToClient > 0 || total.inWayFromClient > 0)) continue

    const totalRisk = riskByNmId.get(product.nmId) ?? { risk: 'out_of_stock' as StockRisk, daysUntilZero: 0 }
    rows.push({
      nmId: product.nmId,
      vendorCode: product.vendorCode,
      brand: product.brand,
      category: product.category,
      title: product.title,
      photoUrl: product.photoUrl,
      warehouseName: 'Нет на складах WB',
      quantity: 0,
      inWayToClient: 0,
      inWayFromClient: 0,
      stockValue: 0,
      daysUntilZero: totalRisk.daysUntilZero,
      risk: totalRisk.risk,
      syncedAt: snapshot.syncedAt.toISOString(),
    })
  }

  const warehouseOptions = Array.from(byWarehouse.values())
    .sort((a, b) => b.quantity - a.quantity)
  const summaryRows = rows
    .filter((row) => row.risk !== 'ok')
    .sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || a.quantity - b.quantity)
    .slice(0, 8)

  const summary: StocksSummary = {
    status: 'ready',
    syncedAt: snapshot.syncedAt.toISOString(),
    totalUnits,
    stockValue,
    inWayToClient,
    inWayFromClient,
    lowStockCount,
    outOfStockCount,
    overstockCount,
    productsWithSalesNoStock,
    productsWithStockNoSales,
    items: summaryRows,
    warehouses: warehouseOptions,
  }

  return {
    summary,
    rows,
    brands: Array.from(new Set(products.map((product) => product.brand).filter(Boolean) as string[])).sort(),
    categories: Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).sort(),
    warehouseOptions,
  }
}

export async function getStocksSummary(wbAccountId: string): Promise<StocksSummary> {
  return (await buildStocksData(wbAccountId)).summary
}

export async function getPaginatedStocks(options: GetStocksOptions): Promise<PaginatedStocks> {
  const {
    wbAccountId,
    page,
    pageSize,
    search,
    brand,
    category,
    warehouse,
    risk = 'all',
    sortBy = 'risk',
    sortDir = 'asc',
  } = options
  const data = await buildStocksData(wbAccountId)
  const query = search?.trim().toLowerCase()
  const useTotalStock = warehouse === TOTAL_STOCK_WAREHOUSE_VALUE
  const sourceRows = useTotalStock ? aggregateRowsByArticle(data.rows) : data.rows

  let rows = sourceRows.filter((row) => {
    if (query) {
      const haystack = [row.vendorCode, row.title, String(row.nmId)].join(' ').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (brand && row.brand !== brand) return false
    if (category && row.category !== category) return false
    if (warehouse && !useTotalStock && row.warehouseName !== warehouse) return false
    if (risk !== 'all' && row.risk !== risk) return false
    return true
  })

  rows = rows.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'risk') cmp = riskRank(a.risk) - riskRank(b.risk)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    else if (sortBy === 'stockValue') cmp = a.stockValue - b.stockValue
    else if (sortBy === 'nmId') cmp = a.nmId - b.nmId
    else cmp = String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'ru')
    return sortDir === 'desc' ? -cmp : cmp
  })

  const total = rows.length
  const skip = (page - 1) * pageSize

  return {
    ...data.summary,
    rows: rows.slice(skip, skip + pageSize),
    total,
    page,
    pageSize,
    brands: data.brands,
    categories: data.categories,
    warehouseOptions: data.warehouseOptions,
  }
}

function aggregateRowsByArticle(rows: StockSummaryItem[]): StockSummaryItem[] {
  const grouped = new Map<number, StockSummaryItem>()

  for (const row of rows) {
    const existing = grouped.get(row.nmId)
    if (!existing) {
      grouped.set(row.nmId, {
        ...row,
        warehouseName: TOTAL_STOCK_WAREHOUSE_LABEL,
      })
      continue
    }

    existing.quantity += row.quantity
    existing.inWayToClient += row.inWayToClient
    existing.inWayFromClient += row.inWayFromClient
    existing.stockValue += row.stockValue
  }

  return Array.from(grouped.values())
}
