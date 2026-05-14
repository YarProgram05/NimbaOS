export type FeedbackTab = 'reviews' | 'questions'
export type FeedbackAnswerFilter = 'all' | 'answered' | 'unanswered'
export type FeedbackRatingFilter = 'all' | '1' | '2' | '3' | '4' | '5'
export type FeedbackSortBy =
  | 'createdDate'
  | 'rating'
  | 'nmId'
  | 'vendorCode'
  | 'productName'
  | 'isAnswered'
  | 'wasViewed'
export type FeedbackSortDir = 'asc' | 'desc'

export interface WbFeedbackProductDetails {
  imtId?: number
  nmId?: number
  productName?: string
  supplierArticle?: string
  supplierName?: string
  brandName?: string
}

export interface WbFeedbackAnswer {
  text?: string
  state?: string
  editable?: boolean
  createDate?: string
}

export interface WbFeedbackReview {
  id: string
  text?: string | null
  pros?: string | null
  cons?: string | null
  productValuation: number
  createdDate: string
  answer?: WbFeedbackAnswer | null
  state?: string | null
  productDetails?: WbFeedbackProductDetails | null
  photoLinks?: unknown
  video?: unknown
}

export interface WbFeedbackQuestion {
  id: string
  text: string
  createdDate: string
  state?: string | null
  answer?: WbFeedbackAnswer | null
  productDetails?: WbFeedbackProductDetails | null
  wasViewed?: boolean
  isWarned?: boolean
}

export interface WbFeedbacksListResponse {
  data?: {
    countUnanswered?: number
    countArchive?: number
    feedbacks?: WbFeedbackReview[]
  }
  error?: boolean
  errorText?: string
  additionalErrors?: unknown
}

export interface WbQuestionsListResponse {
  data?: {
    countUnanswered?: number
    countArchive?: number
    questions?: WbFeedbackQuestion[]
  }
  error?: boolean
  errorText?: string
  additionalErrors?: unknown
}

export interface WbFeedbackResponse {
  data?: WbFeedbackReview
  error?: boolean
  errorText?: string
  additionalErrors?: unknown
}

export interface WbQuestionResponse {
  data?: WbFeedbackQuestion
  error?: boolean
  errorText?: string
  additionalErrors?: unknown
}

export interface FeedbackSyncResult {
  totalRows: number
  upserted: number
  answeredRows: number
  unansweredRows: number
  pages: number
  errors: number
  durationMs: number
  dateFrom: string
  dateTo: string
  syncedAt: string
}

export interface FeedbackSummary {
  status: 'ready' | 'missing'
  syncedAt: string | null
  averageRating: number | null
  reviewsTotal: number
  reviewsNew: number
  negativeReviews: number
  unansweredReviews: number
  questionsTotal: number
  questionsNew: number
  unansweredQuestions: number
  urgentItems: FeedbackWorkloadItem[]
}

export interface FeedbackWorkloadItem {
  id: string
  type: FeedbackTab
  externalId: string
  nmId: number
  vendorCode: string | null
  productName: string | null
  brandName: string | null
  text: string
  rating: number | null
  isAnswered: boolean
  createdDate: string
}

export interface FeedbackReviewRow extends FeedbackWorkloadItem {
  type: 'reviews'
  pros: string | null
  cons: string | null
  answerText: string | null
  answerEditable: boolean | null
  photoUrl: string | null
}

export interface FeedbackQuestionRow extends FeedbackWorkloadItem {
  type: 'questions'
  wasViewed: boolean
  isWarned: boolean
  answerText: string | null
  answerEditable: boolean | null
  photoUrl: string | null
}

export interface PaginatedFeedback {
  summary: FeedbackSummary
  reviews: FeedbackReviewRow[]
  questions: FeedbackQuestionRow[]
  products: Array<{ nmId: number; label: string }>
  total: number
  page: number
  pageSize: number
}

export interface GetFeedbackOptions {
  wbAccountId: string
  tab: FeedbackTab
  page: number
  pageSize: number
  search?: string
  rating?: FeedbackRatingFilter
  answerStatus?: FeedbackAnswerFilter
  nmId?: number
  dateFrom?: string
  dateTo?: string
  sortBy?: FeedbackSortBy
  sortDir?: FeedbackSortDir
}

export interface FeedbackWriteLogRow {
  id: string
  kind: 'REVIEW_ANSWER_CREATE' | 'REVIEW_ANSWER_UPDATE' | 'QUESTION_ANSWER_UPSERT'
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  entityType: string
  externalId: string
  answerText: string
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface FeedbackWriteResult {
  total: number
  succeeded: number
  failed: number
  logs: FeedbackWriteLogRow[]
}
