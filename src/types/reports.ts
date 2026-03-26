// ── WB API — Realization report response (snake_case as returned by API) ──────

export interface WbRealizationRow {
  rrd_id: number
  realizationreport_id: number
  date_from: string
  date_to: string
  nm_id: number
  vendor_code: string
  barcode: string | null
  doc_type_name: string              // "Продажа" | "Возврат"
  quantity: number
  retail_price: number
  retail_price_withdisc_rub: number
  ppvz_for_pay: number
  ppvz_spp_prc: number
  delivery_rub: number
  penalty: number
  additional_payment: number
  storage_fee: number
  deduction: number
  acceptance: number
  acquiring_fee: number
  commission_percent: number
  ppvz_sales_commission: number
  sale_percent: number
  bonus_type_name: string | null
  srid: string | null
  subject_name: string | null
  brand_name: string | null
  office_name: string | null
  supplier_oper_name: string | null
  order_dt: string | null
  sale_dt: string | null
  rr_dt: string | null
}

// ── Sync service result ──────────────────────────────────────────────────────

export interface ReportSyncResult {
  totalRows: number
  upserted: number
  pages: number
  errors: number
  durationMs: number
}

// ── Calculated report row (52 columns) ───────────────────────────────────────
// All Decimal fields serialized as string across Server Action boundary.

export interface ReportRow {
  // Identity (frozen columns)
  nmId: number                       // Col 1  — Артикул ВБ
  subjectName: string                // Col 2  — Категория
  vendorCode: string                 // Col 3  — Артикул поставщика (с учётом переименования)
  brandName: string                  // Col 36 — Бренд

  // Sales summary
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
  cancellations: number              // Col 39 — Отмены (0 до Phase 8)

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
