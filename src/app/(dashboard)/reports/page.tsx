import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getReportData } from '@/lib/actions/reports'
import { REPORT_COLUMN_ORDER_PREFERENCE_KEY } from '@/lib/reports/preferences'
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
      <div className="dashboard-page">
        <h1 className="text-2xl font-semibold tracking-tight">Финансовые отчёты</h1>
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
  const columnOrderPreference = await prisma.userPreference.findUnique({
    where: {
      userId_key: {
        userId: session.user.id,
        key: REPORT_COLUMN_ORDER_PREFERENCE_KEY,
      },
    },
    select: { value: true },
  })
  const initialColumnOrder = Array.isArray(columnOrderPreference?.value)
    ? columnOrderPreference.value.filter((id): id is string => typeof id === 'string')
    : null

  return (
    <div className="flex h-auto min-h-0 flex-col lg:h-full">
      <ReportsClient
        initialData={initialData}
        wbAccountId={wbAccountId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        initialColumnOrder={initialColumnOrder}
      />
    </div>
  )
}
