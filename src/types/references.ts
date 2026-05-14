// Row types for all 4 reference models.
// All Decimal fields serialized as string across Server Action boundary.
// @db.Date fields serialized as "YYYY-MM-DD" string.

export interface CostPriceRow {
  id: string
  wbAccountId: string
  vendorCode: string
  costPrice: string       // Decimal → string
  updatedAt: string       // ISO datetime string
}

/** Merged view: all products joined with their cost price (if set). */
export interface CostPriceItem {
  id: string | null
  wbAccountId: string
  vendorCode: string
  nmId: number | null
  category: string | null
  photoUrl: string | null
  title: string | null
  costPrice: string | null    // null if not yet set
  updatedAt: string | null    // null if not yet set
}

export interface SelfPurchaseRow {
  id: string
  wbAccountId: string
  vendorCode: string
  date: string            // "YYYY-MM-DD"
  quantity: number
  amount: string          // Decimal → string
  cashback: string | null // Decimal | null → string | null
  note: string | null
  createdAt: string       // ISO datetime string
}

export interface ExternalAdRow {
  id: string
  wbAccountId: string
  vendorCode: string | null
  date: string            // "YYYY-MM-DD"
  amount: string          // Decimal → string
  source: string | null
  note: string | null
  createdAt: string       // ISO datetime string
}

export interface ArticleOverrideRow {
  id: string
  wbAccountId: string
  vendorCode: string
  localName: string | null
  localColor: string | null
  localSize: string | null
  localComposition: string | null
}

export interface VendorCodeOption {
  vendorCode: string
  title: string | null
}

export interface ReplyTemplateRow {
  id: string
  groupId: string
  title: string
  text: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ReplyTemplateGroupRow {
  id: string
  wbAccountId: string
  name: string
  sortOrder: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
  templates: ReplyTemplateRow[]
}
