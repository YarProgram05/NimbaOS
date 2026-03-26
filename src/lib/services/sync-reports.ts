import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchRealizationReportPage } from '@/lib/wb-api/reports'
import type { WbRealizationRow, ReportSyncResult } from '@/types/reports'

/**
 * Synchronises realization report data for a WB account into the database.
 * Fetches all pages via rrdid cursor pagination (statistics domain, 1 req/min throttle).
 * Uses createMany with skipDuplicates for idempotent re-syncs.
 */
export async function syncRealizationReport(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ReportSyncResult> {
  const startMs = Date.now()
  const result: ReportSyncResult = {
    totalRows: 0,
    upserted: 0,
    pages: 0,
    errors: 0,
    durationMs: 0,
  }

  // 1. Fetch and decrypt the API key
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const apiKey = decrypt(account.apiKey)
  const client = new WbApiClient(apiKey)

  // 2. Paginate through all report pages (rrdid cursor)
  let rrdid: number | undefined = undefined

  while (true) {
    let page
    try {
      page = await fetchRealizationReportPage(client, dateFrom, dateTo, rrdid)
    } catch {
      result.errors++
      break
    }

    result.pages++

    if (page.done || page.rows.length === 0) break

    result.totalRows += page.rows.length

    // 3. Map snake_case API rows → camelCase Prisma fields and bulk insert
    try {
      const mapped = page.rows.map((row) => mapRowToPrisma(wbAccountId, row))
      const { count } = await prisma.realizationReport.createMany({
        data: mapped,
        skipDuplicates: true,
      })
      result.upserted += count
    } catch {
      result.errors++
    }

    // Advance cursor
    rrdid = page.lastRrdId ?? undefined
    if (rrdid === undefined) break
  }

  result.durationMs = Date.now() - startMs
  return result
}

// ── Internal helper ──────────────────────────────────────────────────────────

function mapRowToPrisma(wbAccountId: string, row: WbRealizationRow) {
  return {
    wbAccountId,
    rrdId:                BigInt(row.rrd_id),
    realizationReportId:  row.realizationreport_id,
    dateFrom:             new Date(row.date_from),
    dateTo:               new Date(row.date_to),
    nmId:                 row.nm_id,
    vendorCode:           row.vendor_code,
    barcode:              row.barcode ?? null,
    docTypeName:          row.doc_type_name,
    quantity:             row.quantity,
    retailPrice:          row.retail_price,
    retailPriceWithDisc:  row.retail_price_withdisc_rub,
    ppvzForPay:           row.ppvz_for_pay,
    ppvzSppPrc:           row.ppvz_spp_prc,
    deliveryRub:          row.delivery_rub,
    penalty:              row.penalty,
    additionalPayment:    row.additional_payment,
    storageFee:           row.storage_fee,
    deduction:            row.deduction,
    acceptance:           row.acceptance,
    acquiringFee:         row.acquiring_fee,
    commissionPercent:    row.commission_percent,
    ppvzSalesCommission:  row.ppvz_sales_commission,
    salePercent:          row.sale_percent,
    bonusTypeName:        row.bonus_type_name ?? null,
    srid:                 row.srid ?? null,
    subjectName:          row.subject_name ?? null,
    brandName:            row.brand_name ?? null,
    officeName:           row.office_name ?? null,
    supplierOperName:     row.supplier_oper_name ?? null,
    orderDt:              row.order_dt ? new Date(row.order_dt) : null,
    saleDt:               row.sale_dt ? new Date(row.sale_dt) : null,
    rrDt:                 row.rr_dt ? new Date(row.rr_dt) : null,
  }
}
