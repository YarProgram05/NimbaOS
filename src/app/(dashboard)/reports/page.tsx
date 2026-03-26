import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getReportData } from '@/lib/actions/reports'
import { ReportsClient } from './reports-client'

interface ReportsPageProps {
  searchParams: Promise<{
    account?: string
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
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
        <h1 className="text-2xl font-bold tracking-tight">Финансовые отчёты</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы просматривать отчёты.
        </p>
      </div>
    )
  }

  // ── Default period: 1st of current month → today ──────────────────────────
  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const defaultTo = today.toISOString().slice(0, 10)

  const dateFrom = params.dateFrom ?? defaultFrom
  const dateTo = params.dateTo ?? defaultTo

  // ── Fetch report data ─────────────────────────────────────────────────────
  const result = await getReportData(wbAccountId, dateFrom, dateTo)
  const initialData = result.success ? result.data : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Финансовые отчёты</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Реализация по кабинету Wildberries
        </p>
      </div>

      <ReportsClient
        initialData={initialData}
        wbAccountId={wbAccountId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
      />
    </div>
  )
}
