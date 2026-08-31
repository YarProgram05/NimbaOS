import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { prisma } from '@/lib/db'
import { listSyncJobRuns } from '@/lib/sync/job-runs'
import { listSyncSchedules } from '@/lib/sync/schedules'
import { SyncClient } from './sync-client'

interface SyncPageProps {
  searchParams: { account?: string }
}

export default async function SyncPage({ searchParams }: SyncPageProps) {
  const session = await getServerSession(authOptions)
  const canEnqueue = checkRole(session, 'MANAGER')

  const [accounts, jobs] = await Promise.all([
    prisma.wbAccount.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sellerName: true },
      orderBy: { createdAt: 'asc' },
    }),
    listSyncJobRuns({ page: 1, pageSize: 25 }),
  ])

  const selectedAccountId =
    searchParams.account && accounts.some((account) => account.id === searchParams.account)
      ? searchParams.account
      : accounts[0]?.id ?? null
  const schedules = selectedAccountId ? await listSyncSchedules(selectedAccountId) : []

  return (
    <SyncClient
      accounts={accounts}
      initialJobsPage={jobs}
      initialSchedules={schedules}
      selectedAccountId={selectedAccountId}
      canEnqueue={canEnqueue}
    />
  )
}
