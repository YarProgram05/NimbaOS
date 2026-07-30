import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchRealizationReportPage, REALIZATION_REPORT_API } from '@/lib/wb-api/reports'
import type { WbRealizationRow, ReportSyncResult } from '@/types/reports'
import { prepareKizForStorage } from '@/lib/fbs/kiz'

/**
 * Synchronises realization report data for a WB account into the database.
 * Fetches all pages via rrdId cursor pagination (finance domain, 1 req/min throttle).
 * Uses createMany with skipDuplicates for idempotent re-syncs.
 */
export async function syncRealizationReport(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ReportSyncResult> {
  const startMs = Date.now()
  const result: ReportSyncResult = {
    sourceApi: REALIZATION_REPORT_API,
    totalRows: 0,
    upserted: 0,
    enriched: 0,
    pages: 0,
    errors: 0,
    durationMs: 0,
    storageUpserted: 0,
    storageErrors: 0,
    maxReportDate: null,
  }

  // 1. Fetch and decrypt the API key
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const apiKey = decrypt(account.apiKey)
  const client = new WbApiClient(apiKey)

  // 2. Paginate through all report pages (rrdId cursor)
  let rrdId = 0

  while (true) {
    let page
    try {
      page = await fetchRealizationReportPage(client, dateFrom, dateTo, rrdId)
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }

    result.pages++

    if (page.done || page.rows.length === 0) break

    result.totalRows += page.rows.length
    for (const row of page.rows) {
      const reportDate = getReportDate(row)
      if (reportDate && (!result.maxReportDate || reportDate > result.maxReportDate)) {
        result.maxReportDate = reportDate
      }
    }

    // 3. Map normalized API rows → camelCase Prisma fields and bulk insert
    try {
      const mapped = page.rows.map((row) => mapRowToPrisma(wbAccountId, row))
      const { count } = await prisma.realizationReport.createMany({
        data: mapped,
        skipDuplicates: true,
      })
      result.upserted += count
      const enrichmentRows = page.rows.filter((row) =>
        row.order_id ||
        row.order_uid ||
        row.delivery_method ||
        row.trbx_id ||
        row.is_b2b !== null ||
        row.kiz,
      )
      for (let index = 0; index < enrichmentRows.length; index += 200) {
        const batch = enrichmentRows.slice(index, index + 200)
        await prisma.$transaction(
          batch.map((row) =>
            prisma.realizationReport.updateMany({
              where: {
                wbAccountId,
                rrdId: BigInt(row.rrd_id),
              },
              data: mapEnrichment(row),
            }),
          ),
        )
        result.enriched += batch.length
      }
      for (const row of enrichmentRows) {
        await reconcileFinanceKiz(wbAccountId, row)
      }
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }

    // Advance cursor
    if (page.lastRrdId === null) break
    rrdId = page.lastRrdId
  }

  result.durationMs = Date.now() - startMs
  return result
}

// ── Internal helper ──────────────────────────────────────────────────────────

function getReportDate(row: WbRealizationRow): string | null {
  const value = row.rr_dt ?? row.sale_dt ?? row.date_to ?? row.date_from
  return value ? value.slice(0, 10) : null
}

function mapRowToPrisma(wbAccountId: string, row: WbRealizationRow) {
  const enrichment = mapEnrichment(row)
  return {
    wbAccountId,
    rrdId:                BigInt(row.rrd_id),
    realizationReportId:  BigInt(row.realizationreport_id),
    dateFrom:             new Date(row.date_from),
    dateTo:               new Date(row.date_to),
    nmId:                 row.nm_id,
    vendorCode:           row.vendor_code ?? '',
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
    ...enrichment,
    orderDt:              row.order_dt ? new Date(row.order_dt) : null,
    saleDt:               row.sale_dt ? new Date(row.sale_dt) : null,
    rrDt:                 row.rr_dt ? new Date(row.rr_dt) : null,
  }
}

function mapEnrichment(row: WbRealizationRow) {
  const preparedKiz = safePrepareKiz(row.kiz)
  return {
    orderId: row.order_id ? BigInt(row.order_id) : null,
    orderUid: row.order_uid,
    trbxId: row.trbx_id,
    deliveryMethod: row.delivery_method,
    isB2b: row.is_b2b,
    kizHash: preparedKiz?.codeHash ?? null,
    kizMasked: preparedKiz?.maskedCode ?? null,
    kizEncrypted: preparedKiz?.encryptedCode ?? null,
  }
}

function safePrepareKiz(value: string | null) {
  if (!value) return null
  try {
    return prepareKizForStorage(value)
  } catch {
    // A malformed value must not stop the financial report sync and must never
    // be echoed to logs. It remains discoverable through the missing hash.
    return null
  }
}

async function reconcileFinanceKiz(wbAccountId: string, row: WbRealizationRow) {
  if (!row.delivery_method?.toLowerCase().includes('fbs')) return
  const prepared = safePrepareKiz(row.kiz)
  if (!prepared) return

  await prisma.$transaction(async (tx) => {
    const order = row.order_id
      ? await tx.fbsOrder.findUnique({
          where: {
            wbAccountId_externalOrderId: {
              wbAccountId,
              externalOrderId: BigInt(row.order_id),
            },
          },
          select: { id: true, warehouseId: true, assortmentItemId: true },
        })
      : null
    const existing = await tx.kizUnit.findUnique({
      where: {
        wbAccountId_codeHash: {
          wbAccountId,
          codeHash: prepared.codeHash,
        },
      },
    })
    const isReturn = row.doc_type_name.toLowerCase().includes('возврат')
    const isSale = row.doc_type_name.toLowerCase().includes('продаж')
    const unit = existing
      ? await tx.kizUnit.update({
          where: { id: existing.id },
          data: {
            ...(existing.currentOrderId ? {} : { currentOrderId: order?.id ?? null }),
            ...(existing.warehouseId ? {} : { warehouseId: order?.warehouseId ?? null }),
            ...(existing.assortmentItemId
              ? {}
              : { assortmentItemId: order?.assortmentItemId ?? null }),
            ...(isReturn ? { physicalState: 'RETURN_EXPECTED' } : {}),
            ...(
              isSale &&
              !['WITHDRAWAL_REQUIRED', 'WITHDRAWN', 'RETURN_TO_CIRCULATION_REQUIRED'].includes(
                existing.circulationState,
              )
                ? { circulationState: 'WITHDRAWAL_REQUIRED' }
                : {}
            ),
          },
        })
      : await tx.kizUnit.create({
          data: {
            wbAccountId,
            warehouseId: order?.warehouseId ?? null,
            assortmentItemId: order?.assortmentItemId ?? null,
            currentOrderId: order?.id ?? null,
            encryptedCode: prepared.encryptedCode,
            codeHash: prepared.codeHash,
            maskedCode: prepared.maskedCode,
            gtin: prepared.parsed.gtin,
            serialMasked: prepared.serialMasked,
            physicalState: isReturn ? 'RETURN_EXPECTED' : 'HANDED_OVER',
            circulationState: isSale ? 'WITHDRAWAL_REQUIRED' : 'UNKNOWN',
          },
        })

    if (isSale) {
      const taskType = row.is_b2b ? 'WITHDRAWAL_B2B' : 'WITHDRAWAL_REMOTE_SALE'
      await tx.kizComplianceTask.upsert({
        where: {
          idempotencyKey: `finance:${row.rrd_id}:${taskType}`,
        },
        create: {
          wbAccountId,
          kizUnitId: unit.id,
          orderId: order?.id ?? null,
          type: taskType,
          idempotencyKey: `finance:${row.rrd_id}:${taskType}`,
          dueAt: row.sale_dt ? new Date(row.sale_dt) : new Date(),
        },
        update: {},
      })
    }

    const shouldRecordEvent =
      !existing ||
      (isReturn && existing.physicalState !== 'RETURN_EXPECTED') ||
      (
        isSale &&
        !['WITHDRAWAL_REQUIRED', 'WITHDRAWN'].includes(existing.circulationState)
      )
    if (shouldRecordEvent) {
      await tx.kizEvent.create({
        data: {
          kizUnitId: unit.id,
          orderId: order?.id ?? null,
          type: isReturn ? 'RETURN_EXPECTED' : 'SALE_DETECTED',
          details: { source: 'finance_report', rrdId: String(row.rrd_id) },
        },
      })
    }
  })
}
