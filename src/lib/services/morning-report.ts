import { TOTAL_STOCK_WAREHOUSE_VALUE } from '@/types/stocks'
import { calculateReport, REPORT_CALCULATION_OPTIONS } from '@/lib/services/report-calculator'
import { getPaginatedStocks, getStocksSummary } from '@/lib/services/stocks'
import type { ReportData } from '@/types/reports'
import type { PaginatedStocks, StocksSummary } from '@/types/stocks'

export interface MorningReportData {
  wbAccountId: string
  dateFrom: string
  dateTo: string
  financial: ReportData
  stocks: StocksSummary
  stockRows: PaginatedStocks['rows']
}

export async function getMorningReportData(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<MorningReportData> {
  const [financial, stocks, stockRows] = await Promise.all([
    calculateReport(wbAccountId, dateFrom, dateTo, REPORT_CALCULATION_OPTIONS),
    getStocksSummary(wbAccountId),
    getPaginatedStocks({
      wbAccountId,
      page: 1,
      pageSize: 10000,
      warehouse: TOTAL_STOCK_WAREHOUSE_VALUE,
      sortBy: 'risk',
      sortDir: 'asc',
    }),
  ])

  return {
    wbAccountId,
    dateFrom,
    dateTo,
    financial,
    stocks,
    stockRows: stockRows.rows,
  }
}
