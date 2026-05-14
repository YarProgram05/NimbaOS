'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { ArrowUpDown, MessageSquareText, RefreshCw, Search, Star, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WbArticleLink } from '@/components/wb-article-link'
import { syncQuestionsAction, syncReviewsAction } from '@/lib/actions/feedback'
import type {
  FeedbackAnswerFilter,
  FeedbackRatingFilter,
  FeedbackSortBy,
  FeedbackSortDir,
  FeedbackTab,
  PaginatedFeedback,
} from '@/types/feedback'

interface ReviewsClientProps {
  data: PaginatedFeedback
  wbAccountId: string
  currentTab: FeedbackTab
  currentSearch: string
  currentRating: FeedbackRatingFilter
  currentAnswerStatus: FeedbackAnswerFilter
  currentNmId: string
  currentDateFrom: string
  currentDateTo: string
  currentPage: number
  currentSortBy: FeedbackSortBy
  currentSortDir: FeedbackSortDir
}

const ANSWER_LABELS: Record<FeedbackAnswerFilter, string> = {
  all: 'Все статусы',
  answered: 'С ответом',
  unanswered: 'Без ответа',
}

const RATING_LABELS: Record<FeedbackRatingFilter, string> = {
  all: 'Все оценки',
  '1': '1 звезда',
  '2': '2 звезды',
  '3': '3 звезды',
  '4': '4 звезды',
  '5': '5 звезд',
}

export function ReviewsClient({
  data,
  wbAccountId,
  currentTab,
  currentSearch,
  currentRating,
  currentAnswerStatus,
  currentNmId,
  currentDateFrom,
  currentDateTo,
  currentPage,
  currentSortBy,
  currentSortDir,
}: ReviewsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentSearch)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date()
    return {
      from: currentDateFrom ? new Date(currentDateFrom) : subDays(today, 6),
      to: currentDateTo ? new Date(currentDateTo) : today,
    }
  })
  const [syncing, startSync] = useTransition()
  const totalPages = Math.ceil(data.total / data.pageSize)
  const selectedDateFrom = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  const selectedDateTo = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : selectedDateFrom

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('account', wbAccountId)
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === '') params.delete(key)
      else params.set(key, String(value))
    }
    return `${pathname}?${params.toString()}`
  }

  function submitFilters(event: React.FormEvent) {
    event.preventDefault()
    router.push(buildUrl({
      search: search || undefined,
      dateFrom: selectedDateFrom,
      dateTo: selectedDateTo,
      page: 1,
    }))
  }

  function switchTab(tab: FeedbackTab) {
    router.push(buildUrl({ tab, page: 1, rating: tab === 'questions' ? undefined : currentRating }))
  }

  function handleDateRangeChange(range: DateRange) {
    if (!range.from) return
    const nextRange = { from: range.from, to: range.to ?? range.from }
    setDateRange(nextRange)
    router.push(buildUrl({
      dateFrom: format(nextRange.from, 'yyyy-MM-dd'),
      dateTo: format(nextRange.to, 'yyyy-MM-dd'),
      page: 1,
    }))
  }

  function handleSync(kind: FeedbackTab) {
    startSync(async () => {
      const result = kind === 'reviews'
        ? await syncReviewsAction(wbAccountId, selectedDateFrom, selectedDateTo)
        : await syncQuestionsAction(wbAccountId, selectedDateFrom, selectedDateTo)

      if (result.success) {
        toast.success(`Задача поставлена в фон: ${result.data.id}`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function toggleSort(sortBy: FeedbackSortBy) {
    const nextDir = currentSortBy === sortBy && currentSortDir === 'asc' ? 'desc' : 'asc'
    router.push(buildUrl({ sortBy, sortDir: nextDir, page: 1 }))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FeedbackMetric label="Средняя оценка" value={formatOptionalRating(data.summary.averageRating)} icon="star" />
        <FeedbackMetric label="Новых отзывов" value={formatNumber(data.summary.reviewsNew)} />
        <FeedbackMetric label="Негативных" value={formatNumber(data.summary.negativeReviews)} tone="bad" />
        <FeedbackMetric label="Отзывы без ответа" value={formatNumber(data.summary.unansweredReviews)} tone="warn" />
        <FeedbackMetric label="Вопросы без ответа" value={formatNumber(data.summary.unansweredQuestions)} tone="warn" />
      </section>

      <div className="old-money-panel flex shrink-0 flex-wrap items-center gap-3 rounded-md p-3">
        <div className="flex rounded-md border bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => switchTab('reviews')}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${currentTab === 'reviews' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Отзывы
          </button>
          <button
            type="button"
            onClick={() => switchTab('questions')}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${currentTab === 'questions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Вопросы
          </button>
        </div>

        <form onSubmit={submitFilters} className="flex w-full flex-wrap gap-2 xl:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Текст, артикул или товар..."
              className="w-full pl-8 sm:w-64"
            />
          </div>
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} className="w-full sm:w-auto" />
          <Button type="submit" variant="outline" size="sm">Найти</Button>
          {currentSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                router.push(buildUrl({ search: undefined, page: 1 }))
              }}
            >
              Сбросить
            </Button>
          )}
        </form>

        <Select
          value={currentAnswerStatus}
          onValueChange={(value) => router.push(buildUrl({ answerStatus: value === 'all' ? undefined : value, page: 1 }))}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Статус ответа" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ANSWER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentTab === 'reviews' && (
          <Select
            value={currentRating}
            onValueChange={(value) => router.push(buildUrl({ rating: value === 'all' ? undefined : value, page: 1 }))}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Оценка" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={currentNmId || '__all__'}
          onValueChange={(value) => router.push(buildUrl({ nmId: value === '__all__' ? undefined : value, page: 1 }))}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Товар" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все товары</SelectItem>
            {data.products.map((product) => (
              <SelectItem key={product.nmId} value={String(product.nmId)}>
                {product.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <Button onClick={() => handleSync('reviews')} disabled={syncing} size="sm" variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Отзывы
          </Button>
          <Button onClick={() => handleSync('questions')} disabled={syncing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Вопросы
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Всего строк: <span className="font-medium text-foreground">{formatNumber(data.total)}</span>
        </span>
        <span>{data.summary.syncedAt ? `Обновлено ${formatDateTime(data.summary.syncedAt)}` : 'Отзывы и вопросы еще не синхронизированы'}</span>
      </div>

      {data.summary.status === 'missing' ? (
        <section className="old-money-panel flex flex-col items-center justify-center rounded-md p-10 text-center">
          <MessageSquareText className="mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Нет сохраненной обратной связи</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Запустите синхронизацию отзывов и вопросов. Модуль только читает данные WB и не отправляет ответы покупателям.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => handleSync('reviews')} disabled={syncing} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Синхронизировать отзывы
            </Button>
            <Button onClick={() => handleSync('questions')} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Синхронизировать вопросы
            </Button>
          </div>
        </section>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-card">
          {currentTab === 'reviews'
            ? <ReviewsTable rows={data.reviews} currentSortBy={currentSortBy} onSort={toggleSort} />
            : <QuestionsTable rows={data.questions} currentSortBy={currentSortBy} onSort={toggleSort} />}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">Страница {currentPage} из {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
          >
            Вперед
          </Button>
        </div>
      )}
    </div>
  )
}

function ReviewsTable({
  rows,
  currentSortBy,
  onSort,
}: {
  rows: PaginatedFeedback['reviews']
  currentSortBy: FeedbackSortBy
  onSort: (sortBy: FeedbackSortBy) => void
}) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null)

  function toggleCell(key: string) {
    setExpandedCell((current) => (current === key ? null : key))
  }

  return (
    <table className="min-w-[1180px] w-full">
      <thead className="sticky top-0 z-20 border-b bg-muted">
        <tr>
          <SortableHead label="Дата" sortBy="createdDate" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="Оценка" sortBy="rating" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="WB" sortBy="nmId" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="Артикул" sortBy="vendorCode" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="Товар" sortBy="productName" currentSortBy={currentSortBy} onSort={onSort} />
          <th className="px-4 py-3 text-left font-medium">Отзыв</th>
          <th className="px-4 py-3 text-left font-medium">Ответ</th>
          <SortableHead label="Статус" sortBy="isAnswered" currentSortBy={currentSortBy} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t hover:bg-muted/30">
            <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(row.createdDate)}</td>
            <td className="px-4 py-2.5"><Rating value={row.rating ?? 0} /></td>
            <td className="px-4 py-2.5"><WbArticleLink nmId={row.nmId} photoUrl={row.photoUrl} /></td>
            <td className="px-4 py-2.5 font-medium">{row.vendorCode ?? '—'}</td>
            <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">
              <ExpandableText
                value={row.productName ?? row.brandName ?? '—'}
                expanded={expandedCell === `${row.id}:product`}
                onToggle={() => toggleCell(`${row.id}:product`)}
              />
            </td>
            <td className="max-w-[360px] px-4 py-2.5">
              <ExpandableText
                value={row.text || 'Без текста'}
                expanded={expandedCell === `${row.id}:text`}
                onToggle={() => toggleCell(`${row.id}:text`)}
              />
              {(row.pros || row.cons) && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[row.pros ? `Плюсы: ${row.pros}` : '', row.cons ? `Минусы: ${row.cons}` : ''].filter(Boolean).join(' · ')}
                </p>
              )}
            </td>
            <td className="max-w-[280px] px-4 py-2.5 text-muted-foreground">
              <ExpandableText
                value={row.answerText ?? '—'}
                expanded={expandedCell === `${row.id}:answer`}
                onToggle={() => toggleCell(`${row.id}:answer`)}
              />
            </td>
            <td className="px-4 py-2.5"><AnswerBadge answered={row.isAnswered} /></td>
          </tr>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={8} />}
      </tbody>
    </table>
  )
}

function QuestionsTable({
  rows,
  currentSortBy,
  onSort,
}: {
  rows: PaginatedFeedback['questions']
  currentSortBy: FeedbackSortBy
  onSort: (sortBy: FeedbackSortBy) => void
}) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null)

  function toggleCell(key: string) {
    setExpandedCell((current) => (current === key ? null : key))
  }

  return (
    <table className="min-w-[1080px] w-full">
      <thead className="sticky top-0 z-20 border-b bg-muted">
        <tr>
          <SortableHead label="Дата" sortBy="createdDate" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="WB" sortBy="nmId" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="Артикул" sortBy="vendorCode" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="Товар" sortBy="productName" currentSortBy={currentSortBy} onSort={onSort} />
          <th className="px-4 py-3 text-left font-medium">Вопрос</th>
          <th className="px-4 py-3 text-left font-medium">Ответ</th>
          <SortableHead label="Просмотр" sortBy="wasViewed" currentSortBy={currentSortBy} onSort={onSort} />
          <SortableHead label="Статус" sortBy="isAnswered" currentSortBy={currentSortBy} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t hover:bg-muted/30">
            <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(row.createdDate)}</td>
            <td className="px-4 py-2.5"><WbArticleLink nmId={row.nmId} photoUrl={row.photoUrl} /></td>
            <td className="px-4 py-2.5 font-medium">{row.vendorCode ?? '—'}</td>
            <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">
              <ExpandableText
                value={row.productName ?? row.brandName ?? '—'}
                expanded={expandedCell === `${row.id}:product`}
                onToggle={() => toggleCell(`${row.id}:product`)}
              />
            </td>
            <td className="max-w-[360px] px-4 py-2.5">
              <ExpandableText
                value={row.text}
                expanded={expandedCell === `${row.id}:text`}
                onToggle={() => toggleCell(`${row.id}:text`)}
              />
            </td>
            <td className="max-w-[280px] px-4 py-2.5 text-muted-foreground">
              <ExpandableText
                value={row.answerText ?? '—'}
                expanded={expandedCell === `${row.id}:answer`}
                onToggle={() => toggleCell(`${row.id}:answer`)}
              />
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{row.wasViewed ? 'Да' : 'Нет'}</td>
            <td className="px-4 py-2.5"><AnswerBadge answered={row.isAnswered} /></td>
          </tr>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={8} />}
      </tbody>
    </table>
  )
}

function SortableHead({
  label,
  sortBy,
  currentSortBy,
  onSort,
}: {
  label: string
  sortBy: FeedbackSortBy
  currentSortBy: FeedbackSortBy
  onSort: (sortBy: FeedbackSortBy) => void
}) {
  return (
    <th className="px-4 py-3 text-left font-medium">
      <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(sortBy)}>
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${currentSortBy === sortBy ? 'text-primary' : 'text-muted-foreground'}`} />
      </button>
    </th>
  )
}

function ExpandableText({
  value,
  expanded,
  onToggle,
}: {
  value: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="block w-full text-left"
      title={expanded ? 'Свернуть' : 'Раскрыть'}
    >
      <span className={expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2 break-words'}>
        {value}
      </span>
    </button>
  )
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        Нет строк под выбранные фильтры
      </td>
    </tr>
  )
}

function FeedbackMetric({
  label,
  value,
  tone = 'neutral',
  icon = 'message',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'warn' | 'bad'
  icon?: 'message' | 'star'
}) {
  const Icon = icon === 'star' ? Star : tone === 'bad' ? TriangleAlert : MessageSquareText
  return (
    <div className="old-money-panel rounded-md p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="metric-label">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className={`mt-2 text-xl font-semibold tracking-tight ${tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  )
}

function Rating({ value }: { value: number }) {
  return (
    <span className={value <= 3 ? 'font-semibold text-destructive' : 'font-semibold'}>
      {value || '—'}
    </span>
  )
}

function AnswerBadge({ answered }: { answered: boolean }) {
  const className = answered
    ? 'border-border bg-secondary text-secondary-foreground'
    : 'border-amber-600/40 bg-amber-50 text-amber-700'

  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{answered ? 'С ответом' : 'Без ответа'}</span>
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

function formatOptionalRating(value: number | null): string {
  return value === null ? 'Нет данных' : new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

