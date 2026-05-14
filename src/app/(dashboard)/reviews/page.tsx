import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPaginatedFeedback } from '@/lib/services/feedback'
import { ReviewsClient } from './reviews-client'
import type {
  FeedbackAnswerFilter,
  FeedbackRatingFilter,
  FeedbackSortBy,
  FeedbackSortDir,
  FeedbackTab,
} from '@/types/feedback'

const VALID_TABS = ['reviews', 'questions'] as const
const VALID_ANSWER_FILTERS = ['all', 'answered', 'unanswered'] as const
const VALID_RATINGS = ['all', '1', '2', '3', '4', '5'] as const
const VALID_SORT_BY = ['createdDate', 'rating', 'nmId', 'vendorCode', 'productName', 'isAnswered', 'wasViewed'] as const

interface ReviewsPageProps {
  searchParams: Promise<{
    account?: string
    tab?: string
    page?: string
    pageSize?: string
    search?: string
    rating?: string
    answerStatus?: string
    nmId?: string
    dateFrom?: string
    dateTo?: string
    sortBy?: string
    sortDir?: string
  }>
}

function isDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
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
        <h1 className="text-2xl font-semibold tracking-tight">Отзывы и вопросы</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы синхронизировать обратную связь покупателей.
        </p>
      </div>
    )
  }

  const tab: FeedbackTab = VALID_TABS.includes(params.tab as FeedbackTab)
    ? (params.tab as FeedbackTab)
    : 'reviews'
  const answerStatus: FeedbackAnswerFilter = VALID_ANSWER_FILTERS.includes(params.answerStatus as FeedbackAnswerFilter)
    ? (params.answerStatus as FeedbackAnswerFilter)
    : 'all'
  const rating: FeedbackRatingFilter = VALID_RATINGS.includes(params.rating as FeedbackRatingFilter)
    ? (params.rating as FeedbackRatingFilter)
    : 'all'
  const nmId = params.nmId && /^\d+$/.test(params.nmId) ? Number(params.nmId) : undefined
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize ?? '50', 10) || 50))
  const search = params.search?.trim() ?? ''
  const dateFrom = isDateKey(params.dateFrom) ? params.dateFrom : undefined
  const dateTo = isDateKey(params.dateTo) ? params.dateTo : undefined
  const sortBy: FeedbackSortBy = VALID_SORT_BY.includes(params.sortBy as FeedbackSortBy)
    ? (params.sortBy as FeedbackSortBy)
    : 'createdDate'
  const sortDir: FeedbackSortDir = params.sortDir === 'asc' ? 'asc' : 'desc'

  const data = await getPaginatedFeedback({
    wbAccountId,
    tab,
    page,
    pageSize,
    search: search || undefined,
    rating,
    answerStatus,
    nmId,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
  })

  return (
    <div className="dashboard-page h-full min-h-0 overflow-hidden">
      <div className="shrink-0">
        <p className="metric-label">Клиентская обратная связь</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Отзывы и вопросы WB</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only очередь отзывов и вопросов из локально сохраненных данных WB
        </p>
      </div>

      <ReviewsClient
        data={data}
        wbAccountId={wbAccountId}
        currentTab={tab}
        currentSearch={search}
        currentRating={rating}
        currentAnswerStatus={answerStatus}
        currentNmId={nmId ? String(nmId) : ''}
        currentDateFrom={dateFrom ?? ''}
        currentDateTo={dateTo ?? ''}
        currentPage={page}
        currentSortBy={sortBy}
        currentSortDir={sortDir}
      />
    </div>
  )
}
