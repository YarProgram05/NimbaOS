import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCampaignDetailAction } from '@/lib/actions/advertising'
import { CampaignDetailClient } from './campaign-detail-client'

interface CampaignDetailPageProps {
  params: Promise<{ campaignId: string }>
  searchParams: Promise<{ account?: string; dateFrom?: string; dateTo?: string }>
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: CampaignDetailPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { campaignId } = await params
  const { account, dateFrom, dateTo } = await searchParams

  const result = await getCampaignDetailAction(campaignId)

  if (!result.success) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Кампания не найдена</h1>
        <p className="text-muted-foreground">
          <Link
            href={`/advertising${account ? `?account=${account}` : ''}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Вернуться к списку кампаний
          </Link>
        </p>
      </div>
    )
  }

  return (
    <CampaignDetailClient
      campaign={result.data}
      accountParam={account || result.data.wbAccountId}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
    />
  )
}
