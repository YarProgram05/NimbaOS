// ── WB API — Cards response shapes ────────────────────────────────────────────

export interface WbCardPhoto {
  big: string
  c246x328: string
}

export interface WbCardSize {
  techSize: string
  wbSize: string
  skus: string[]         // barcodes
  price: number          // in kopecks
  discountedPrice: number
  clubDiscountedPrice: number
}

export interface WbCardCharacteristic {
  id: number
  name: string
  value: string[]
}

export interface WbCard {
  nmID: number           // capital D — maps to Product.nmId
  imtID: number
  nmUUID: string
  subjectID: number
  subjectName: string
  vendorCode: string
  brand: string
  title: string
  photos: WbCardPhoto[]
  video: string
  sizes: WbCardSize[]
  characteristics: WbCardCharacteristic[]
  tags: { id: number; name: string }[]
  createdAt: string
  updatedAt: string
}

export interface WbCardsCursor {
  updatedAt: string
  nmID: number
  total: number
}

// ⚠️ Verify after first test: WB may return { cards, cursor } directly
// or wrapped in { data: { cards, cursor } }. Adjust if needed.
export interface WbCardsListResponse {
  cards: WbCard[]
  cursor: WbCardsCursor
}

// ── WB API — Prices response shapes ────────────────────────────────────────────

export interface WbGoodSizePrice {
  sizeID: number
  price: number          // in roubles (prices API v2 returns roubles, not kopecks)
  discountedPrice: number
  techSizeName: string
}

export interface WbGoodsItem {
  nmID: number
  vendorCode: string
  discount: number
  editableSizePrice: boolean
  sizes: WbGoodSizePrice[]
}

export interface WbPricesResponse {
  data: {
    listGoods: WbGoodsItem[]
  }
}

// ── Sync service ────────────────────────────────────────────────────────────────

export interface SyncResult {
  created: number
  updated: number
  priceRows: number
  errors: number
  durationMs: number
}

// ── Server Action / Page types ──────────────────────────────────────────────────

/** Flattened product row for the /cards table */
export interface ProductRow {
  id: string
  nmId: number
  vendorCode: string
  vendorCodeLocal: string | null
  brand: string | null
  category: string | null
  title: string | null
  photoUrl: string | null
  /** Base price (seller's set price, before discount). Decimal serialised as string. */
  basePrice: string | null
  /** Seller's selling price = basePrice * (1 − discount/100). Decimal serialised as string. */
  price: string | null
  /** Seller discount % */
  discount: number | null
  /** SPP-discounted price from ProductSize.spp (null until realization reports are synced). */
  sppPrice: string | null
}

export interface PriceUpdateItem {
  nmID: number
  price: number     // base price in roubles
  discount: number  // seller discount % (0–95)
}

export interface GetProductsOptions {
  wbAccountId: string
  page: number
  pageSize: number
  search?: string
  brand?: string
  category?: string
  sortBy?: 'nmId' | 'vendorCode' | 'brand' | 'category' | 'price'
  sortDir?: 'asc' | 'desc'
}

export interface PaginatedProducts {
  rows: ProductRow[]
  total: number
  page: number
  pageSize: number
  brands: string[]
  categories: string[]
  /** ISO timestamp of last sync for the account (for "Актуально на" label). */
  lastSyncAt: string | null
}
