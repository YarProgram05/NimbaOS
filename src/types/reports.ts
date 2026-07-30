// ── WB API — Realization report normalized internal row ──────────────────────

export type WbMoneyValue = number | string

export interface WbRealizationRow {
  rrd_id: number
  realizationreport_id: number
  date_from: string
  date_to: string
  nm_id: number
  vendor_code: string
  barcode: string | null
  doc_type_name: string              // "Продажа" | "Возврат" | ""
  quantity: number
  retail_price: WbMoneyValue
  retail_price_withdisc_rub: WbMoneyValue
  ppvz_for_pay: WbMoneyValue
  ppvz_spp_prc: WbMoneyValue
  delivery_rub: WbMoneyValue
  penalty: WbMoneyValue
  additional_payment: WbMoneyValue
  storage_fee: WbMoneyValue
  deduction: WbMoneyValue
  acceptance: WbMoneyValue
  acquiring_fee: WbMoneyValue
  commission_percent: number
  ppvz_sales_commission: WbMoneyValue
  sale_percent: number
  bonus_type_name: string | null
  srid: string | null
  subject_name: string | null
  brand_name: string | null
  office_name: string | null
  supplier_oper_name: string | null
  order_id: string | null
  order_uid: string | null
  kiz: string | null
  is_b2b: boolean | null
  trbx_id: string | null
  delivery_method: string | null
  order_dt: string | null
  sale_dt: string | null
  rr_dt: string | null
}

// ── WB Finance API — POST /api/finance/v1/sales-reports/detailed ─────────────

export interface WbFinanceRealizationRow {
  reportId: number
  dateFrom: string
  dateTo: string
  rrdId: number
  subjectName?: string | null
  nmId: number
  brandName?: string | null
  vendorCode?: string | null
  sku?: string | null
  docTypeName?: string | null
  quantity?: number
  retailPrice?: string | number
  salePercent?: number
  commissionPercent?: number
  officeName?: string | null
  sellerOperName?: string | null
  orderDt?: string | null
  saleDt?: string | null
  rrDate?: string | null
  retailPriceWithDisc?: string | number
  deliveryService?: string | number
  spp?: string | number
  ppvzSalesCommission?: string | number
  forPay?: string | number
  acquiringFee?: string | number
  bonusTypeName?: string | null
  penalty?: string | number
  additionalPayment?: string | number
  paidStorage?: string | number
  deduction?: string | number
  paidAcceptance?: string | number
  srid?: string | null
  orderId?: number | string | null
  orderUid?: string | null
  kiz?: string | null
  isB2b?: boolean | null
  trbxId?: string | null
  deliveryMethod?: string | null
}

// ── WB API — Paid storage responses (analytics domain, task-based flow) ──────

export interface WbPaidStorageTaskResponse {
  data: {
    taskId: string
  }
}

export interface WbPaidStorageTaskStatusResponse {
  data: {
    id: string
    status: string
  }
}

export interface WbPaidStorageRow {
  date: string                // "YYYY-MM-DD"
  logWarehouseCoef?: number | null
  officeId?: number | null
  warehouse?: string | null
  warehouseCoef?: number | null
  giId?: number | null
  chrtId: number
  size?: string | null
  barcode?: string | null
  subject?: string | null
  brand?: string | null
  vendorCode?: string | null
  nmId: number
  volume?: number | null
  calcType?: string | null
  warehousePrice: number      // storage cost from the generated report row
  barcodesCount?: number | null
  palletPlaceCode?: number | null
  palletCount?: number | null
  originalDate?: string | null
  loyaltyDiscount?: number | null
  tariffFixDate?: string | null
  tariffLowerDate?: string | null
}

export interface PaidStorageSyncResult {
  totalRows: number
  upserted: number
  pages: number
  errors: number
  durationMs: number
}

// ── Sync service result ──────────────────────────────────────────────────────

export interface ReportSyncResult {
  sourceApi: {
    domain: 'finance'
    method: 'POST'
    path: '/api/finance/v1/sales-reports/detailed'
  }
  totalRows: number
  upserted: number
  enriched: number
  pages: number
  errors: number
  durationMs: number
  storageUpserted: number
  storageErrors: number
  maxReportDate: string | null
}

// ── Calculated report row (52 columns) ───────────────────────────────────────
// All Decimal fields serialized as string across Server Action boundary.

export interface ReportRow {
  // Identity (frozen columns)
  nmId: number                       // Col 1  — Артикул ВБ
  subjectName: string                // Col 2  — Категория
  vendorCode: string                 // Col 3  — Артикул поставщика (с учётом переименования)
  brandName: string                  // Col 36 — Бренд
  photoUrl: string | null            // Фото товара из таблицы Products (для тултипа)
  sizeLabel?: string | null
  isSizeRow?: boolean
  parentNmId?: number | null
  parentVendorCode?: string | null
  sizeRows?: ReportRow[]

  // Sales summary
  orderedRub: string                 // — Заказано руб. из всех wb_orders.finishedPrice
  sale: string                       // Col 4  — Продажа
  toTransfer: string                 // Col 5  — К перечислению
  totalToPay: string                 // Col 6  — Итого к оплате
  operatingProfit: string            // Col 7  — ОП
  operatingProfitUnit: string        // Col 8  — ОП ед.
  operatingProfitShare: string       // Col 9  — % от всей ОП
  avgPrice: string                   // Col 10 — Цена ср.

  // Quantities
  boughtWithReturns: number          // Col 11 — Выкуплено с учётом возврата
  buyoutPercent: string              // Col 12 — Выкуп %
  boughtWithoutReturns: number       // Col 38 — Выкуплено без учёта возврата
  returns: number                    // Col 37 — Возвраты (кол-во)

  // Margins
  marginality: string                // Col 13 — Маржинальность
  rentability: string                // Col 14 — Рентабельность

  // Advertising
  adBalance: string                  // Col 15 — Реклама (баланс)
  adAll: string                      // Col 16 — Реклама (все)
  drr: string                        // Col 17 — ДРР %
  romi: string                       // — ROMI = (ОП + Реклама все) / Реклама все × 100

  // Logistics
  logistics: string                  // Col 18 — Логистика
  logisticsUnit: string              // Col 19 — Логистика ед.
  delivered: number                  // Col 20 — Доставлено
  logisticsFromSalesPercent: string  // Col 21 — Логистика от продаж %

  // References
  externalAd: string                 // Col 22 — Внешняя реклама
  selfPurchaseCost: string           // Col 23 — Себестоимость самовыкупов
  cashbackDistributions: string      // Col 24 — Кэшбек раздач
  selfPurchaseAmount: string         // Col 25 — Сумма самовыкупов

  // Storage & fees
  storageFromSalesPercent: string    // Col 26 — Хранение от продаж %
  costPrice: string                  // Col 27 — Себестоимость
  storageFee: string                 // Col 28 — Хранение
  acceptance: string                 // Col 29 — Приёмка
  additionalPayment: string          // Col 30 — Доплаты
  penalty: string                    // Col 31 — Штрафы
  taxes: string                      // Col 32 — Налоги
  commission: string                 // Col 33 — Комиссия
  selfPurchases: string              // Col 34 — Самовыкупы, раздачи
  acquiringFee: string               // Col 35 — Эквайринг

  // Cancellations
  cancellations: number              // Col 39 — Отмены (bonusTypeName="К клиенту при отмене")

  // Detailed breakdowns
  salesReturnsNoSpp: string          // Col 40 — Продажи-возвраты без СПП
  salesWithSpp: string               // Col 41 — Продажи с СПП
  returnsWithSpp: string             // Col 42 — Возвраты с СПП
  salesNoSpp: string                 // Col 43 — Продажи без СПП
  returnsNoSpp: string               // Col 44 — Возвраты без СПП
  commissionOnSale: string           // Col 45 — Комиссия при продаже
  commissionOnReturn: string         // Col 46 — Комиссия при возврате
  deductions: string                 // Col 47 — Прочие удержания/выплаты
  salesToTransfer: string            // Col 48 — Продажи к перечислению
  returnsToTransfer: string          // Col 49 — Возвраты к перечислению
  acquiringOnSale: string            // Col 50 — Эквайринг при продаже
  tags: string                       // Col 51 — Ярлыки
  acquiringOnReturn: string          // Col 52 — Эквайринг при возврате
}

// ── Report data wrapper for the page ─────────────────────────────────────────

export interface ReportData {
  rows: ReportRow[]
  summary: ReportRow
  dateFrom: string
  dateTo: string
  lastSyncAt: string | null
  coverage: {
    isCovered: boolean
    syncedAt: string | null
  }
}

// ── Column group definitions for show/hide ───────────────────────────────────

export type ColumnGroupId =
  | 'identity'
  | 'sales'
  | 'quantities'
  | 'margins'
  | 'advertising'
  | 'logistics'
  | 'references'
  | 'fees'
  | 'detailed'

export interface ColumnGroup {
  id: ColumnGroupId
  label: string
  columnIds: string[]
  defaultVisible: boolean
}
