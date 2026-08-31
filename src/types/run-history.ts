export const RUN_HISTORY_PAGE_SIZES = [25, 50, 100] as const

export type RunHistoryPageSize = (typeof RUN_HISTORY_PAGE_SIZES)[number]
export type RunHistorySortDirection = 'asc' | 'desc'

export interface RunHistoryPage<T> {
  rows: T[]
  total: number
  page: number
  pageSize: RunHistoryPageSize
}

export function normalizeRunHistoryPageSize(value: number | undefined): RunHistoryPageSize {
  return RUN_HISTORY_PAGE_SIZES.includes(value as RunHistoryPageSize)
    ? value as RunHistoryPageSize
    : 25
}
