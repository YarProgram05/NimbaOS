import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient, WbRateLimitError } from '@/lib/wb-api/client'
import { fetchCardsList, fetchPricesByNmId, fetchPricesByNmIds, type CardsCursor } from '@/lib/wb-api/products'
import type { WbCard, WbGoodsItem, SyncResult } from '@/types/products'

/**
 * Synchronises all product cards and prices for a WB account into the database.
 * Fetches every page of cards (cursor-based) then every page of prices (offset-based).
 * Each card is upserted in its own transaction so a single failure never aborts the whole sync.
 */
export async function syncProducts(wbAccountId: string): Promise<SyncResult> {
  const startMs = Date.now()
  const result: SyncResult = { created: 0, updated: 0, priceRows: 0, errors: 0, durationMs: 0 }

  // 1. Fetch and decrypt the API key
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const apiKey = decrypt(account.apiKey)
  const client = new WbApiClient(apiKey)

  // 2. Paginate through all product cards (cursor-based)
  let cursor: CardsCursor | undefined = undefined
  let hasMore = true
  const syncedNmIds = new Set<number>()

  while (hasMore) {
    let page
    try {
      page = await fetchCardsList(client, cursor)
    } catch (error) {
      if (error instanceof WbRateLimitError) throw error
      result.errors++
      break
    }

    hasMore = page.hasMore
    if (page.cards.length === 0) break

    // Advance cursor to the last card of this page
    const lastCard = page.cards[page.cards.length - 1]
    cursor = { updatedAt: lastCard.updatedAt, nmID: lastCard.nmID }

    // Upsert each card (independent transactions)
    for (const card of page.cards) {
      try {
        await upsertCard(wbAccountId, card, result)
        syncedNmIds.add(card.nmID)
      } catch {
        result.errors++
      }
    }
  }

  // 3. Fetch prices for exactly the local catalogue.
  // WB's full price-list pagination can skip cards in some seller cabinets;
  // the nmList endpoint is deterministic for the cards we just synced.
  const nmIds = Array.from(syncedNmIds)
  const pricedNmIds = new Set<number>()
  for (let index = 0; index < nmIds.length; index += 1000) {
    let goods: WbGoodsItem[] = []
    try {
      goods = await fetchPricesByNmIds(client, nmIds.slice(index, index + 1000))
    } catch (error) {
      if (error instanceof WbRateLimitError) throw error
      result.errors++
    }

    for (const good of goods) {
      try {
        await updatePrices(wbAccountId, good, result)
        pricedNmIds.add(good.nmID)
      } catch {
        result.errors++
      }
    }
  }

  // WB can omit some articles from the batch price response even though cards exist.
  // Fetch missing prices one-by-one so visible card prices are not left blank.
  for (const nmId of nmIds) {
    if (pricedNmIds.has(nmId)) continue

    try {
      const good = await fetchPricesByNmId(client, nmId)
      if (!good) continue

      await updatePrices(wbAccountId, good, result)
      pricedNmIds.add(good.nmID)
    } catch (error) {
      if (error instanceof WbRateLimitError) throw error
      result.errors++
    }
  }

  // 4. Stamp lastSyncAt
  await prisma.wbAccount.update({
    where: { id: wbAccountId },
    data: { lastSyncAt: new Date() },
  })

  result.durationMs = Date.now() - startMs
  return result
}

// ── Internal helpers ────────────────────────────────────────────────────────────

async function upsertCard(
  wbAccountId: string,
  card: WbCard,
  result: SyncResult,
): Promise<void> {
  const photoUrl = card.photos?.[0]?.big ?? null

  // Extract material compositions from characteristics
  const materialChar = card.characteristics.find(
    (c) => c.name === 'Состав' || c.name === 'Материал',
  )
  const compositions = materialChar?.value ?? []

  await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { wbAccountId_nmId: { wbAccountId, nmId: card.nmID } },
      select: {
        id: true,
        sizes: {
          select: {
            barcode: true,
            techSize: true,
            wbSize: true,
            price: true,
            discount: true,
            spp: true,
          },
        },
      },
    })

    let productId: string

    if (existing) {
      await tx.product.update({
        where: { id: existing.id },
        data: {
          vendorCode: card.vendorCode,
          brand:      card.brand    ?? null,
          category:   card.subjectName ?? null,
          subjectId:  card.subjectID ?? null,
          title:      card.title    ?? null,
          photoUrl,
        },
      })
      productId = existing.id
      result.updated++
    } else {
      const created = await tx.product.create({
        data: {
          wbAccountId,
          nmId:       card.nmID,
          vendorCode: card.vendorCode,
          brand:      card.brand    ?? null,
          category:   card.subjectName ?? null,
          subjectId:  card.subjectID ?? null,
          title:      card.title    ?? null,
          photoUrl,
        },
      })
      productId = created.id
      result.created++
    }

    const existingPricesByBarcode = new Map(
      (existing?.sizes ?? []).map((size) => [
        size.barcode,
        {
          price: size.price?.toString() ?? null,
          discount: size.discount,
          spp: size.spp?.toString() ?? null,
        },
      ]),
    )
    const existingPricesBySize = new Map(
      (existing?.sizes ?? []).map((size) => [
        `${size.techSize.trim().toLowerCase()}|${(size.wbSize ?? '').trim().toLowerCase()}`,
        {
          price: size.price?.toString() ?? null,
          discount: size.discount,
          spp: size.spp?.toString() ?? null,
        },
      ]),
    )

    // Replace sizes atomically, but preserve previous prices until the price API refreshes them.
    await tx.productSize.deleteMany({ where: { productId } })
    if (card.sizes.length > 0) {
      const sizeData = card.sizes.flatMap((s) =>
        s.skus.map((barcode) => {
          const preserved =
            existingPricesByBarcode.get(barcode) ??
            existingPricesBySize.get(`${s.techSize.trim().toLowerCase()}|${(s.wbSize || '').trim().toLowerCase()}`)

          return {
            productId,
            chrtId: s.chrtID ?? s.sizeID ?? null,
            techSize: s.techSize,
            wbSize:   s.wbSize || null,
            barcode,
            // WB cards API price is in kopecks; convert to roubles.
            // If the cards response has no price, keep the last known price.
            price:    s.price ? s.price / 100 : preserved?.price ?? null,
            discount: preserved?.discount ?? null,
            spp:      preserved?.spp ?? null,
          }
        }),
      )
      await tx.productSize.createMany({ data: sizeData })
    }

    // Replace materials
    await tx.productMaterial.deleteMany({ where: { productId } })
    if (compositions.length > 0) {
      await tx.productMaterial.createMany({
        data: compositions.map((comp) => ({
          productId,
          composition:      comp,
          compositionLocal: null,
        })),
      })
    }
  })
}

async function updatePrices(
  wbAccountId: string,
  good: WbGoodsItem,
  result: SyncResult,
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { wbAccountId_nmId: { wbAccountId, nmId: good.nmID } },
    select: { id: true, sizes: { select: { id: true, chrtId: true, techSize: true, wbSize: true } } },
  })

  if (!product) return  // Card not yet in DB (edge case)

  const normalizeSize = (value: string | null | undefined) =>
    (value ?? '').trim().toLowerCase()
  const fallbackSingleSize = product.sizes.length === 1 ? product.sizes[0] : null
  const singleApiPrice = good.sizes.length === 1 ? good.sizes[0] : null

  if (singleApiPrice) {
    await prisma.productSize.updateMany({
      where: { productId: product.id },
      data: {
        price: singleApiPrice.price > 0 ? singleApiPrice.price : null,
        discount: good.discount ?? null,
        spp: singleApiPrice.discountedPrice && singleApiPrice.discountedPrice > 0
          ? singleApiPrice.discountedPrice
          : null,
      },
    })
    result.priceRows += product.sizes.length
    return
  }

  for (const sizePrice of good.sizes) {
    const apiSizeName = normalizeSize(sizePrice.techSizeName)
    const dbSize =
      product.sizes.find((s) => s.chrtId === sizePrice.sizeID) ??
      product.sizes.find((s) => normalizeSize(s.techSize) === apiSizeName) ??
      product.sizes.find((s) => normalizeSize(s.wbSize) === apiSizeName) ??
      product.sizes.find((s) => normalizeSize(s.techSize) === '0' && apiSizeName === '') ??
      fallbackSingleSize

    if (!dbSize) continue

    await prisma.productSize.update({
      where: { id: dbSize.id },
      data: {
        price:    sizePrice.price > 0 ? sizePrice.price : null,
        discount: good.discount ?? null,
        spp:      sizePrice.discountedPrice && sizePrice.discountedPrice > 0
          ? sizePrice.discountedPrice
          : null,
      },
    })
    result.priceRows++
  }
}
