export interface FbsCatalogSize {
  id: string
  productId: string
  chrtId: number | null
  barcode: string
  product: { nmId: number; vendorCode: string }
}

export interface FbsExistingAssortment {
  chrtId: number
  nmId: number
  barcode: string
  productSizeId: string | null
}

/** A WB size can have several barcodes; the inventory identity is warehouse + chrtId. */
export function groupFbsCatalogSizes(sizes: FbsCatalogSize[]) {
  const result = new Map<number, FbsCatalogSize[]>()
  for (const size of sizes) {
    if (size.chrtId == null || !Number.isSafeInteger(size.chrtId) || size.chrtId <= 0) continue
    const group = result.get(size.chrtId) ?? []
    if (group.some((other) => other.product.nmId !== size.product.nmId)) {
      throw new Error(`FBS catalog chrtId ${size.chrtId} belongs to multiple nmIds`)
    }
    group.push(size)
    result.set(size.chrtId, group)
  }
  return result
}

export function selectFbsCatalogSize(
  sizes: FbsCatalogSize[],
  identity: { nmId?: number; barcode?: string | null; productSizeId?: string | null } = {},
) {
  const candidates = sizes.filter((size) => identity.nmId == null || size.product.nmId === identity.nmId)
  const compare = (left: FbsCatalogSize, right: FbsCatalogSize) =>
    Number(!left.barcode.trim()) - Number(!right.barcode.trim())
    || left.barcode.localeCompare(right.barcode, 'en')
    || left.id.localeCompare(right.id, 'en')
  const matchingBarcode = identity.barcode
    ? candidates.filter((size) => size.barcode === identity.barcode)
    : []
  return matchingBarcode.find((size) => size.id === identity.productSizeId)
    ?? matchingBarcode.sort(compare)[0]
    ?? candidates.sort(compare)[0]
    ?? null
}

export function buildFbsStockUpserts(input: {
  wbAccountId: string
  warehouseId: string
  catalog: Map<number, FbsCatalogSize[]>
  existing: FbsExistingAssortment[]
  stocks: Array<{ chrtId: number; amount: number }>
  syncedAt: Date
}) {
  const existingByChrtId = new Map(input.existing.map((item) => [item.chrtId, item]))
  const amounts = new Map<number, number>()
  for (const stock of input.stocks) {
    if (!Number.isSafeInteger(stock.chrtId) || stock.chrtId <= 0
      || !Number.isSafeInteger(stock.amount) || stock.amount < 0) {
      throw new Error('WB API returned an invalid FBS stock row')
    }
    if (amounts.has(stock.chrtId) && amounts.get(stock.chrtId) !== stock.amount) {
      throw new Error(`WB API returned conflicting FBS stocks for chrtId ${stock.chrtId}`)
    }
    amounts.set(stock.chrtId, stock.amount)
  }

  const chrtIds = new Set([...Array.from(input.catalog.keys()), ...Array.from(existingByChrtId.keys())])
  return Array.from(chrtIds).sort((left, right) => left - right).flatMap((chrtId) => {
    const existing = existingByChrtId.get(chrtId)
    const sizes = input.catalog.get(chrtId) ?? []
    if (existing && sizes.some((size) => size.product.nmId !== existing.nmId)) {
      throw new Error(`FBS assortment nmId conflicts with catalog for chrtId ${chrtId}`)
    }
    const catalog = selectFbsCatalogSize(sizes, existing)
    const amount = amounts.get(chrtId) ?? 0
    // A catalog card alone is not evidence that it is sold from this seller warehouse.
    if (!existing && (!catalog || amount <= 0)) return []

    const metadata = {
      productId: catalog?.productId,
      productSizeId: catalog?.id,
      nmId: catalog?.product.nmId,
      barcode: catalog?.barcode || existing?.barcode || '',
      vendorCode: catalog?.product.vendorCode,
    }
    return [{
      discovered: !existing,
      amount,
      args: {
        where: { warehouseId_chrtId: { warehouseId: input.warehouseId, chrtId } },
        create: {
          wbAccountId: input.wbAccountId,
          warehouseId: input.warehouseId,
          ...metadata,
          nmId: catalog?.product.nmId ?? existing!.nmId,
          chrtId,
          onHand: 0,
          reserved: 0,
          wbStock: amount,
          wbStockSyncedAt: input.syncedAt,
        },
        // A concurrent order sync may have created this row after our read. In that case
        // retain its identity metadata, as well as balances, marking and disabled settings.
        update: { ...(existing ? metadata : {}), wbStock: amount, wbStockSyncedAt: input.syncedAt },
      },
    }]
  })
}
