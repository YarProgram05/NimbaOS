'use server'

import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import { enqueueProductsSyncAction } from '@/lib/actions/sync'
import { uploadPriceTask, fetchPricesByNmId } from '@/lib/wb-api/products'
import type { ActionResult } from '@/types'
import type { EnqueuedSyncJob } from '@/types/sync'
import type {
  GetProductsOptions,
  PaginatedProducts,
  ProductRow,
} from '@/types/products'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

// ── syncProductsAction ──────────────────────────────────────────────────────────

export async function syncProductsAction(
  wbAccountId: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  return enqueueProductsSyncAction(wbAccountId)
}

// ── getProducts ─────────────────────────────────────────────────────────────────

export async function getProducts(
  options: GetProductsOptions,
): Promise<ActionResult<PaginatedProducts>> {
  try {
    await requireSession()

    const {
      wbAccountId,
      page,
      pageSize,
      search,
      brand,
      category,
      sortBy = 'nmId',
      sortDir = 'asc',
    } = options

    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    const where: Prisma.ProductWhereInput = {
      wbAccountId,
      ...(search
        ? {
            OR: [
              { vendorCode: { contains: search, mode: 'insensitive' } },
              { title:      { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(brand    ? { brand:    { equals: brand,    mode: 'insensitive' } } : {}),
      ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
    }

    const isPriceSort = sortBy === 'price'
    const skip = (page - 1) * pageSize

    const [total, rawProducts, brands, categories, account] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: isPriceSort
          ? { nmId: 'asc' }
          : { [sortBy]: sortDir } as Prisma.ProductOrderByWithRelationInput,
        skip: isPriceSort ? undefined : skip,
        take: isPriceSort ? undefined : pageSize,
        include: {
          sizes: {
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.product
        .findMany({
          where: { wbAccountId, brand: { not: null }, AND: { brand: { not: '' } } },
          select: { brand: true },
          distinct: ['brand'],
          orderBy: { brand: 'asc' },
        })
        .then((rows) => rows.map((r) => r.brand!)),
      prisma.product
        .findMany({
          where: { wbAccountId, category: { not: null }, AND: { category: { not: '' } } },
          select: { category: true },
          distinct: ['category'],
          orderBy: { category: 'asc' },
        })
        .then((rows) => rows.map((r) => r.category!)),
      prisma.wbAccount.findUnique({
        where: { id: wbAccountId },
        select: { lastSyncAt: true },
      }),
    ])

    let rows: ProductRow[] = rawProducts.map((p) => {
      const size = p.sizes[0]
      const basePriceNum = size?.price ? parseFloat(size.price.toString()) : null
      const discountNum = size?.discount ?? null

      // Seller's actual selling price = base × (1 − discount%)
      const sellerPrice =
        basePriceNum !== null && discountNum !== null
          ? basePriceNum * (1 - discountNum / 100)
          : basePriceNum

      return {
        id:              p.id,
        nmId:            p.nmId,
        imtId:           p.imtId === null ? null : Number(p.imtId),
        vendorCode:      p.vendorCode,
        vendorCodeLocal: p.vendorCodeLocal,
        brand:           p.brand,
        category:        p.category,
        title:           p.title,
        photoUrl:        p.photoUrl,
        basePrice:       basePriceNum?.toFixed(2) ?? null,
        price:           sellerPrice?.toFixed(2) ?? null,
        discount:        discountNum,
        sppPrice:        size?.spp?.toString() ?? null,
      }
    })

    // In-memory price sort (by seller price) + pagination
    if (isPriceSort) {
      rows.sort((a, b) => {
        const pa = a.price !== null ? parseFloat(a.price) : -Infinity
        const pb = b.price !== null ? parseFloat(b.price) : -Infinity
        return sortDir === 'asc' ? pa - pb : pb - pa
      })
      rows = rows.slice(skip, skip + pageSize)
    }

    return {
      success: true,
      data: {
        rows,
        total,
        page,
        pageSize,
        brands,
        categories,
        lastSyncAt: account?.lastSyncAt?.toISOString() ?? null,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка загрузки товаров'
    return { success: false, error: msg }
  }
}

// ── updateProductPriceAction ────────────────────────────────────────────────────

export async function updateProductPriceAction(
  wbAccountId: string,
  nmId: number,
  basePrice: number,
  discount: number,
): Promise<ActionResult<void>> {
  try {
    await requireSession()

    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    if (basePrice <= 0)  return { success: false, error: 'Цена должна быть больше 0' }
    if (discount < 0 || discount > 95)
      return { success: false, error: 'Скидка должна быть от 0 до 95%' }

    const account = await prisma.wbAccount.findUniqueOrThrow({
      where: { id: wbAccountId },
      select: { apiKey: true },
    })
    const apiKey = decrypt(account.apiKey)
    const client = new WbApiClient(apiKey)

    // Send to WB (async on WB side; prices update within seconds)
    await uploadPriceTask(client, [{ nmID: nmId, price: basePrice, discount }])

    // Optimistic DB update
    const product = await prisma.product.findUnique({
      where: { wbAccountId_nmId: { wbAccountId, nmId } },
      select: { id: true },
    })
    if (product) {
      const sellerPrice = basePrice * (1 - discount / 100)
      await prisma.productSize.updateMany({
        where: { productId: product.id },
        data: {
          price:    basePrice,
          discount: discount,
          spp:      sellerPrice,
        },
      })
    }

    return { success: true, data: undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка обновления цены'
    return { success: false, error: msg }
  }
}

// ── refreshProductPriceAction ───────────────────────────────────────────────────

export async function refreshProductPriceAction(
  wbAccountId: string,
  nmId: number,
): Promise<ActionResult<{ basePrice: number; discount: number; sellerPrice: number }>> {
  try {
    await requireSession()

    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    const account = await prisma.wbAccount.findUniqueOrThrow({
      where: { id: wbAccountId },
      select: { apiKey: true },
    })
    const apiKey = decrypt(account.apiKey)
    const client = new WbApiClient(apiKey)

    const item = await fetchPricesByNmId(client, nmId)
    if (!item) return { success: false, error: 'Товар не найден в WB' }

    const size = item.sizes[0]
    if (!size) return { success: false, error: 'Нет данных о цене' }

    const basePrice = size.price        // in roubles
    const discount = item.discount
    const sellerPrice = size.discountedPrice

    // Update DB
    const product = await prisma.product.findUnique({
      where: { wbAccountId_nmId: { wbAccountId, nmId } },
      select: { id: true },
    })
    if (product) {
      await prisma.productSize.updateMany({
        where: { productId: product.id },
        data: { price: basePrice, discount, spp: sellerPrice },
      })
    }

    return { success: true, data: { basePrice, discount, sellerPrice } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка получения цены'
    return { success: false, error: msg }
  }
}
