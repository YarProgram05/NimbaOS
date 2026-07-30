import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { prisma } from '@/lib/db'
import { getFbsWorkspaceData } from '@/lib/services/fbs-workspace'
import { FbsClient } from './fbs-client'

interface FbsPageProps {
  searchParams: Promise<{
    account?: string
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function FbsPage({ searchParams }: FbsPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const params = await searchParams
  const accounts = await prisma.wbAccount.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  const wbAccountId =
    accounts.find((account) => account.id === params.account)?.id ??
    accounts[0]?.id ??
    null

  if (!wbAccountId) {
    return (
      <div className="dashboard-page">
        <h1 className="text-2xl font-semibold tracking-tight">FBS</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4">
            настройках
          </Link>
          .
        </p>
      </div>
    )
  }

  const data = await getFbsWorkspaceData({
    wbAccountId,
    canOperate: checkRole(session, 'MANAGER'),
    canViewFullKiz: checkRole(session, 'MANAGER'),
    canEnableWbWrites: checkRole(session, 'ADMIN'),
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  })

  return (
    <FbsClient
      data={data}
      accounts={accounts}
      dateFrom={params.dateFrom ?? ''}
      dateTo={params.dateTo ?? ''}
    />
  )
}
