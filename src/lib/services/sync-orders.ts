import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchOrdersPage } from '@/lib/wb-api/orders'
import type { OrdersSyncResult } from '@/types/sales-plan'

interface SyncOrdersOptions {
  dateTo?: string
  forceFullFetch?: boolean
}

/**
 * Syncs WB orders for an account starting from dateFrom.
 * Uses lastChangeDate pagination (statistics domain, 1 req/min).
 * Upserts rows because WB can later change the same order, including cancellation state.
 */
export async function syncOrders(
  wbAccountId: string,
  dateFrom: string,
  options: SyncOrdersOptions = {},
): Promise<OrdersSyncResult> {
  const startMs = Date.now()
  const result: OrdersSyncResult = {
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

  let lastChangeDate: string | undefined
  if (!options.forceFullFetch) {
    // Incremental sync: if we already have data in this date range,
    // start from the latest known lastChangeDate (flag=1) instead of full re-fetch (flag=0).
    const lastKnown = await prisma.wbOrder.aggregate({
      where: {
        wbAccountId,
        date: {
          gte: new Date(dateFrom),
          ...(options.dateTo ? { lte: new Date(options.dateTo) } : {}),
        },
      },
      _max: { lastChangeDate: true },
    })

    lastChangeDate = lastKnown._max.lastChangeDate
      ? lastKnown._max.lastChangeDate.toISOString()
      : undefined
  }

  while (true) {
    let rows
    try {
      rows = await fetchOrdersPage(client, dateFrom, lastChangeDate)
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }

    result.pages++

    if (rows.length === 0) break

    result.totalRows += rows.length

    try {
      const mapped = rows
        .filter((row) => {
          const orderDate = row.date.slice(0, 10)
          return orderDate >= dateFrom && (!options.dateTo || orderDate <= options.dateTo)
        })
        .map((row) => ({
          wbAccountId,
          srid: row.srid,
          nmId: row.nmId,
          vendorCode: row.supplierArticle,
          date: new Date(row.date),
          lastChangeDate: new Date(row.lastChangeDate),
          finishedPrice: row.finishedPrice,
          isCancel: row.isCancel,
          regionName: row.oblast ?? null,
          warehouseName: row.warehouseName ?? null,
          fetchedAt: new Date(),
        }))

      for (let i = 0; i < mapped.length; i += 100) {
        const chunk = mapped.slice(i, i + 100)
        await prisma.$transaction(
          chunk.map((row) =>
            prisma.wbOrder.upsert({
              where: {
                wbAccountId_srid: {
                  wbAccountId,
                  srid: row.srid,
                },
              },
              create: row,
              update: {
                nmId: row.nmId,
                vendorCode: row.vendorCode,
                date: row.date,
                lastChangeDate: row.lastChangeDate,
                finishedPrice: row.finishedPrice,
                isCancel: row.isCancel,
                regionName: row.regionName,
                warehouseName: row.warehouseName,
                fetchedAt: row.fetchedAt,
              },
            }),
          ),
        )
        result.upserted += chunk.length
      }
    } catch (error) {
      result.errors++
      result.durationMs = Date.now() - startMs
      throw error
    }

    // Advance cursor: use lastChangeDate of the last row.
    // If WB returns the cursor row again, stop to avoid an endless retry loop.
    const nextLastChangeDate = rows[rows.length - 1].lastChangeDate
    if (lastChangeDate && new Date(nextLastChangeDate) <= new Date(lastChangeDate)) {
      break
    }
    lastChangeDate = nextLastChangeDate
  }

  result.durationMs = Date.now() - startMs
  return result
}
