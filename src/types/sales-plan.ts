// ── WB API response types (snake_case as returned by API) ──────

export interface WbOrderRow {
  date: string                   // ISO date of order
  lastChangeDate: string         // ISO datetime for pagination cursor
  supplierArticle: string        // vendorCode
  techSize: string
  barcode: string
  totalPrice: number
  discountPercent: number
  warehouseName: string
  oblast: string
  incomeID: number
  odid: number
  nmId: number
  subject: string
  category: string
  brand: string
  isCancel: boolean
  cancel_dt: string
  sticker: string
  gNumber: string
  srid: string
  orderType: string
  finishedPrice: number          // final price after discounts
  priceWithDisc: number
  isStorno: number
}

export interface WbSaleRow {
  date: string                   // ISO date of sale
  lastChangeDate: string         // ISO datetime for pagination cursor
  supplierArticle: string        // vendorCode
  techSize: string
  barcode: string
  totalPrice: number
  discountPercent: number
  isSupply: boolean
  isRealization: boolean
  promoCodeDiscount: number
  warehouseName: string
  countryName: string
  oblastOkrugName: string
  regionName: string
  incomeID: number
  saleID: string
  odid: number
  spp: number
  forPay: number
  finishedPrice: number
  priceWithDisc: number
  nmId: number
  subject: string
  category: string
  brand: string
  IsStorno: number
  gNumber: string
  sticker: string
  srid: string
}

// ── Internal types (camelCase) ──────────────────────────────────

export interface SalesPlanRow {
  id: string
  wbAccountId: string
  name: string
  description: string | null
  dateFrom: string          // ISO date
  dateTo: string            // ISO date
  drrPercent: string        // Decimal → string
  itemCount: number
  createdAt: string         // ISO datetime
  updatedAt: string         // ISO datetime
}

export interface SalesPlanItemRow {
  id: string
  nmId: number
  vendorCode: string
  plannedQty: number
  price: string             // Decimal → string
  buyoutPercent: string     // Decimal → string
  // Enriched from Products table
  photoUrl: string | null
  category: string | null
  title: string | null
  brandName: string | null
  // Enriched from WbSale (previous month stats)
  salesCount: number | null
}

export interface SalesPlanDetail {
  id: string
  wbAccountId: string
  name: string
  description: string | null
  dateFrom: string
  dateTo: string
  drrPercent: string
  createdAt: string
  updatedAt: string
  items: SalesPlanItemRow[]
}

// ── Input types ─────────────────────────────────────────────────

export interface SalesPlanCreateInput {
  wbAccountId: string
  name: string
  description?: string
  dateFrom: string          // YYYY-MM-DD
  dateTo: string            // YYYY-MM-DD
  drrPercent: number
}

export interface SalesPlanItemInput {
  nmId: number
  vendorCode: string
  plannedQty: number
  price: number
  buyoutPercent: number
}

export interface SalesPlanUpdateInput {
  name?: string
  description?: string
  dateFrom?: string
  dateTo?: string
  drrPercent?: number
}

export interface SalesPlanItemUpdateInput {
  plannedQty?: number
  price?: number
  buyoutPercent?: number
}

// ── WB Funnel API types (snake_case as returned by API) ─────────

export interface WbFunnelHistoryRequest {
  nmIds: number[]
  selectedPeriod: {
    start: string  // YYYY-MM-DD
    end: string    // YYYY-MM-DD
  }
  timezone: string // e.g. "Europe/Moscow"
  aggregationLevel: 'day'
}

export interface WbFunnelHistoryDay {
  dt: string            // YYYY-MM-DD
  openCardCount: number // Переходы (открытия карточки)
  addToCartCount: number
  addToCartConversion: number  // decimal, e.g. 0.1234
  cartCount: number
  cartToOrderConversion: number
  ordersCount: number
  ordersSumRub: number
}

export interface WbFunnelHistoryCard {
  nmID: number
  history: WbFunnelHistoryDay[]
}

export interface WbFunnelHistoryResponse {
  data: WbFunnelHistoryCard[]
  error: boolean
  errorText: string
  additionalErrors: unknown
}

// ── Sync results ────────────────────────────────────────────────

export interface OrdersSyncResult {
  totalRows: number
  upserted: number
  pages: number
  errors: number
  durationMs: number
}

export interface SalesSyncResult {
  totalRows: number
  upserted: number
  pages: number
  errors: number
  durationMs: number
}

export interface FunnelSyncResult {
  totalRows: number
  upserted: number
  errors: number
  durationMs: number
}

export interface PlanSyncResult {
  orders: OrdersSyncResult
  sales: SalesSyncResult
  funnel: FunnelSyncResult
}

// ── Daily metrics (calculated, for detail grid) ─────────────────

export interface DailyMetrics {
  date: string              // YYYY-MM-DD
  revenueOrders: string     // Σ finishedPrice (orders)
  ordersCount: number       // count orders
  revenueSales: string      // Σ priceWithDisc (sales)
  boughtQty: number         // count sales (not returns)
  avgPrice: string          // revenueSales / boughtQty
  // Funnel metrics (from WbFunnelStat)
  visits: number            // openCardCount (переходы)
  cartPercent: string       // addToCartConversion (корзина %)
  cartQty: number           // cartCount (корзина шт.)
  orderPercent: string      // cartToOrderConversion (заказ %)
}

export interface ArticleSummary {
  planMonth: number         // plannedQty from plan
  factMonth: number         // total boughtQty for period
  planDay: string           // planMonth / days in period
  factDay: string           // factMonth / days elapsed
  revenueOrdersTotal: string
  revenueSalesTotal: string
  ordersCountTotal: number
}

export interface ArticleDetailData {
  nmId: number
  vendorCode: string
  photoUrl: string | null
  category: string | null
  plannedQty: number
  price: string
  buyoutPercent: string
  summary: ArticleSummary
  dailyBreakdown: DailyMetrics[]
}

export interface PlanMetricsData {
  planId: string
  dateFrom: string
  dateTo: string
  articles: ArticleDetailData[]
}
