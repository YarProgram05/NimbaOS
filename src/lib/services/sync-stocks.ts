import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { fetchWbWarehouseStocks } from '@/lib/wb-api/stocks'
import type { StockSyncResult, WbWarehouseStockItem } from '@/types/stocks'

const NM_BATCH_SIZE = 1000
const STOCK_PAGE_LIMIT = 250000

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function syncStocksCurrent(wbAccountId: string): Promise<StockSyncResult> {
  const startMs = Date.now()
  const syncedAt = new Date()
  const result: StockSyncResult = {
    totalRows: 0,
    upserted: 0,
    warehouses: 0,
    snapshots: 0,
    pages: 0,
    errors: 0,
    durationMs: 0,
    syncedAt: syncedAt.toISOString(),
  }

  const [account, products] = await Promise.all([
    prisma.wbAccount.findUniqueOrThrow({
      where: { id: wbAccountId },
      select: { apiKey: true },
    }),
    prisma.product.findMany({
      where: { wbAccountId },
      select: {
        id: true,
        nmId: true,
        sizes: { select: { id: true, chrtId: true, barcode: true } },
      },
      orderBy: { nmId: 'asc' },
    }),
  ])

  const productByNmId = new Map(products.map((product) => [product.nmId, product]))
  const nmIds = products.map((product) => product.nmId)
  const client = new WbApiClient(decrypt(account.apiKey))
  const rows: WbWarehouseStockItem[] = []

  for (const nmChunk of chunk(nmIds, NM_BATCH_SIZE)) {
    let offset = 0

    do {
      const page = await fetchWbWarehouseStocks(client, {
        nmIds: nmChunk,
        limit: STOCK_PAGE_LIMIT,
        offset,
      })

      result.pages++
      rows.push(...page)
      offset += STOCK_PAGE_LIMIT

      if (page.length < STOCK_PAGE_LIMIT) break
    } while (true)
  }

  result.totalRows = rows.length

  const warehouses = new Map<number, { warehouseId: number; name: string; regionName: string | null }>()
  for (const row of rows) {
    warehouses.set(row.warehouseId, {
      warehouseId: row.warehouseId,
      name: row.warehouseName || `WB ${row.warehouseId}`,
      regionName: row.regionName || null,
    })
  }

  const snapshot = await prisma.$transaction(async (tx) => {
    for (const warehouse of Array.from(warehouses.values())) {
      await tx.warehouse.upsert({
        where: {
          wbAccountId_warehouseId: {
            wbAccountId,
            warehouseId: warehouse.warehouseId,
          },
        },
        create: {
          wbAccountId,
          warehouseId: warehouse.warehouseId,
          name: warehouse.name,
          regionName: warehouse.regionName,
        },
        update: {
          name: warehouse.name,
          regionName: warehouse.regionName,
        },
      })
    }

    const createdSnapshot = await tx.stockSnapshot.create({
      data: {
        wbAccountId,
        syncedAt,
        source: 'wb_warehouses',
      },
    })

    if (rows.length > 0) {
      const { count } = await tx.stockItem.createMany({
        data: rows.map((row) => {
          const product = productByNmId.get(row.nmId)
          const productSize =
            product?.sizes.find((size) => size.chrtId === row.chrtId) ??
            product?.sizes.find((size) => size.chrtId === null && row.chrtId === 0)

          return {
            snapshotId: createdSnapshot.id,
            wbAccountId,
            nmId: row.nmId,
            chrtId: row.chrtId || null,
            warehouseId: row.warehouseId,
            quantity: row.quantity ?? 0,
            inWayToClient: row.inWayToClient ?? 0,
            inWayFromClient: row.inWayFromClient ?? 0,
            productId: product?.id ?? null,
            productSizeId: productSize?.id ?? null,
          }
        }),
        skipDuplicates: true,
      })
      result.upserted = count
    }

    return createdSnapshot
  })

  await prisma.wbAccount.update({
    where: { id: wbAccountId },
    data: { lastSyncAt: syncedAt },
  })

  result.snapshots = 1
  result.warehouses = warehouses.size
  result.durationMs = Date.now() - startMs
  result.syncedAt = snapshot.syncedAt.toISOString()
  return result
}
