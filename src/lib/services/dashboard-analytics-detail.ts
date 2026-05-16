import { calculateReport } from '@/lib/services/report-calculator'
import { getDashboardSummary } from '@/lib/services/dashboard-summary'
import type { ReportRow } from '@/types/reports'
import type {
  DashboardProductSnapshot,
  DashboardSummary,
  DashboardSummaryRequest,
  DashboardValueStatus,
} from '@/types/dashboard'

const HIGH_LOGISTICS_SHARE_PERCENT = 15
const HIGH_STORAGE_SHARE_PERCENT = 5
const HIGH_DRR_PERCENT = 20
const HIGH_RETURN_RATE_PERCENT = 20
const HIGH_RETURN_RATE_MIN_RETURNS = 2
const DETAIL_LIMIT = 20

export interface DashboardAnalyticsDetail {
  summary: DashboardSummary
  products: {
    topRevenue: DashboardProductSnapshot[]
    topProfit: DashboardProductSnapshot[]
    negativeProfit: DashboardProductSnapshot[]
    highDrr: DashboardProductSnapshot[]
    highLogisticsShare: DashboardProductSnapshot[]
    highStorageShare: DashboardProductSnapshot[]
    missingCostPrice: DashboardProductSnapshot[]
    highReturnRate: DashboardProductSnapshot[]
  }
}

export async function getDashboardAnalyticsDetail(
  request: DashboardSummaryRequest,
): Promise<DashboardAnalyticsDetail | null> {
  const summary = await getDashboardSummary(request)
  if (!summary) return null

  const report = summary.products.status === 'missing'
    ? null
    : await calculateReport(summary.account.id, summary.period.dateFrom, summary.period.dateTo, {
      preferPersistedAdStats: true,
    })
  const rows = report?.rows ?? []
  const status = summary.products.status

  return {
    summary,
    products: {
      topRevenue: rows
        .filter((row) => Number(row.sale) > 0)
        .sort((a, b) => Number(b.sale) - Number(a.sale))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      topProfit: rows
        .filter((row) => Number(row.operatingProfit) > 0)
        .sort((a, b) => Number(b.operatingProfit) - Number(a.operatingProfit))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      negativeProfit: rows
        .filter((row) => Number(row.operatingProfit) < 0)
        .sort((a, b) => Number(a.operatingProfit) - Number(b.operatingProfit))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      highDrr: rows
        .filter((row) => Number(row.drr) >= HIGH_DRR_PERCENT)
        .sort((a, b) => Number(b.drr) - Number(a.drr))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      highLogisticsShare: rows
        .filter((row) => Number(row.logisticsFromSalesPercent) >= HIGH_LOGISTICS_SHARE_PERCENT)
        .sort((a, b) => Number(b.logisticsFromSalesPercent) - Number(a.logisticsFromSalesPercent))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      highStorageShare: rows
        .filter((row) => Number(row.storageFromSalesPercent) >= HIGH_STORAGE_SHARE_PERCENT)
        .sort((a, b) => Number(b.storageFromSalesPercent) - Number(a.storageFromSalesPercent))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      missingCostPrice: rows
        .filter((row) => Number(row.costPrice) === 0 && row.boughtWithReturns > 0)
        .sort((a, b) => b.boughtWithReturns - a.boughtWithReturns)
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
      highReturnRate: rows
        .filter((row) => productReturnRate(row) >= HIGH_RETURN_RATE_PERCENT && row.returns >= HIGH_RETURN_RATE_MIN_RETURNS)
        .sort((a, b) => productReturnRate(b) - productReturnRate(a))
        .slice(0, DETAIL_LIMIT)
        .map((row) => mapProductSnapshot(row, status)),
    },
  }
}

function mapProductSnapshot(
  row: ReportRow,
  status: DashboardValueStatus,
): DashboardProductSnapshot {
  return {
    nmId: row.nmId,
    vendorCode: row.vendorCode,
    brandName: row.brandName,
    subjectName: row.subjectName,
    photoUrl: row.photoUrl,
    revenue: Number(row.sale),
    toTransfer: Number(row.toTransfer),
    operatingProfit: Number(row.operatingProfit),
    marginality: Number(row.marginality),
    rentability: Number(row.rentability),
    drr: Number(row.drr),
    logistics: Number(row.logistics),
    logisticsShare: Number(row.logisticsFromSalesPercent),
    storage: Number(row.storageFee),
    storageShare: Number(row.storageFromSalesPercent),
    costPrice: Number(row.costPrice),
    returns: row.returns,
    returnRate: productReturnRate(row),
    status,
  }
}

function productReturnRate(row: ReportRow): number {
  const base = row.boughtWithoutReturns + row.returns
  return base > 0 ? (row.returns / base) * 100 : 0
}
