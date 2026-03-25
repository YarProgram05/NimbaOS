import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchCardsList, fetchPrices, type CardsCursor } from '@/lib/wb-api/products'
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

  while (hasMore) {
    let page
    try {
      page = await fetchCardsList(client, cursor)
    } catch {
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
      } catch {
        result.errors++
      }
    }
  }

  // 3. Fetch all prices and update sizes (offset-based)
  let offset = 0

  while (true) {
    let goods: WbGoodsItem[]
    try {
      goods = await fetchPrices(client, offset)
    } catch {
      result.errors++
      break
    }

    if (goods.length === 0) break

    for (const good of goods) {
      try {
        await updatePrices(wbAccountId, good, result)
      } catch {
        result.errors++
      }
    }

    offset += goods.length
    if (goods.length < 1000) break
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
      select: { id: true },
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

    // Replace sizes atomically (delete + recreate handles added/removed sizes between syncs)
    await tx.productSize.deleteMany({ where: { productId } })
    if (card.sizes.length > 0) {
      const sizeData = card.sizes.flatMap((s) =>
        s.skus.map((barcode) => ({
          productId,
          techSize: s.techSize,
          wbSize:   s.wbSize || null,
          barcode,
          // WB cards API price is in kopecks; convert to roubles
          price:    s.price ? s.price / 100 : null,
          discount: null as null,
          spp:      null as null,
        })),
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
    select: {
      id: true,
      sizes: { select: { id: true, techSize: true } },
    },
  })

  if (!product) return  // Card not yet in DB (edge case)

  for (const sizePrice of good.sizes) {
    const dbSize = product.sizes.find((s) => s.techSize === sizePrice.techSizeName)
    if (!dbSize) continue

    await prisma.productSize.update({
      where: { id: dbSize.id },
      data: {
        price:    sizePrice.price,               // base price in roubles (before seller discount)
        discount: good.discount ?? null,
        spp:      sizePrice.discountedPrice ?? null, // seller's actual selling price (after discount)
      },
    })
    result.priceRows++
  }
}
