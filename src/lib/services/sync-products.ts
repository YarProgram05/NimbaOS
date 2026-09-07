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

  // 2. Paginate through all product cards (cursor-based).
  const syncedNmIds = await syncCatalogCards(wbAccountId, client, result, false)

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

/** Fresh size IDs for FBS discovery, without price API requests or false account freshness. */
export async function syncProductCatalog(wbAccountId: string, client: WbApiClient) {
  const startMs = Date.now()
  const result: SyncResult = { created: 0, updated: 0, priceRows: 0, errors: 0, durationMs: 0 }
  await syncCatalogCards(wbAccountId, client, result, true)
  result.durationMs = Date.now() - startMs
  return result
}

async function syncCatalogCards(
  wbAccountId: string,
  client: WbApiClient,
  result: SyncResult,
  strict: boolean,
) {
  let cursor: CardsCursor | undefined
  let hasMore = true
  const syncedNmIds = new Set<number>()
  const seenCursors = new Set<string>()
  while (hasMore) {
    let page
    try {
      page = await fetchCardsList(client, cursor)
    } catch (error) {
      if (strict || error instanceof WbRateLimitError) throw error
      result.errors++
      break
    }
    hasMore = page.hasMore
    if (!page.cards.length) break
    const lastCard = page.cards[page.cards.length - 1]
    cursor = { updatedAt: lastCard.updatedAt, nmID: lastCard.nmID }
    const cursorKey = JSON.stringify(cursor)
    if (seenCursors.has(cursorKey)) throw new Error('WB product catalog pagination did not advance')
    seenCursors.add(cursorKey)
    for (const card of page.cards) {
      try {
        await upsertCard(wbAccountId, card, result, !strict)
        syncedNmIds.add(card.nmID)
      } catch (error) {
        if (strict) throw error
        result.errors++
      }
    }
  }
  return syncedNmIds
}

async function upsertCard(
  wbAccountId: string,
  card: WbCard,
  result: SyncResult,
  fullRefresh: boolean,
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
          imtId:      card.imtID ? BigInt(card.imtID) : null,
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
          imtId:      card.imtID ? BigInt(card.imtID) : null,
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

    // Read sizes after the product write has serialized concurrent refreshes of this card.
    const existingSizes = await tx.productSize.findMany({
      where: { productId },
      orderBy: { id: 'asc' },
      select: {
        id: true, chrtId: true, barcode: true, techSize: true, wbSize: true,
        price: true, discount: true, spp: true,
      },
    })
    const existingPricesByBarcode = new Map(
      existingSizes.map((size) => [
        size.barcode,
        {
          price: size.price?.toString() ?? null,
          discount: size.discount,
          spp: size.spp?.toString() ?? null,
        },
      ]),
    )
    const existingPricesBySize = new Map(
      existingSizes.map((size) => [
        `${size.techSize.trim().toLowerCase()}|${(size.wbSize ?? '').trim().toLowerCase()}`,
        {
          price: size.price?.toString() ?? null,
          discount: size.discount,
          spp: size.spp?.toString() ?? null,
        },
      ]),
    )

    // Keep IDs for unchanged size/barcode pairs: FBS and KIZ rows reference these IDs.
    const retainedIds = new Set<string>()
    const incomingKeys = new Set<string>()
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
            // Content prices can lag the Prices API. A cards-only FBS refresh
            // must preserve the stored price, including a known empty price.
            price:    !fullRefresh && preserved ? preserved.price
              : s.price ? s.price / 100 : preserved?.price ?? null,
            discount: preserved?.discount ?? null,
            spp:      preserved?.spp ?? null,
          }
        }),
    )
    for (const data of sizeData) {
      const key = JSON.stringify([data.chrtId, data.barcode])
      if (incomingKeys.has(key)) continue
      incomingKeys.add(key)
      const previous = existingSizes.find((size) =>
        !retainedIds.has(size.id) && size.chrtId === data.chrtId && size.barcode === data.barcode,
      )
      const saved = previous
        ? await tx.productSize.update({ where: { id: previous.id }, data, select: { id: true } })
        : await tx.productSize.create({ data, select: { id: true } })
      retainedIds.add(saved.id)
    }
    await tx.productSize.deleteMany({ where: { productId, id: { notIn: Array.from(retainedIds) } } })

    // Replace materials
    if (fullRefresh) await tx.productMaterial.deleteMany({ where: { productId } })
    if (fullRefresh && compositions.length > 0) {
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
