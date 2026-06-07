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

const LOW_STOCK_DAYS = 14
const OVERSTOCK_DAYS = 120
const OVERSTOCK_MIN_QTY = 10
const SALES_WINDOW_DAYS = 30
const TOTAL_STOCK_WAREHOUSE_LABEL = 'Общий остаток'
const DOC_SALE = 'Продажа'

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

function startOfDay(value: Date): Date {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

type StockRiskCalculation = {
  risk: StockRisk
  daysUntilZero: number | null
  turnoverDays: number | null
}

function salesKey(nmId: number, barcode: string | null | undefined): string {
  return `${nmId}:${(barcode ?? '').trim()}`
}

function calculateRisk(quantity: number, sales30: number): StockRiskCalculation {
  if (quantity <= 0) {
    return { risk: 'out_of_stock', daysUntilZero: 0, turnoverDays: 0 }
  }

  if (sales30 > 0) {
    const dailySales = sales30 / SALES_WINDOW_DAYS
    const turnoverDays = quantity / dailySales
    if (turnoverDays <= LOW_STOCK_DAYS) return { risk: 'low_stock', daysUntilZero: turnoverDays, turnoverDays }
    if (turnoverDays > OVERSTOCK_DAYS && quantity >= OVERSTOCK_MIN_QTY) return { risk: 'overstock', daysUntilZero: turnoverDays, turnoverDays }
    return { risk: 'ok', daysUntilZero: turnoverDays, turnoverDays }
  }

  return { risk: 'no_sales', daysUntilZero: null, turnoverDays: null }
}

function getSizeRisk(
  nmId: number,
  barcode: string | null | undefined,
  riskBySize: Map<string, StockRiskCalculation>,
  fallback: StockRiskCalculation,
): StockRiskCalculation {
  return barcode ? riskBySize.get(salesKey(nmId, barcode)) ?? fallback : fallback
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

  const salesTo = addDays(startOfDay(snapshot.syncedAt), -1)
  const salesFrom = addDays(salesTo, -(SALES_WINDOW_DAYS - 1))
  const [products, stockItems, costPrices, salesRows, reportSalesRows] = await Promise.all([
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
      include: {
        warehouse: true,
        productSize: {
          select: { techSize: true, wbSize: true, barcode: true, chrtId: true },
        },
      },
    }),
    prisma.costPrice.findMany({
      where: { wbAccountId },
      select: { vendorCode: true, costPrice: true },
    }),
    prisma.wbSale.groupBy({
      by: ['nmId'],
      where: {
        wbAccountId,
        isReturn: false,
        date: { gte: salesFrom, lte: salesTo },
      },
      _count: { _all: true },
    }),
    prisma.realizationReport.groupBy({
      by: ['nmId', 'barcode'],
      where: {
        wbAccountId,
        docTypeName: DOC_SALE,
        AND: [
          {
            OR: [
              { rrDt: { gte: salesFrom, lte: salesTo } },
              { rrDt: null, dateFrom: { lte: salesTo }, dateTo: { gte: salesFrom } },
            ],
          },
        ],
      },
      _sum: { quantity: true },
    }),
  ])

  const productByNmId = new Map(products.map((product) => [product.nmId, product]))
  const costByVendor = new Map(costPrices.map((row) => [row.vendorCode, Number(row.costPrice)]))
  const salesByNmId = new Map<number, number>()
  for (const sale of salesRows) {
    salesByNmId.set(sale.nmId, sale._count._all)
  }
  const reportSalesByNmId = new Map<number, number>()
  const reportSalesBySize = new Map<string, number>()
  for (const sale of reportSalesRows) {
    const quantity = sale._sum.quantity ?? 0
    reportSalesByNmId.set(sale.nmId, (reportSalesByNmId.get(sale.nmId) ?? 0) + quantity)
    if (sale.barcode) {
      const key = salesKey(sale.nmId, sale.barcode)
      reportSalesBySize.set(key, (reportSalesBySize.get(key) ?? 0) + quantity)
    }
  }

  const totalsByNmId = new Map<number, { quantity: number; inWayToClient: number; inWayFromClient: number }>()
  const totalsBySize = new Map<string, { quantity: number; inWayToClient: number; inWayFromClient: number }>()
  const byWarehouse = new Map<number, StockWarehouseSummary>()

  for (const item of stockItems) {
    const current = totalsByNmId.get(item.nmId) ?? { quantity: 0, inWayToClient: 0, inWayFromClient: 0 }
    current.quantity += item.quantity
    current.inWayToClient += item.inWayToClient
    current.inWayFromClient += item.inWayFromClient
    totalsByNmId.set(item.nmId, current)

    if (item.productSize?.barcode) {
      const key = salesKey(item.nmId, item.productSize.barcode)
      const sizeTotal = totalsBySize.get(key) ?? { quantity: 0, inWayToClient: 0, inWayFromClient: 0 }
      sizeTotal.quantity += item.quantity
      sizeTotal.inWayToClient += item.inWayToClient
      sizeTotal.inWayFromClient += item.inWayFromClient
      totalsBySize.set(key, sizeTotal)
    }

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

  const riskByNmId = new Map<number, StockRiskCalculation>()
  const riskBySize = new Map<string, StockRiskCalculation>()
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
    const sales30 = Math.max(salesByNmId.get(product.nmId) ?? 0, reportSalesByNmId.get(product.nmId) ?? 0)
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

  for (const [key, total] of Array.from(totalsBySize.entries())) {
    const sales30 = reportSalesBySize.get(key) ?? 0
    riskBySize.set(key, calculateRisk(total.quantity, sales30))
  }

  const rowGroups = new Map<string, {
    nmId: number
    warehouseName: string
    quantity: number
    inWayToClient: number
    inWayFromClient: number
  }>()
  const sizeRowGroups = new Map<string, {
    parentKey: string
    nmId: number
    warehouseName: string
    sizeLabel: string
    barcode: string | null
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

    if (item.productSize) {
      const label = getSizeLabel(item.productSize.techSize, item.productSize.wbSize)
      const sizeKey = `${key}:${item.productSize.barcode || item.productSize.chrtId || label}`
      const sizeGroup = sizeRowGroups.get(sizeKey) ?? {
        parentKey: key,
        nmId: item.nmId,
        warehouseName: item.warehouse.name,
        sizeLabel: label,
        barcode: item.productSize.barcode,
        quantity: 0,
        inWayToClient: 0,
        inWayFromClient: 0,
      }
      sizeGroup.quantity += item.quantity
      sizeGroup.inWayToClient += item.inWayToClient
      sizeGroup.inWayFromClient += item.inWayFromClient
      sizeRowGroups.set(sizeKey, sizeGroup)
    }
  }

  const rows: StockSummaryItem[] = Array.from(rowGroups.entries()).map(([key, item]) => {
    const product = productByNmId.get(item.nmId)
    const totalRisk = riskByNmId.get(item.nmId) ?? { risk: 'ok' as StockRisk, daysUntilZero: null, turnoverDays: null }
    const costPrice = product ? costByVendor.get(product.vendorCode) ?? 0 : 0
    const sizeRows = Array.from(sizeRowGroups.values())
      .filter((sizeGroup) => sizeGroup.parentKey === key)
      .sort((a, b) => a.sizeLabel.localeCompare(b.sizeLabel, 'ru', { numeric: true }))
      .map((sizeGroup) => {
        const sizeRisk = getSizeRisk(sizeGroup.nmId, sizeGroup.barcode, riskBySize, totalRisk)

        return {
          nmId: sizeGroup.nmId,
          vendorCode: formatSizedVendorCode(product?.vendorCode ?? String(item.nmId), sizeGroup.sizeLabel),
          sizeLabel: sizeGroup.sizeLabel,
          isSizeRow: true,
          parentVendorCode: product?.vendorCode ?? String(item.nmId),
          brand: product?.brand ?? null,
          category: product?.category ?? null,
          title: product?.title ?? null,
          photoUrl: product?.photoUrl ?? null,
          warehouseName: sizeGroup.warehouseName,
          quantity: sizeGroup.quantity,
          inWayToClient: sizeGroup.inWayToClient,
          inWayFromClient: sizeGroup.inWayFromClient,
          stockValue: sizeGroup.quantity * costPrice,
          daysUntilZero: sizeRisk.daysUntilZero,
          turnoverDays: sizeRisk.turnoverDays,
          risk: sizeRisk.risk,
          syncedAt: snapshot.syncedAt.toISOString(),
        }
      })

    return {
      nmId: item.nmId,
      vendorCode: product?.vendorCode ?? String(item.nmId),
      sizeLabel: null,
      isSizeRow: false,
      parentVendorCode: null,
      sizeRows: sizeRows.length > 1 ? sizeRows : undefined,
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
      turnoverDays: totalRisk.turnoverDays,
      risk: totalRisk.risk,
      syncedAt: snapshot.syncedAt.toISOString(),
    }
  })

  for (const product of products) {
    const total = totalsByNmId.get(product.nmId)
    if (total && (total.quantity > 0 || total.inWayToClient > 0 || total.inWayFromClient > 0)) continue

    const totalRisk = riskByNmId.get(product.nmId) ?? { risk: 'out_of_stock' as StockRisk, daysUntilZero: 0, turnoverDays: 0 }
    rows.push({
      nmId: product.nmId,
      vendorCode: product.vendorCode,
      sizeLabel: null,
      isSizeRow: false,
      parentVendorCode: null,
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
      turnoverDays: totalRisk.turnoverDays,
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
    categories,
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
    if (categories?.length && (!row.category || !categories.includes(row.category))) return false
    if (warehouse && !useTotalStock && row.warehouseName !== warehouse) return false
    if (risk !== 'all' && row.risk !== risk) return false
    return true
  })

  rows = rows.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'risk') cmp = riskRank(a.risk) - riskRank(b.risk)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    else if (sortBy === 'stockValue') cmp = a.stockValue - b.stockValue
    else if (sortBy === 'turnoverDays') cmp = compareNullableNumber(a.turnoverDays, b.turnoverDays)
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

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}

function aggregateRowsByArticle(rows: StockSummaryItem[]): StockSummaryItem[] {
  const grouped = new Map<number, StockSummaryItem>()
  const groupedSizeRows = new Map<number, Map<string, StockSummaryItem>>()

  for (const row of rows) {
    const existing = grouped.get(row.nmId)
    if (!existing) {
      grouped.set(row.nmId, {
        ...row,
        warehouseName: TOTAL_STOCK_WAREHOUSE_LABEL,
        sizeRows: undefined,
      })
    } else {
      existing.quantity += row.quantity
      existing.inWayToClient += row.inWayToClient
      existing.inWayFromClient += row.inWayFromClient
      existing.stockValue += row.stockValue
    }

    for (const sizeRow of row.sizeRows ?? []) {
      const key = sizeRow.sizeLabel ?? sizeRow.vendorCode
      const sizeMap = groupedSizeRows.get(row.nmId) ?? new Map<string, StockSummaryItem>()
      const existingSize = sizeMap.get(key)
      if (!existingSize) {
        sizeMap.set(key, {
          ...sizeRow,
          warehouseName: TOTAL_STOCK_WAREHOUSE_LABEL,
        })
      } else {
        existingSize.quantity += sizeRow.quantity
        existingSize.inWayToClient += sizeRow.inWayToClient
        existingSize.inWayFromClient += sizeRow.inWayFromClient
        existingSize.stockValue += sizeRow.stockValue
      }
      groupedSizeRows.set(row.nmId, sizeMap)
    }
  }

  for (const row of Array.from(grouped.values())) {
    const sizeRows = Array.from(groupedSizeRows.get(row.nmId)?.values() ?? [])
      .sort((a, b) => (a.sizeLabel ?? '').localeCompare(b.sizeLabel ?? '', 'ru', { numeric: true }))
    row.sizeRows = sizeRows.length > 1 ? sizeRows : undefined
  }

  return Array.from(grouped.values())
}

function getSizeLabel(techSize: string | null | undefined, wbSize: string | null | undefined): string {
  const wb = (wbSize ?? '').trim()
  const tech = (techSize ?? '').trim()
  return tech || wb || 'без размера'
}

function formatSizedVendorCode(vendorCode: string, label: string): string {
  const base = vendorCode.trim()
  const suffix = label.trim()
  if (!suffix) return base
  return base ? `${base} ${suffix}` : suffix
}
