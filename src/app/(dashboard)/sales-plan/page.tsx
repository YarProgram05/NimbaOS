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
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">План продаж</h1>
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">План продаж</h1>
        <p className="text-muted-foreground mt-1 text-sm">
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
