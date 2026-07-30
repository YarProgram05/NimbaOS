import type { WbApiClient } from './client'
import type {
  WbFinanceRealizationRow,
  WbMoneyValue,
  WbRealizationRow,
} from '@/types/reports'

export interface RealizationReportPage {
  rows: WbRealizationRow[]
  lastRrdId: number | null
  done: boolean
}

export const REALIZATION_REPORT_API = {
  domain: 'finance',
  method: 'POST',
  path: '/api/finance/v1/sales-reports/detailed',
} as const

const REALIZATION_REPORT_FIELDS = [
  'reportId',
  'dateFrom',
  'dateTo',
  'rrdId',
  'subjectName',
  'nmId',
  'brandName',
  'vendorCode',
  'sku',
  'docTypeName',
  'quantity',
  'retailPrice',
  'salePercent',
  'commissionPercent',
  'officeName',
  'sellerOperName',
  'orderDt',
  'saleDt',
  'rrDate',
  'retailPriceWithDisc',
  'deliveryService',
  'spp',
  'ppvzSalesCommission',
  'forPay',
  'acquiringFee',
  'bonusTypeName',
  'penalty',
  'additionalPayment',
  'paidStorage',
  'deduction',
  'paidAcceptance',
  'srid',
  'orderId',
  'orderUid',
  'kiz',
  'isB2b',
  'trbxId',
  'deliveryMethod',
]

/**
 * Fetches a single page of the realization report.
 * POST /api/finance/v1/sales-reports/detailed — finance domain (60 000 ms rate limit).
 *
 * Pagination: pass rrdId (the last rrdId from the previous page) to advance.
 * Stop when the response is 204 (null) or an empty array.
 */
export async function fetchRealizationReportPage(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
  rrdId = 0,
): Promise<RealizationReportPage> {
  const financeRows = await client.post<WbFinanceRealizationRow[] | null>(
    REALIZATION_REPORT_API.domain,
    REALIZATION_REPORT_API.path,
    {
      dateFrom,
      dateTo,
      period: 'daily',
      limit: 100_000,
      rrdId,
      fields: REALIZATION_REPORT_FIELDS,
    },
  )

  if (!financeRows || financeRows.length === 0) {
    return { rows: [], lastRrdId: null, done: true }
  }

  const rows = financeRows.map(normalizeFinanceRow)

  return {
    rows,
    lastRrdId: rows[rows.length - 1].rrd_id,
    done: false,
  }
}

function normalizeFinanceRow(row: WbFinanceRealizationRow): WbRealizationRow {
  return {
    rrd_id: requiredNumber(row.rrdId, 'rrdId'),
    realizationreport_id: requiredNumber(row.reportId, 'reportId'),
    date_from: requiredString(row.dateFrom, 'dateFrom'),
    date_to: requiredString(row.dateTo, 'dateTo'),
    nm_id: requiredNumber(row.nmId, 'nmId'),
    vendor_code: row.vendorCode ?? '',
    barcode: row.sku ?? null,
    doc_type_name: row.docTypeName ?? '',
    quantity: row.quantity ?? 0,
    retail_price: money(row.retailPrice),
    retail_price_withdisc_rub: money(row.retailPriceWithDisc),
    ppvz_for_pay: money(row.forPay),
    ppvz_spp_prc: money(row.spp),
    delivery_rub: money(row.deliveryService),
    penalty: money(row.penalty),
    additional_payment: money(row.additionalPayment),
    storage_fee: money(row.paidStorage),
    deduction: money(row.deduction),
    acceptance: money(row.paidAcceptance),
    acquiring_fee: money(row.acquiringFee),
    commission_percent: row.commissionPercent ?? 0,
    ppvz_sales_commission: money(row.ppvzSalesCommission),
    sale_percent: row.salePercent ?? 0,
    bonus_type_name: row.bonusTypeName ?? null,
    srid: row.srid ?? null,
    subject_name: row.subjectName ?? null,
    brand_name: row.brandName ?? null,
    office_name: row.officeName ?? null,
    supplier_oper_name: row.sellerOperName ?? null,
    order_id: row.orderId == null ? null : String(row.orderId),
    order_uid: row.orderUid ?? null,
    kiz: row.kiz ?? null,
    is_b2b: row.isB2b ?? null,
    trbx_id: row.trbxId ?? null,
    delivery_method: row.deliveryMethod ?? null,
    order_dt: row.orderDt ?? null,
    sale_dt: row.saleDt ?? null,
    rr_dt: row.rrDate ?? null,
  }
}

function money(value: WbMoneyValue | null | undefined): WbMoneyValue {
  return value ?? 0
}

function requiredNumber(value: number | null | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`WB Finance API realization report row is missing numeric field "${field}"`)
  }
  return value
}

function requiredString(value: string | null | undefined, field: string): string {
  if (!value) {
    throw new Error(`WB Finance API realization report row is missing string field "${field}"`)
  }
  return value
}
