import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPlansAction } from '@/lib/actions/sales-plan'
import { SalesPlanClient } from './sales-plan-client'

interface SalesPlanPageProps {
  searchParams: Promise<{
    account?: string
  }>
}

export default async function SalesPlanPage({ searchParams }: SalesPlanPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams

  // ── Resolve WB account ────────────────────────────────────────────────────
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
        <h1 className="text-2xl font-semibold tracking-tight">План продаж</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы создавать планы продаж.
        </p>
      </div>
    )
  }

  // ── Fetch plans ─────────────────────────────────────────────────────────
  const result = await getPlansAction(wbAccountId)
  const initialPlans = result.success ? result.data : []

  return (
    <div className="dashboard-page">
      <div className="shrink-0">
        <p className="metric-label">Планирование</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">План продаж</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Планирование и контроль продаж по артикулам
        </p>
      </div>

      <SalesPlanClient
        initialPlans={initialPlans}
        wbAccountId={wbAccountId}
      />
    </div>
  )
}
