import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProducts } from '@/lib/actions/products'
import { CardsClient } from './cards-client'

const VALID_SORT_BY = ['nmId', 'vendorCode', 'brand', 'category', 'price'] as const
type SortBy = (typeof VALID_SORT_BY)[number]

interface CardsPageProps {
  searchParams: Promise<{
    account?: string
    page?: string
    pageSize?: string
    search?: string
    brand?: string
    category?: string
    sortBy?: string
    sortDir?: string
  }>
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams

  // ── Resolve WB account ───────────────────────────────────────────────────────
  let wbAccountId: string | null = params.account ?? null

  if (!wbAccountId) {
    const firstAccount = await prisma.wbAccount.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (firstAccount) wbAccountId = firstAccount.id
  }

  if (!wbAccountId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Карточки товаров</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы синхронизировать товары.
        </p>
      </div>
    )
  }

  // ── Parse + validate search params ──────────────────────────────────────────
  const page     = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize ?? '100', 10) || 100))
  const search   = params.search?.trim() ?? ''
  const brand    = params.brand?.trim() ?? ''
  const category = params.category?.trim() ?? ''
  const sortBy: SortBy = VALID_SORT_BY.includes(params.sortBy as SortBy)
    ? (params.sortBy as SortBy)
    : 'nmId'
  const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc'

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const result = await getProducts({
    wbAccountId,
    page,
    pageSize,
    search:   search   || undefined,
    brand:    brand    || undefined,
    category: category || undefined,
    sortBy,
    sortDir,
  })

  if (!result.success) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Карточки товаров</h1>
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Карточки товаров</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Синхронизированные товары из Wildberries
        </p>
      </div>

      <CardsClient
        data={result.data}
        wbAccountId={wbAccountId}
        currentSearch={search}
        currentBrand={brand}
        currentCategory={category}
        currentPage={page}
        currentSortBy={sortBy}
        currentSortDir={sortDir}
      />
    </div>
  )
}
