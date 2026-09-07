export interface FbsSheetPendingMapping {
  key: string
  wbAccountId: string
  accountName: string
  nmId: number
  chrtId: number
  vendorCode: string | null
  barcode: string
  size: string | null
  wbStock: number
  suggestions: Array<{ productName: string; reason: string }>
}

export interface FbsSheetMappingReview {
  pending: FbsSheetPendingMapping[]
  groups: string[]
  warning: string | null
}

export interface ConfirmFbsSheetMappingInput {
  wbAccountId: string
  nmId: number
  chrtId: number
  productName: string
  mode: 'existing' | 'new'
}
