import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchSalesPage } from '@/lib/wb-api/sales'
import type { SalesSyncResult } from '@/types/sales-plan'

/**
 * Syncs WB sales for an account starting from dateFrom.
 * Uses lastChangeDate pagination (statistics domain, 1 req/min).
 * createMany with skipDuplicates for idempotent re-syncs.
 */
export async function syncSales(
  wbAccountId: string,
  dateFrom: string,
): Promise<SalesSyncResult> {
  const startMs = Date.now()
  const result: SalesSyncResult = {
    totalRows: 0,
    upserted: 0,
    pages: 0,
    errors: 0,
    durationMs: 0,
  }

  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))

  let lastChangeDate: string | undefined = undefined

  while (true) {
    let rows
    try {
      rows = await fetchSalesPage(client, dateFrom, lastChangeDate)
    } catch {
      result.errors++
      break
    }

    result.pages++

    if (rows.length === 0) break

    result.totalRows += rows.length

    try {
      const mapped = rows.map((row) => ({
        wbAccountId,
        srid: row.srid,
        nmId: row.nmId,
        vendorCode: row.supplierArticle,
        date: new Date(row.date),
        lastChangeDate: new Date(row.lastChangeDate),
        priceWithDisc: row.priceWithDisc,
        forPay: row.forPay,
        isReturn: row.saleID.startsWith('R'),
      }))
      const { count } = await prisma.wbSale.createMany({
        data: mapped,
        skipDuplicates: true,
      })
      result.upserted += count
    } catch {
      result.errors++
    }

    lastChangeDate = rows[rows.length - 1].lastChangeDate
  }

  result.durationMs = Date.now() - startMs
  return result
}
