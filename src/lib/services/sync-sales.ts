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

  // Incremental sync: if we already have data in this date range,
  // start from the latest known lastChangeDate (flag=1) instead of full re-fetch (flag=0).
  const lastKnown = await prisma.wbSale.aggregate({
    where: { wbAccountId, date: { gte: new Date(dateFrom) } },
    _max: { lastChangeDate: true },
  })

  let lastChangeDate: string | undefined = lastKnown._max.lastChangeDate
    ? lastKnown._max.lastChangeDate.toISOString()
    : undefined

  async function createSales(rows: Awaited<ReturnType<typeof fetchSalesPage>>) {
    const mappedBase = rows.map((row) => ({
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

    try {
      return await prisma.wbSale.createMany({
        data: mappedBase.map((row, index) => ({
          ...row,
          finishedPrice: rows[index].finishedPrice,
        })),
        skipDuplicates: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('finishedPrice')) throw error

      return prisma.wbSale.createMany({
        data: mappedBase,
        skipDuplicates: true,
      })
    }
  }

  while (true) {
    let rows
    try {
      rows = await fetchSalesPage(client, dateFrom, lastChangeDate)
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }

    result.pages++

    if (rows.length === 0) break

    result.totalRows += rows.length

    try {
      const { count } = await createSales(rows)
      result.upserted += count
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }

    const nextLastChangeDate = rows[rows.length - 1].lastChangeDate
    if (lastChangeDate && new Date(nextLastChangeDate) <= new Date(lastChangeDate)) {
      break
    }
    lastChangeDate = nextLastChangeDate
  }

  result.durationMs = Date.now() - startMs
  return result
}
