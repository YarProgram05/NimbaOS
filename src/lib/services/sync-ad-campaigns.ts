import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import {
  fetchAdvertList,
  fetchCampaignBudget,
} from '@/lib/wb-api/advertising'
import type { AdSyncResult } from '@/types/advertising'

/**
 * Syncs advertising campaigns for a WB account into the local DB.
 * Pulls campaign metadata from the advert API and stores the latest budget snapshot.
 */
export async function syncAdCampaigns(
  wbAccountId: string,
): Promise<AdSyncResult> {
  const startMs = Date.now()
  const result: AdSyncResult = {
    totalRows: 0,
    upserted: 0,
    errors: 0,
    durationMs: 0,
  }

  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))

  let adverts
  try {
    adverts = await fetchAdvertList(client)
  } catch {
    result.errors++
    result.durationMs = Date.now() - startMs
    return result
  }

  result.totalRows = adverts.length

  for (const advert of adverts) {
    try {
      let budget: number | null = null

      try {
        const budgetResponse = await fetchCampaignBudget(client, advert.id)
        budget = budgetResponse.total ?? null
      } catch {
        result.errors++
      }

      await prisma.adCampaign.upsert({
        where: {
          wbAccountId_advertId: {
            wbAccountId,
            advertId: advert.id,
          },
        },
        create: {
          wbAccountId,
          advertId: advert.id,
          name: advert.settings?.name?.trim() || `Кампания ${advert.id}`,
          status: advert.status,
          bidType: advert.bid_type ?? null,
          paymentType: advert.settings?.payment_type ?? null,
          placementSearch: advert.settings?.placements?.search ?? false,
          placementReco: advert.settings?.placements?.recommendations ?? false,
          budget,
        },
        update: {
          name: advert.settings?.name?.trim() || `Кампания ${advert.id}`,
          status: advert.status,
          bidType: advert.bid_type ?? null,
          paymentType: advert.settings?.payment_type ?? null,
          placementSearch: advert.settings?.placements?.search ?? false,
          placementReco: advert.settings?.placements?.recommendations ?? false,
          budget,
        },
      })

      result.upserted++
    } catch {
      result.errors++
    }
  }

  result.durationMs = Date.now() - startMs
  return result
}
