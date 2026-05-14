import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { WbApiClient } from '@/lib/wb-api/client'
import {
  fetchWbFeedbackById,
  fetchWbFeedbacks,
  fetchWbQuestionById,
  fetchWbQuestions,
} from '@/lib/wb-api/feedbacks'
import type {
  FeedbackSyncResult,
  WbFeedbackProductDetails,
  WbFeedbackQuestion,
  WbFeedbackReview,
} from '@/types/feedback'

const REVIEWS_PAGE_SIZE = 5000
const QUESTIONS_PAGE_SIZE = 10000

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

function toUnixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000)
}

function resolvePeriod(dateFrom?: string, dateTo?: string, rollingDays = 7) {
  if (dateFrom && dateTo) {
    return { dateFrom, dateTo }
  }

  const today = parseDateKey(formatDateKey(new Date()))
  return {
    dateFrom: formatDateKey(addDays(today, -(rollingDays - 1))),
    dateTo: formatDateKey(today),
  }
}

function parseWbDate(value: string): Date {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function normalizeText(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

function answerText(value: { answer?: { text?: string | null } | null }): string | null {
  return normalizeText(value.answer?.text ?? null)
}

function productSnapshot(details: WbFeedbackProductDetails | null | undefined) {
  return details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull
}

function jsonOrNull(value: unknown) {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
}

function mediaPresent(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

async function loadProductMap(wbAccountId: string, nmIds: number[]) {
  const products = await prisma.product.findMany({
    where: { wbAccountId, nmId: { in: Array.from(new Set(nmIds)) } },
    select: { id: true, nmId: true },
  })
  return new Map(products.map((product) => [product.nmId, product.id]))
}

function emptyResult(dateFrom: string, dateTo: string, syncedAt: Date): FeedbackSyncResult {
  return {
    totalRows: 0,
    upserted: 0,
    answeredRows: 0,
    unansweredRows: 0,
    pages: 0,
    errors: 0,
    durationMs: 0,
    dateFrom,
    dateTo,
    syncedAt: syncedAt.toISOString(),
  }
}

export async function syncReviews(
  wbAccountId: string,
  requested: { dateFrom?: string; dateTo?: string; rollingDays?: number } = {},
): Promise<FeedbackSyncResult> {
  const startMs = Date.now()
  const syncedAt = new Date()
  const { dateFrom, dateTo } = resolvePeriod(requested.dateFrom, requested.dateTo, requested.rollingDays)
  const result = emptyResult(dateFrom, dateTo, syncedAt)
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))
  const fromTs = toUnixSeconds(parseDateKey(dateFrom))
  const toTs = toUnixSeconds(addDays(parseDateKey(dateTo), 1)) - 1
  const rows: Array<{ row: WbFeedbackReview; isAnswered: boolean }> = []

  for (const isAnswered of [false, true]) {
    let skip = 0
    do {
      const page = await fetchWbFeedbacks(client, {
        isAnswered,
        take: REVIEWS_PAGE_SIZE,
        skip,
        order: 'dateDesc',
        dateFrom: fromTs,
        dateTo: toTs,
      })
      result.pages++
      rows.push(...page.map((row) => ({ row, isAnswered })))
      if (page.length < REVIEWS_PAGE_SIZE) break
      skip += REVIEWS_PAGE_SIZE
    } while (true)
  }

  const productByNmId = await loadProductMap(
    wbAccountId,
    rows.map(({ row }) => row.productDetails?.nmId).filter((value): value is number => typeof value === 'number'),
  )

  for (const { row, isAnswered } of rows) {
    const detail = isAnswered && !answerText(row)
      ? await fetchWbFeedbackById(client, row.id).catch(() => null)
      : null
    const source = detail ?? row
    const details = source.productDetails
    const nmId = details?.nmId ?? 0
    const answer = answerText(source)
    const hasMedia = mediaPresent(source.photoLinks) || mediaPresent(source.video)

    await prisma.productReview.upsert({
      where: { wbAccountId_externalId: { wbAccountId, externalId: row.id } },
      create: {
        wbAccountId,
        externalId: row.id,
        nmId,
        rating: source.productValuation ?? 0,
        text: normalizeText(source.text),
        pros: normalizeText(source.pros),
        cons: normalizeText(source.cons),
        state: source.state ?? null,
        answerText: answer,
        answerState: source.answer?.state ?? null,
        answerEditable: source.answer?.editable ?? null,
        isAnswered: isAnswered || Boolean(answer),
        hasMedia,
        photos: jsonOrNull(source.photoLinks),
        videos: jsonOrNull(source.video),
        productId: productByNmId.get(nmId) ?? null,
        vendorCode: details?.supplierArticle ?? null,
        productName: details?.productName ?? null,
        brandName: details?.brandName ?? null,
        supplierName: details?.supplierName ?? null,
        productSnapshot: productSnapshot(details),
        createdDate: parseWbDate(source.createdDate),
        fetchedAt: syncedAt,
      },
      update: {
        nmId,
        rating: source.productValuation ?? 0,
        text: normalizeText(source.text),
        pros: normalizeText(source.pros),
        cons: normalizeText(source.cons),
        state: source.state ?? null,
        answerText: answer,
        answerState: source.answer?.state ?? null,
        answerEditable: source.answer?.editable ?? null,
        isAnswered: isAnswered || Boolean(answer),
        hasMedia,
        photos: jsonOrNull(source.photoLinks),
        videos: jsonOrNull(source.video),
        productId: productByNmId.get(nmId) ?? null,
        vendorCode: details?.supplierArticle ?? null,
        productName: details?.productName ?? null,
        brandName: details?.brandName ?? null,
        supplierName: details?.supplierName ?? null,
        productSnapshot: productSnapshot(details),
        createdDate: parseWbDate(source.createdDate),
        fetchedAt: syncedAt,
      },
    })

    result.upserted++
    if (isAnswered || answer) result.answeredRows++
    else result.unansweredRows++
  }

  await prisma.wbAccount.update({
    where: { id: wbAccountId },
    data: { lastSyncAt: syncedAt },
  })

  result.totalRows = rows.length
  result.durationMs = Date.now() - startMs
  return result
}

export async function syncQuestions(
  wbAccountId: string,
  requested: { dateFrom?: string; dateTo?: string; rollingDays?: number } = {},
): Promise<FeedbackSyncResult> {
  const startMs = Date.now()
  const syncedAt = new Date()
  const { dateFrom, dateTo } = resolvePeriod(requested.dateFrom, requested.dateTo, requested.rollingDays)
  const result = emptyResult(dateFrom, dateTo, syncedAt)
  const account = await prisma.wbAccount.findUniqueOrThrow({
    where: { id: wbAccountId },
    select: { apiKey: true },
  })
  const client = new WbApiClient(decrypt(account.apiKey))
  const fromTs = toUnixSeconds(parseDateKey(dateFrom))
  const toTs = toUnixSeconds(addDays(parseDateKey(dateTo), 1)) - 1
  const rows: Array<{ row: WbFeedbackQuestion; isAnswered: boolean }> = []

  for (const isAnswered of [false, true]) {
    let skip = 0
    do {
      const page = await fetchWbQuestions(client, {
        isAnswered,
        take: QUESTIONS_PAGE_SIZE,
        skip,
        order: 'dateDesc',
        dateFrom: fromTs,
        dateTo: toTs,
      })
      result.pages++
      rows.push(...page.map((row) => ({ row, isAnswered })))
      if (page.length < QUESTIONS_PAGE_SIZE) break
      skip += QUESTIONS_PAGE_SIZE
    } while (true)
  }

  const productByNmId = await loadProductMap(
    wbAccountId,
    rows.map(({ row }) => row.productDetails?.nmId).filter((value): value is number => typeof value === 'number'),
  )

  for (const { row, isAnswered } of rows) {
    const detail = isAnswered && !answerText(row)
      ? await fetchWbQuestionById(client, row.id).catch(() => null)
      : null
    const source = detail ?? row
    const details = source.productDetails
    const nmId = details?.nmId ?? 0
    const answer = answerText(source)

    await prisma.productQuestion.upsert({
      where: { wbAccountId_externalId: { wbAccountId, externalId: row.id } },
      create: {
        wbAccountId,
        externalId: row.id,
        nmId,
        text: source.text,
        state: source.state ?? null,
        wasViewed: source.wasViewed ?? false,
        isWarned: source.isWarned ?? false,
        answerText: answer,
        answerEditable: source.answer?.editable ?? null,
        answerCreatedDate: source.answer?.createDate ? parseWbDate(source.answer.createDate) : null,
        isAnswered: isAnswered || Boolean(answer),
        productId: productByNmId.get(nmId) ?? null,
        vendorCode: details?.supplierArticle ?? null,
        productName: details?.productName ?? null,
        brandName: details?.brandName ?? null,
        supplierName: details?.supplierName ?? null,
        productSnapshot: productSnapshot(details),
        createdDate: parseWbDate(source.createdDate),
        fetchedAt: syncedAt,
      },
      update: {
        nmId,
        text: source.text,
        state: source.state ?? null,
        wasViewed: source.wasViewed ?? false,
        isWarned: source.isWarned ?? false,
        answerText: answer,
        answerEditable: source.answer?.editable ?? null,
        answerCreatedDate: source.answer?.createDate ? parseWbDate(source.answer.createDate) : null,
        isAnswered: isAnswered || Boolean(answer),
        productId: productByNmId.get(nmId) ?? null,
        vendorCode: details?.supplierArticle ?? null,
        productName: details?.productName ?? null,
        brandName: details?.brandName ?? null,
        supplierName: details?.supplierName ?? null,
        productSnapshot: productSnapshot(details),
        createdDate: parseWbDate(source.createdDate),
        fetchedAt: syncedAt,
      },
    })

    result.upserted++
    if (isAnswered || answer) result.answeredRows++
    else result.unansweredRows++
  }

  await prisma.wbAccount.update({
    where: { id: wbAccountId },
    data: { lastSyncAt: syncedAt },
  })

  result.totalRows = rows.length
  result.durationMs = Date.now() - startMs
  return result
}
