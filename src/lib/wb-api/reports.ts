import type { WbApiClient } from './client'
import type { WbRealizationRow } from '@/types/reports'

export interface RealizationReportPage {
  rows: WbRealizationRow[]
  lastRrdId: number | null
  done: boolean
}

/**
 * Fetches a single page of the realization report.
 * GET /api/v5/supplier/reportDetailByPeriod — statistics domain (60 000 ms rate limit).
 *
 * Pagination: pass rrdid (the last rrd_id from the previous page) to advance.
 * Stop when the response is 204 (null) or an empty array.
 */
export async function fetchRealizationReportPage(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
  rrdid?: number,
): Promise<RealizationReportPage> {
  const params: Record<string, string> = { dateFrom, dateTo }
  if (rrdid !== undefined) {
    params.rrdid = String(rrdid)
  }

  const rows = await client.get<WbRealizationRow[] | null>(
    'statistics',
    '/api/v5/supplier/reportDetailByPeriod',
    params,
  )

  if (!rows || rows.length === 0) {
    return { rows: [], lastRrdId: null, done: true }
  }

  return {
    rows,
    lastRrdId: rows[rows.length - 1].rrd_id,
    done: false,
  }
}
