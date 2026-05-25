export type StockRisk = 'out_of_stock' | 'low_stock' | 'overstock' | 'ok' | 'no_sales'

export const TOTAL_STOCK_WAREHOUSE_VALUE = '__total__'

export interface WbWarehouseStockItem {
  nmId: number
  chrtId: number
  warehouseId: number
  warehouseName: string
  regionName: string
  quantity: number
  inWayToClient: number
  inWayFromClient: number
}

export interface WbWarehouseStocksResponse {
  data?: {
    items?: WbWarehouseStockItem[]
  }
}

export interface StockSyncResult {
  totalRows: number
  upserted: number
  warehouses: number
  snapshots: number
  pages: number
  errors: number
  durationMs: number
  syncedAt: string
}

export interface StockSummaryItem {
  nmId: number
  vendorCode: string
  sizeLabel?: string | null
  isSizeRow?: boolean
  parentVendorCode?: string | null
  sizeRows?: StockSummaryItem[]
  brand: string | null
  category: string | null
  title: string | null
  photoUrl: string | null
  warehouseName: string
  quantity: number
  inWayToClient: number
  inWayFromClient: number
  stockValue: number
  daysUntilZero: number | null
  turnoverDays: number | null
  risk: StockRisk
  syncedAt: string
}

export interface StockWarehouseSummary {
  warehouseId: number
  warehouseName: string
  regionName: string | null
  quantity: number
  inWayToClient: number
  inWayFromClient: number
  stockValue: number
}

export interface StocksSummary {
  status: 'ready' | 'missing'
  syncedAt: string | null
  totalUnits: number
  stockValue: number
  inWayToClient: number
  inWayFromClient: number
  lowStockCount: number
  outOfStockCount: number
  overstockCount: number
  productsWithSalesNoStock: number
  productsWithStockNoSales: number
  items: StockSummaryItem[]
  warehouses: StockWarehouseSummary[]
}

export interface GetStocksOptions {
  wbAccountId: string
  page: number
  pageSize: number
  search?: string
  brand?: string
  category?: string
  warehouse?: string
  risk?: StockRisk | 'all'
  sortBy?: 'vendorCode' | 'nmId' | 'brand' | 'category' | 'quantity' | 'stockValue' | 'turnoverDays' | 'risk'
  sortDir?: 'asc' | 'desc'
}

export interface PaginatedStocks extends StocksSummary {
  rows: StockSummaryItem[]
  total: number
  page: number
  pageSize: number
  brands: string[]
  categories: string[]
  warehouseOptions: StockWarehouseSummary[]
}
