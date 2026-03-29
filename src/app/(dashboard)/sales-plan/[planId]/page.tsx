import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlanDetailAction } from '@/lib/actions/sales-plan'
import { PlanDetailClient } from './plan-detail-client'

interface PlanDetailPageProps {
  params: Promise<{ planId: string }>
  searchParams: Promise<{ account?: string }>
}

export default async function PlanDetailPage({ params, searchParams }: PlanDetailPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { planId } = await params
  const { account } = await searchParams

  const result = await getPlanDetailAction(planId)

  if (!result.success) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">План не найден</h1>
        <p className="text-muted-foreground">
          <Link
            href={`/sales-plan${account ? `?account=${account}` : ''}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Вернуться к списку планов
          </Link>
        </p>
      </div>
    )
  }

  return (
    <PlanDetailClient
      plan={result.data}
      accountParam={account || result.data.wbAccountId}
    />
  )
}
