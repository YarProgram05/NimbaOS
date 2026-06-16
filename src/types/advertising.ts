export type AdStatus = -1 | 4 | 7 | 8 | 9 | 11

export type AdSource = 'search' | 'recommendations' | 'total'

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export type WbBidType = 'manual' | 'unified'

export type WbPaymentType = 'cpm' | 'cpc'

export type WbBidPlacement = 'combined' | 'search' | 'recommendations'

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  [-1]: 'Удалена',
  4: 'Готова',
  7: 'Завершена',
  8: 'Отклонена',
  9: 'Активна',
  11: 'Пауза',
}

export const AD_STATUS_VARIANT: Record<AdStatus, BadgeVariant> = {
  [-1]: 'destructive',
  4: 'outline',
  7: 'outline',
  8: 'destructive',
  9: 'default',
  11: 'secondary',
}

export const BID_TYPE_LABELS: Record<WbBidType, string> = {
  manual: 'Ручная',
  unified: 'Единая',
}

// WB API response types (snake_case / mixed casing as returned by WB methods)

export interface WbAdvertListItem {
  advertId?: number
  advert_id?: number
  name: string
  status: number
  type?: number
  advert_type?: number
  payment_type?: string | number
  bid_type?: string | number
  daily_budget?: number
  budget?: number
  search_pluse_state?: boolean
  auction_multibids?: boolean
  create_time?: string
  change_time?: string
  updated_at?: string
}

export interface WbAdvertInfoItem {
  id: number
  bid_type?: WbBidType
  status: number
  settings?: {
    name?: string
    payment_type?: WbPaymentType
    placements?: {
      search?: boolean
      recommendations?: boolean
    }
  }
  nm_settings?: Array<{
    nm_id: number
    subject?: {
      id?: number
      name?: string
    }
    bids_kopecks?: {
      search?: number
      recommendations?: number
    }
  }>
  timestamps?: {
    created?: string
    updated?: string
    started?: string | null
    deleted?: string | null
  }
}

export interface WbAdvertInfoResponse {
  adverts: WbAdvertInfoItem[]
}

export interface WbFullStatsMetricPoint {
  nmId?: number
  nm_id?: number
  name?: string
  views?: number
  clicks?: number
  ctr?: number
  cpc?: number
  spend?: number
  sum?: number
  sum_price?: number
  atbs?: number
  orders?: number
  canceled?: number
  cr?: number
  price?: number
  shks?: number
}

export interface WbFullStatsAppType {
  app_type?: number
  appType?: number
  views?: number
  clicks?: number
  ctr?: number
  cpc?: number
  spend?: number
  sum?: number
  sum_price?: number
  atbs?: number
  orders?: number
  canceled?: number
  cr?: number
  price?: number
  stats?: WbFullStatsMetricPoint[]
  nms?: WbFullStatsMetricPoint[]
}

export interface WbFullStatsDayItem {
  date: string
  views?: number
  clicks?: number
  ctr?: number
  cpc?: number
  spend?: number
  sum?: number
  sum_price?: number
  atbs?: number
  orders?: number
  canceled?: number
  price?: number
  nms?: WbFullStatsMetricPoint[]
  apps?: WbFullStatsAppType[]
  app_type_stats?: WbFullStatsAppType[]
  appTypeStats?: WbFullStatsAppType[]
}

export interface WbFullStatsCampaign {
  advertId?: number
  advert_id?: number
  views?: number
  clicks?: number
  ctr?: number
  cpc?: number
  spend?: number
  sum?: number
  sum_price?: number
  atbs?: number
  orders?: number
  canceled?: number
  status?: number
  price?: number
  date_from?: string
  date_to?: string
  days?: WbFullStatsDayItem[]
  daily_stats?: WbFullStatsDayItem[]
}

export type WbFullStatsResponse = WbFullStatsCampaign[]

export interface WbClusterStatsRequest {
  id: number
  from: string
  to: string
}

export interface WbClusterStatsPoint {
  norm_query?: string
  atbs?: number
  avg_pos?: number
  clicks?: number
  cpc?: number
  cpm?: number
  ctr?: number
  orders?: number
  views?: number
}

export interface WbClusterStatsGroup {
  advert_id: number
  nm_id: number
  stats: WbClusterStatsPoint[]
}

export interface WbClusterStatsResponse {
  stats: WbClusterStatsGroup[]
}

export interface WbUpdHistoryItem {
  advertId?: number
  advert_id?: number
  updNum?: number
  upd_num?: number
  updSum?: number
  upd_sum?: number
  updTime?: string
  upd_time?: string
  campName?: string
  camp_name?: string
  paymentType?: string
  payment_type?: string
  advertType?: number
  advert_type?: number
  advertStatus?: number
  advert_status?: number
  currency?: string
  type?: string
  action?: string
  param?: string
  from?: number | string | null
  to?: number | string | null
  sum?: number
  status?: number
  text?: string
}

export interface WbCampaignBudgetResponse {
  cash?: number
  netting?: number
  total?: number
}

export interface WbCampaignBudgetDepositRequest {
  sum: number
  cashback_sum?: number | null
  cashback_percent?: number | null
  type: 0 | 1 | 3
  return?: boolean
}

// Internal types (camelCase)

export interface AdCampaignRow {
  id: string
  wbAccountId: string
  advertId: number
  name: string
  status: AdStatus
  statusLabel: string
  bidType: string | null
  paymentType: string | null
  placementSearch: boolean
  placementReco: boolean
  budget: string | null
  createdAt: string
  updatedAt: string
}

export interface AdCampaignDetail extends AdCampaignRow {
  lastBid: string | null
}

export interface AdStatRow {
  date: string
  source: AdSource
  views: number
  clicks: number
  ctr: string
  cpc: string
  spend: string
  orders: number
  cartAdds: number
  bid: string | null
}

export interface AdNmStatRow {
  nmId: number
  vendorCode: string | null
  brandName: string | null
  subjectName: string | null
  photoUrl: string | null
  views: number
  clicks: number
  ctr: string
  cpc: string
  spend: string
  orders: number
  cartAdds: number
  adOrderSum: string
  cpo: string
  wbOrders: number
  wbOrderRevenue: string
  sales: number
  salesRevenue: string
  returns: number
  funnelOpenCount: number
  funnelAddToCartCount: number
  funnelCartCount: number
  funnelOrdersCount: number
  funnelOrdersSum: string
}

export interface AdClusterRow {
  id: string
  cluster: string
  ctr: string
  position: string
  views: number
  clicks: number
  cartAdds: number
  orders: number
  cpm: string
  dateFrom: string
  dateTo: string
}

export interface AdActionLogRow {
  id: string
  source: 'local' | 'wb'
  action: string
  valueBefore: string | null
  valueAfter: string | null
  note: string | null
  createdAt: string
}

export interface AdDailyMetrics {
  date: string
  searchViews: number
  searchClicks: number
  searchCartAdds: number
  searchOrders: number
  searchSpend: string
  searchCtr: string
  searchCpc: string
  searchCpo: string
  searchBid: string | null
  recoViews: number
  recoClicks: number
  recoCartAdds: number
  recoOrders: number
  recoSpend: string
  recoCtr: string
  recoCpc: string
  recoCpo: string
  recoBid: string | null
  totalViews: number
  totalClicks: number
  totalCartAdds: number
  totalOrders: number
  totalSpend: string
  totalCtr: string
  totalCpc: string
  totalCpo: string
  totalBid: string | null
}

export interface AdCampaignMetrics {
  daily: AdDailyMetrics[]
  totals: Omit<AdDailyMetrics, 'date'>
}

export interface AdSyncResult {
  totalRows: number
  upserted: number
  errors: number
  durationMs: number
}

export interface AdStatsSyncResult {
  totalRows: number
  upserted: number
  errors: number
  durationMs: number
}

export interface AdClusterSyncResult {
  totalRows: number
  created: number
  deleted: number
  errors: number
  durationMs: number
}
