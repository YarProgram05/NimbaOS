export type FbsSupplierStatus = 'new' | 'confirm' | 'complete' | 'cancel' | string
export type FbsWbStatus =
  | 'waiting'
  | 'sorted'
  | 'sold'
  | 'canceled'
  | 'canceled_by_client'
  | 'declined_by_client'
  | 'defect'
  | 'ready_for_pickup'
  | string

export interface WbFbsWarehouse {
  id: number
  name: string
  officeId?: number | null
  deliveryType?: string | null
  cargoType?: string | null
}

export interface WbFbsOrder {
  id: number
  rid?: string | null
  orderUid?: string | null
  warehouseId?: number | null
  nmId: number
  chrtId: number
  skus?: string[]
  article?: string | null
  createdAt: string
  deliveryDate?: string | null
  price?: number | null
  convertedPrice?: number | null
  currencyCode?: number | null
  isB2b?: boolean | null
  options?: {
    isB2b?: boolean | null
  } | null
  supplyId?: string | null
  requiredMeta?: string[] | Record<string, unknown> | null
  optionalMeta?: string[] | Record<string, unknown> | null
}

export interface WbFbsOrderStatus {
  id: number
  supplierStatus?: string | null
  wbStatus?: string | null
}

export interface WbFbsOrderMeta {
  id?: number
  orderId?: number
  meta?: Record<string, unknown> | null
  requiredMeta?: string[] | Record<string, unknown> | null
  optionalMeta?: string[] | Record<string, unknown> | null
}

export interface WbFbsSupply {
  id: string
  name?: string | null
  done?: boolean | null
  isB2b?: boolean | null
  cargoType?: string | number | null
  crossBorderType?: string | number | null
  createdAt?: string | null
  closedAt?: string | null
  warehouseId?: number | null
}

export interface WbFbsStock {
  chrtId: number
  amount: number
}

export interface WbFbsSticker {
  orderId: number
  partA?: string
  partB?: string
  barcode?: string
  file: string
}

export interface KizParsedCode {
  normalized: string
  gtin: string | null
  serial: string | null
  verificationKey: string | null
  cryptoSignature: string | null
}

export interface FbsWorkspaceData {
  account: { id: string; name: string }
  generatedAt: string
  permissions: {
    canOperate: boolean
    canViewFullKiz: boolean
    canEnableWbWrites: boolean
  }
  metrics: {
    onHand: number
    reserved: number
    available: number
    wbStock: number
    stockMismatch: number
    openOrders: number
    overdueOrders: number
    openComplianceTasks: number
    quarantinedKiz: number
    fbsRevenue: string
    fbsSales: number
    fbsReturns: number
  }
  warehouses: Array<{
    id: string
    externalId: string
    name: string
    writeEnabled: boolean
    onHand: number
    reserved: number
    available: number
    wbStock: number
  }>
  supplies: Array<{
    id: string
    externalId: string
    name: string | null
    done: boolean
    isB2b: boolean
    warehouseName: string | null
    orderCount: number
  }>
  catalogCandidates: Array<{
    productSizeId: string
    nmId: number
    chrtId: number
    barcode: string
    vendorCode: string
    size: string
  }>
  assortment: Array<{
    id: string
    warehouseId: string
    warehouseName: string
    nmId: number
    chrtId: number
    barcode: string
    vendorCode: string | null
    requiresKiz: boolean
    markingGtin: string | null
    onHand: number
    reserved: number
    available: number
    wbStock: number
  }>
  orders: Array<{
    id: string
    externalOrderId: string
    createdAtWb: string
    vendorCode: string | null
    barcode: string
    warehouseName: string | null
    supplyExternalId: string | null
    supplierStatus: string
    wbStatus: string
    requiresKiz: boolean
    kizMasked: string | null
    metadataReady: boolean
    metadataLabel: string
    metadataIssue: string | null
    isB2b: boolean
  }>
  kizUnits: Array<{
    id: string
    maskedCode: string
    gtin: string | null
    serialMasked: string | null
    physicalState: string
    circulationState: string
    wbValidationStatus: string | null
    warehouseName: string | null
    vendorCode: string | null
    externalOrderId: string | null
    lastScannedAt: string | null
  }>
  complianceTasks: Array<{
    id: string
    type: string
    status: string
    dueAt: string | null
    maskedCode: string
    externalOrderId: string | null
    documentNumber: string | null
  }>
  recentActions: Array<{
    id: string
    kind: string
    status: string
    error: string | null
    createdAt: string
  }>
  financeByArticle: Array<{
    nmId: number
    vendorCode: string
    sales: number
    returns: number
    revenue: string
  }>
}
