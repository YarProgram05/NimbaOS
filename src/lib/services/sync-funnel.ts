import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchFunnelHistory } from '@/lib/wb-api/analytics'
import type { FunnelSyncResult } from '@/types/sales-plan'

/**
 * Syncs WB funnel stats for specific nmIds within a date range.
 * Uses upsert to handle re-syncs (update existing rows).
 * Analytics domain — 3 req/min (throttled by WbApiClient).
 */
export async function syncFunnel(
  wbAccountId: string,
  nmIds: number[],
  dateFrom: string,
  dateTo: string,
): Promise<FunnelSyncResult> {
  const startMs = Date.now()
  const result: FunnelSyncResult = {
    totalRows: 0,
    upserted: 0,
    errors: 0,
    durationMs: 0,
  }

  if (nmIds.length === 0) {
    result.durationMs = Date.now() - startMs
    return result
  }

  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))

  let cards
  try {
    cards = await fetchFunnelHistory(client, nmIds, dateFrom, dateTo)
  } catch (error) {
    result.errors++
    result.durationMs = Date.now() - startMs
    throw error
  }

  // Flatten cards → individual day rows and upsert
  for (const card of cards) {
    for (const day of card.history) {
      result.totalRows++
      try {
        await prisma.wbFunnelStat.upsert({
          where: {
            wbAccountId_nmId_date: {
              wbAccountId,
              nmId: card.nmID,
              date: new Date(day.dt),
            },
          },
          create: {
            wbAccountId,
            nmId: card.nmID,
            date: new Date(day.dt),
            openCount: day.openCardCount,
            addToCartCount: day.addToCartCount,
            addToCartConversion: day.addToCartConversion,
            cartCount: day.cartCount,
            cartToOrderConversion: day.cartToOrderConversion,
            ordersCount: day.ordersCount,
            ordersSumRub: day.ordersSumRub,
          },
          update: {
            openCount: day.openCardCount,
            addToCartCount: day.addToCartCount,
            addToCartConversion: day.addToCartConversion,
            cartCount: day.cartCount,
            cartToOrderConversion: day.cartToOrderConversion,
            ordersCount: day.ordersCount,
            ordersSumRub: day.ordersSumRub,
            fetchedAt: new Date(),
          },
        })
        result.upserted++
      } catch (error) {
        result.errors++
        result.durationMs = Date.now() - startMs
        throw error
      }
    }
  }

  result.durationMs = Date.now() - startMs
  return result
}
