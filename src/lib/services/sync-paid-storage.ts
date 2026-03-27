import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchPaidStorageReport } from '@/lib/wb-api/paid-storage'
import type { PaidStorageSyncResult, WbPaidStorageRow } from '@/types/reports'

const MAX_PAID_STORAGE_PERIOD_DAYS = 8

/**
 * Synchronises paid storage data for a WB account into the database.
 * Uses the documented task-based flow:
 * 1. GET /api/v1/paid_storage
 * 2. GET /api/v1/paid_storage/tasks/{task_id}/status
 * 3. GET /api/v1/paid_storage/tasks/{task_id}/download
 *
 * WB limits one task to at most 8 days, so large periods are split into chunks.
 * Existing rows are replaced only after the whole period is downloaded successfully.
 */
export async function syncPaidStorage(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<PaidStorageSyncResult> {
  const startMs = Date.now()
  const result: PaidStorageSyncResult = {
    totalRows: 0,
    upserted: 0,
    pages: 0,
    errors: 0,
    durationMs: 0,
  }

  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const apiKey = decrypt(account.apiKey)
  const client = new WbApiClient(apiKey)

  const chunks = splitPaidStoragePeriod(dateFrom, dateTo)
  const downloadedRows: WbPaidStorageRow[] = []

  for (const chunk of chunks) {
    try {
      const rows = await fetchPaidStorageReport(client, chunk.dateFrom, chunk.dateTo)
      downloadedRows.push(...rows)
      result.totalRows += rows.length
      result.pages++
    } catch {
      result.errors++
      result.durationMs = Date.now() - startMs
      return result
    }
  }

  const mappedRows = aggregateRowsByCurrentUniqueKey(wbAccountId, downloadedRows)
  const deleteWhere = {
    wbAccountId,
    date: { gte: parseDate(dateFrom), lte: parseDate(dateTo) },
  }

  await prisma.$transaction(async (tx) => {
    await tx.paidStorage.deleteMany({ where: deleteWhere })

    if (mappedRows.length === 0) {
      return
    }

    const { count } = await tx.paidStorage.createMany({
      data: mappedRows,
    })

    result.upserted = count
  })

  result.durationMs = Date.now() - startMs
  return result
}

function splitPaidStoragePeriod(dateFrom: string, dateTo: string): Array<{ dateFrom: string; dateTo: string }> {
  const start = parseDate(dateFrom)
  const end = parseDate(dateTo)
  const chunks: Array<{ dateFrom: string; dateTo: string }> = []

  let cursor = start

  while (cursor <= end) {
    const chunkStart = new Date(cursor)
    const chunkEnd = new Date(cursor)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + MAX_PAID_STORAGE_PERIOD_DAYS - 1)

    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime())
    }

    chunks.push({
      dateFrom: formatDate(chunkStart),
      dateTo: formatDate(chunkEnd),
    })

    cursor = new Date(chunkEnd)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return chunks
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function normalizeNullable(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapRowToPrisma(wbAccountId: string, row: WbPaidStorageRow) {
  return {
    wbAccountId,
    date:          parseDate(row.date),
    nmId:          row.nmId,
    vendorCode:    normalizeNullable(row.vendorCode) ?? '',
    barcode:       normalizeNullable(row.barcode),
    brand:         normalizeNullable(row.brand),
    subject:       normalizeNullable(row.subject),
    category:      null,
    warehouseName: normalizeNullable(row.warehouse),
    chrtId:        row.chrtId,
    size:          normalizeNullable(row.size),
    qty:           row.barcodesCount ?? 0,
    cost:          row.warehousePrice,
  }
}

function aggregateRowsByCurrentUniqueKey(wbAccountId: string, rows: WbPaidStorageRow[]) {
  const aggregated = new Map<string, ReturnType<typeof mapRowToPrisma>>()

  for (const row of rows) {
    const mapped = mapRowToPrisma(wbAccountId, row)
    const key = `${formatDate(mapped.date)}|${mapped.nmId}|${mapped.chrtId}`
    const existing = aggregated.get(key)

    if (!existing) {
      aggregated.set(key, mapped)
      continue
    }

    existing.qty += mapped.qty
    existing.cost += mapped.cost

    if (!existing.vendorCode && mapped.vendorCode) existing.vendorCode = mapped.vendorCode
    if (!existing.barcode && mapped.barcode) existing.barcode = mapped.barcode
    if (!existing.brand && mapped.brand) existing.brand = mapped.brand
    if (!existing.subject && mapped.subject) existing.subject = mapped.subject
    if (!existing.warehouseName && mapped.warehouseName) existing.warehouseName = mapped.warehouseName
    if (!existing.size && mapped.size) existing.size = mapped.size
  }

  return Array.from(aggregated.values())
}
