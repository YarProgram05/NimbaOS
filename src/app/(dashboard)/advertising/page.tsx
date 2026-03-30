import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCampaignsAction } from '@/lib/actions/advertising'
import { AdvertisingClient } from './advertising-client'

interface AdvertisingPageProps {
  searchParams: Promise<{
    account?: string
  }>
}

export default async function AdvertisingPage({ searchParams }: AdvertisingPageProps) {
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
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Рекламные кампании</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы синхронизировать рекламные кампании.
        </p>
      </div>
    )
  }

  const result = await getCampaignsAction(wbAccountId)
  const initialCampaigns = result.success ? result.data : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Рекламные кампании</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Список кампаний WB с фильтрацией по статусам и переходом в детализацию
        </p>
      </div>

      <AdvertisingClient
        initialCampaigns={initialCampaigns}
        wbAccountId={wbAccountId}
      />
    </div>
  )
}
