import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPaginatedStocks } from '@/lib/services/stocks'
import { StocksClient } from './stocks-client'
import type { StockRisk } from '@/types/stocks'

const VALID_SORT_BY = ['vendorCode', 'nmId', 'brand', 'category', 'quantity', 'stockValue', 'risk'] as const
const VALID_RISKS = ['all', 'out_of_stock', 'low_stock', 'overstock', 'ok', 'no_sales'] as const

type SortBy = (typeof VALID_SORT_BY)[number]

interface StocksPageProps {
  searchParams: Promise<{
    account?: string
    page?: string
    pageSize?: string
    search?: string
    brand?: string
    category?: string
    warehouse?: string
    risk?: string
    sortBy?: string
    sortDir?: string
  }>
}

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams
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
      <div className="dashboard-page">
        <h1 className="text-2xl font-semibold tracking-tight">Остатки</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы синхронизировать склад.
        </p>
      </div>
    )
  }

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize ?? '50', 10) || 50))
  const search = params.search?.trim() ?? ''
  const brand = params.brand?.trim() ?? ''
  const category = params.category?.trim() ?? ''
  const warehouse = params.warehouse?.trim() ?? ''
  const risk = VALID_RISKS.includes(params.risk as (typeof VALID_RISKS)[number])
    ? (params.risk as StockRisk | 'all')
    : 'all'
  const sortBy: SortBy = VALID_SORT_BY.includes(params.sortBy as SortBy)
    ? (params.sortBy as SortBy)
    : 'risk'
  const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc'

  const data = await getPaginatedStocks({
    wbAccountId,
    page,
    pageSize,
    search: search || undefined,
    brand: brand || undefined,
    category: category || undefined,
    warehouse: warehouse || undefined,
    risk,
    sortBy,
    sortDir,
  })

  return (
    <div className="dashboard-page">
      <div className="shrink-0">
        <p className="metric-label">Склад</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Остатки WB</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Текущие остатки по складам WB из локального снимка синхронизации
        </p>
      </div>

      <StocksClient
        data={data}
        wbAccountId={wbAccountId}
        currentSearch={search}
        currentBrand={brand}
        currentCategory={category}
        currentWarehouse={warehouse}
        currentRisk={risk}
        currentPage={page}
        currentSortBy={sortBy}
        currentSortDir={sortDir}
      />
    </div>
  )
}
