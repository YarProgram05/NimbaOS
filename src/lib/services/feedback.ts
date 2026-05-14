import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type {
  FeedbackSortBy,
  FeedbackSortDir,
  FeedbackQuestionRow,
  FeedbackReviewRow,
  FeedbackSummary,
  FeedbackWorkloadItem,
  GetFeedbackOptions,
  PaginatedFeedback,
} from '@/types/feedback'

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function defaultDateFrom(): Date {
  return addDays(parseDateKey(formatDateKey(new Date())), -6)
}

function takeText(value: string | null, maxLength = 220): string {
  if (!value) return ''
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function reviewWhere(options: GetFeedbackOptions): Prisma.ProductReviewWhereInput {
  const query = options.search?.trim().toLowerCase()
  const dateFrom = options.dateFrom ? parseDateKey(options.dateFrom) : undefined
  const dateTo = options.dateTo ? parseDateKey(options.dateTo) : undefined

  return {
    wbAccountId: options.wbAccountId,
    ...(options.nmId ? { nmId: options.nmId } : {}),
    ...(options.rating && options.rating !== 'all' ? { rating: Number(options.rating) } : {}),
    ...(options.answerStatus === 'answered' ? { isAnswered: true } : {}),
    ...(options.answerStatus === 'unanswered' ? { isAnswered: false } : {}),
    ...(dateFrom || dateTo
      ? {
          createdDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: addDays(dateTo, 1) } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { text: { contains: query, mode: 'insensitive' } },
            { pros: { contains: query, mode: 'insensitive' } },
            { cons: { contains: query, mode: 'insensitive' } },
            { answerText: { contains: query, mode: 'insensitive' } },
            { vendorCode: { contains: query, mode: 'insensitive' } },
            { productName: { contains: query, mode: 'insensitive' } },
            { brandName: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

function questionWhere(options: GetFeedbackOptions): Prisma.ProductQuestionWhereInput {
  const query = options.search?.trim().toLowerCase()
  const dateFrom = options.dateFrom ? parseDateKey(options.dateFrom) : undefined
  const dateTo = options.dateTo ? parseDateKey(options.dateTo) : undefined

  return {
    wbAccountId: options.wbAccountId,
    ...(options.nmId ? { nmId: options.nmId } : {}),
    ...(options.answerStatus === 'answered' ? { isAnswered: true } : {}),
    ...(options.answerStatus === 'unanswered' ? { isAnswered: false } : {}),
    ...(dateFrom || dateTo
      ? {
          createdDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: addDays(dateTo, 1) } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { text: { contains: query, mode: 'insensitive' } },
            { answerText: { contains: query, mode: 'insensitive' } },
            { vendorCode: { contains: query, mode: 'insensitive' } },
            { productName: { contains: query, mode: 'insensitive' } },
            { brandName: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

function reviewOrderBy(
  sortBy: FeedbackSortBy = 'createdDate',
  sortDir: FeedbackSortDir = 'desc',
): Prisma.ProductReviewOrderByWithRelationInput {
  if (sortBy === 'rating') return { rating: sortDir }
  if (sortBy === 'nmId') return { nmId: sortDir }
  if (sortBy === 'vendorCode') return { vendorCode: sortDir }
  if (sortBy === 'productName') return { productName: sortDir }
  if (sortBy === 'isAnswered') return { isAnswered: sortDir }
  return { createdDate: sortDir }
}

function questionOrderBy(
  sortBy: FeedbackSortBy = 'createdDate',
  sortDir: FeedbackSortDir = 'desc',
): Prisma.ProductQuestionOrderByWithRelationInput {
  if (sortBy === 'nmId') return { nmId: sortDir }
  if (sortBy === 'vendorCode') return { vendorCode: sortDir }
  if (sortBy === 'productName') return { productName: sortDir }
  if (sortBy === 'isAnswered') return { isAnswered: sortDir }
  if (sortBy === 'wasViewed') return { wasViewed: sortDir }
  return { createdDate: sortDir }
}

function mapReviewRow(row: {
  id: string
  externalId: string
  nmId: number
  vendorCode: string | null
  productName: string | null
  brandName: string | null
  rating: number
  text: string | null
  pros: string | null
  cons: string | null
  answerText: string | null
  answerEditable: boolean | null
  isAnswered: boolean
  createdDate: Date
  product: { photoUrl: string | null } | null
}): FeedbackReviewRow {
  return {
    id: row.id,
    type: 'reviews',
    externalId: row.externalId,
    nmId: row.nmId,
    vendorCode: row.vendorCode,
    productName: row.productName,
    brandName: row.brandName,
    text: takeText(row.text || row.pros || row.cons, 360),
    rating: row.rating,
    isAnswered: row.isAnswered,
    createdDate: row.createdDate.toISOString(),
    pros: row.pros,
    cons: row.cons,
    answerText: row.answerText,
    answerEditable: row.answerEditable,
    photoUrl: row.product?.photoUrl ?? null,
  }
}

function mapQuestionRow(row: {
  id: string
  externalId: string
  nmId: number
  vendorCode: string | null
  productName: string | null
  brandName: string | null
  text: string
  answerText: string | null
  answerEditable: boolean | null
  isAnswered: boolean
  wasViewed: boolean
  isWarned: boolean
  createdDate: Date
  product: { photoUrl: string | null } | null
}): FeedbackQuestionRow {
  return {
    id: row.id,
    type: 'questions',
    externalId: row.externalId,
    nmId: row.nmId,
    vendorCode: row.vendorCode,
    productName: row.productName,
    brandName: row.brandName,
    text: takeText(row.text, 360),
    rating: null,
    isAnswered: row.isAnswered,
    createdDate: row.createdDate.toISOString(),
    wasViewed: row.wasViewed,
    isWarned: row.isWarned,
    answerText: row.answerText,
    answerEditable: row.answerEditable,
    photoUrl: row.product?.photoUrl ?? null,
  }
}

function mapWorkloadItem(row: FeedbackReviewRow | FeedbackQuestionRow): FeedbackWorkloadItem {
  return {
    id: row.id,
    type: row.type,
    externalId: row.externalId,
    nmId: row.nmId,
    vendorCode: row.vendorCode,
    productName: row.productName,
    brandName: row.brandName,
    text: row.text,
    rating: row.rating,
    isAnswered: row.isAnswered,
    createdDate: row.createdDate,
  }
}

export async function getFeedbackSummary(
  wbAccountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<FeedbackSummary> {
  const from = dateFrom ? parseDateKey(dateFrom) : defaultDateFrom()
  const to = dateTo ? addDays(parseDateKey(dateTo), 1) : addDays(parseDateKey(formatDateKey(new Date())), 1)
  const period = { gte: from, lt: to }

  const [
    reviewsTotal,
    reviewsNew,
    negativeReviews,
    unansweredReviews,
    questionsTotal,
    questionsNew,
    unansweredQuestions,
    latestReview,
    latestQuestion,
    avgRating,
    urgentReviews,
    urgentQuestions,
  ] = await Promise.all([
    prisma.productReview.count({ where: { wbAccountId } }),
    prisma.productReview.count({ where: { wbAccountId, createdDate: period } }),
    prisma.productReview.count({ where: { wbAccountId, rating: { lte: 3 }, createdDate: period } }),
    prisma.productReview.count({ where: { wbAccountId, isAnswered: false } }),
    prisma.productQuestion.count({ where: { wbAccountId } }),
    prisma.productQuestion.count({ where: { wbAccountId, createdDate: period } }),
    prisma.productQuestion.count({ where: { wbAccountId, isAnswered: false } }),
    prisma.productReview.findFirst({ where: { wbAccountId }, orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
    prisma.productQuestion.findFirst({ where: { wbAccountId }, orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
    prisma.productReview.aggregate({ where: { wbAccountId, createdDate: period }, _avg: { rating: true } }),
    prisma.productReview.findMany({
      where: { wbAccountId, OR: [{ isAnswered: false }, { rating: { lte: 3 } }] },
      orderBy: [{ isAnswered: 'asc' }, { rating: 'asc' }, { createdDate: 'desc' }],
      take: 4,
      include: { product: { select: { photoUrl: true } } },
    }),
    prisma.productQuestion.findMany({
      where: { wbAccountId, isAnswered: false },
      orderBy: { createdDate: 'desc' },
      take: 4,
      include: { product: { select: { photoUrl: true } } },
    }),
  ])

  const syncedAt = [latestReview?.fetchedAt, latestQuestion?.fetchedAt]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  const urgentItems = [
    ...urgentReviews.map(mapReviewRow),
    ...urgentQuestions.map(mapQuestionRow),
  ]
    .sort((a, b) => {
      if (a.isAnswered !== b.isAnswered) return a.isAnswered ? 1 : -1
      const aRating = a.rating ?? 5
      const bRating = b.rating ?? 5
      return aRating - bRating || new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    })
    .slice(0, 6)
    .map(mapWorkloadItem)

  return {
    status: syncedAt ? 'ready' : 'missing',
    syncedAt: syncedAt?.toISOString() ?? null,
    averageRating: avgRating._avg.rating ?? null,
    reviewsTotal,
    reviewsNew,
    negativeReviews,
    unansweredReviews,
    questionsTotal,
    questionsNew,
    unansweredQuestions,
    urgentItems,
  }
}

export async function getPaginatedFeedback(options: GetFeedbackOptions): Promise<PaginatedFeedback> {
  const page = Math.max(1, options.page)
  const pageSize = Math.min(100, Math.max(10, options.pageSize))
  const skip = (page - 1) * pageSize
  const summary = await getFeedbackSummary(options.wbAccountId, options.dateFrom, options.dateTo)
  const [reviewProducts, questionProducts] = await Promise.all([
    prisma.productReview.findMany({
      where: { wbAccountId: options.wbAccountId },
      select: { nmId: true, vendorCode: true, productName: true },
      distinct: ['nmId'],
      orderBy: { nmId: 'asc' },
    }),
    prisma.productQuestion.findMany({
      where: { wbAccountId: options.wbAccountId },
      select: { nmId: true, vendorCode: true, productName: true },
      distinct: ['nmId'],
      orderBy: { nmId: 'asc' },
    }),
  ])

  const products = Array.from(
    new Map(
      [...reviewProducts, ...questionProducts]
        .filter((row) => row.nmId > 0)
        .map((row) => [
          row.nmId,
          {
            nmId: row.nmId,
            label: row.vendorCode || row.productName || `WB ${row.nmId}`,
          },
        ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, 'ru'))

  if (options.tab === 'questions') {
    const where = questionWhere(options)
    const [total, rows] = await Promise.all([
      prisma.productQuestion.count({ where }),
      prisma.productQuestion.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: questionOrderBy(options.sortBy, options.sortDir),
        include: { product: { select: { photoUrl: true } } },
      }),
    ])

    return {
      summary,
      reviews: [],
      questions: rows.map(mapQuestionRow),
      products,
      total,
      page,
      pageSize,
    }
  }

  const where = reviewWhere(options)
  const [total, rows] = await Promise.all([
    prisma.productReview.count({ where }),
    prisma.productReview.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: reviewOrderBy(options.sortBy, options.sortDir),
      include: { product: { select: { photoUrl: true } } },
    }),
  ])

  return {
    summary,
    reviews: rows.map(mapReviewRow),
    questions: [],
    products,
    total,
    page,
    pageSize,
  }
}

export async function getUnansweredReviewTargetsByFilter(options: Omit<GetFeedbackOptions, 'tab' | 'page' | 'pageSize'>) {
  const where = reviewWhere({
    ...options,
    tab: 'reviews',
    page: 1,
    pageSize: 100,
    answerStatus: 'unanswered',
  })

  return prisma.productReview.findMany({
    where: { ...where, isAnswered: false },
    select: {
      id: true,
      externalId: true,
      rating: true,
    },
    orderBy: reviewOrderBy(options.sortBy, options.sortDir),
  })
}
