import type { WbApiClient } from './client'
import type {
  WbFeedbackReview,
  WbFeedbackResponse,
  WbFeedbacksListResponse,
  WbFeedbackQuestion,
  WbQuestionResponse,
  WbQuestionsListResponse,
} from '@/types/feedback'

interface FetchFeedbackListParams {
  isAnswered: boolean
  take: number
  skip: number
  order?: 'dateAsc' | 'dateDesc'
  dateFrom?: number
  dateTo?: number
  nmId?: number
}

function buildParams(params: FetchFeedbackListParams): Record<string, string> {
  return {
    isAnswered: String(params.isAnswered),
    take: String(params.take),
    skip: String(params.skip),
    order: params.order ?? 'dateDesc',
    ...(params.dateFrom ? { dateFrom: String(params.dateFrom) } : {}),
    ...(params.dateTo ? { dateTo: String(params.dateTo) } : {}),
    ...(params.nmId ? { nmId: String(params.nmId) } : {}),
  }
}

function assertWbEnvelope(resp: { error?: boolean; errorText?: string }) {
  if (resp.error) {
    throw new Error(resp.errorText || 'WB feedbacks API returned an error')
  }
}

export async function fetchWbFeedbacks(
  client: WbApiClient,
  params: FetchFeedbackListParams,
): Promise<WbFeedbackReview[]> {
  const resp = await client.get<WbFeedbacksListResponse>(
    'feedbacks',
    '/api/v1/feedbacks',
    buildParams(params),
  )
  assertWbEnvelope(resp)
  return resp.data?.feedbacks ?? []
}

export async function fetchWbQuestions(
  client: WbApiClient,
  params: FetchFeedbackListParams,
): Promise<WbFeedbackQuestion[]> {
  const resp = await client.get<WbQuestionsListResponse>(
    'feedbacks',
    '/api/v1/questions',
    buildParams(params),
  )
  assertWbEnvelope(resp)
  return resp.data?.questions ?? []
}

export async function fetchWbFeedbackById(
  client: WbApiClient,
  id: string,
): Promise<WbFeedbackReview | null> {
  const resp = await client.get<WbFeedbackResponse>(
    'feedbacks',
    '/api/v1/feedback',
    { id },
  )
  assertWbEnvelope(resp)
  return resp.data ?? null
}

export async function fetchWbQuestionById(
  client: WbApiClient,
  id: string,
): Promise<WbFeedbackQuestion | null> {
  const resp = await client.get<WbQuestionResponse>(
    'feedbacks',
    '/api/v1/question',
    { id },
  )
  assertWbEnvelope(resp)
  return resp.data ?? null
}

export async function answerWbFeedback(
  client: WbApiClient,
  params: { id: string; text: string; edit: boolean },
): Promise<void> {
  const body = { id: params.id, text: params.text }
  if (params.edit) {
    await client.patch<null>('feedbacks', '/api/v1/feedbacks/answer', body)
    return
  }

  await client.post<null>('feedbacks', '/api/v1/feedbacks/answer', body)
}

export async function answerWbQuestion(
  client: WbApiClient,
  params: { id: string; text: string },
): Promise<void> {
  await client.patch<unknown>('feedbacks', '/api/v1/questions', {
    id: params.id,
    text: params.text,
    state: 'wbRu',
  })
}
