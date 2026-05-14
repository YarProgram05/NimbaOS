import type {
  DashboardFreshnessItem,
  DashboardInsight,
  DashboardIssue,
  DashboardIssueCategory,
  DashboardIssueSeverity,
  DashboardSummary,
  DashboardValueStatus,
} from '@/types/dashboard'
import type { FeedbackSummary } from '@/types/feedback'
import type { StocksSummary } from '@/types/stocks'

type ProblemRow = {
  nmId: number
  vendorCode: string
  sale: string
  operatingProfit: string
  drr: string
  costPrice: string
  boughtWithReturns: number
}

interface BuildDashboardProblemCenterInput {
  accountId: string
  dateFrom: string
  dateTo: string
  financialStatus: DashboardValueStatus
  reportRowsCount: number
  reportRows: ProblemRow[]
  stocks: StocksSummary
  feedback: FeedbackSummary
  freshnessItems: DashboardFreshnessItem[]
  generatedAt: string
}

export function buildDashboardProblemCenter(
  input: BuildDashboardProblemCenterInput,
): DashboardSummary['problemCenter'] {
  const issues = [
    ...buildFreshnessIssues(input),
    ...buildReportAvailabilityIssues(input),
    ...buildProductIssues(input),
    ...buildStockIssues(input),
    ...buildFeedbackIssues(input),
  ]
    .sort(compareIssues)
    .slice(0, 50)

  const insights = buildDashboardInsights(issues, input.generatedAt).slice(0, 6)
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length
  const infoCount = issues.filter((issue) => issue.severity === 'info').length

  return {
    status: criticalCount > 0 ? 'missing' : warningCount > 0 ? 'partial' : 'ready',
    criticalCount,
    warningCount,
    infoCount,
    issues,
    insights,
  }
}

function buildFeedbackIssues(input: BuildDashboardProblemCenterInput): DashboardIssue[] {
  if (input.feedback.status === 'missing') {
    return [
      {
        id: 'feedback-missing',
        category: 'unanswered_review_question',
        severity: 'warning',
        title: 'Синхронизировать отзывы и вопросы',
        description: 'Нет сохраненной обратной связи покупателей, поэтому dashboard не видит негативные отзывы и вопросы без ответа.',
        href: feedbackHref(input),
        source: 'ProductReview + ProductQuestion',
        metricLabel: 'Данные',
        metricValue: 'нет',
        entityId: null,
        entityLabel: null,
        createdAt: input.generatedAt,
      },
    ]
  }

  const issues: DashboardIssue[] = []
  if (input.feedback.unansweredReviews > 0) {
    issues.push({
      id: 'unanswered-reviews',
      category: 'unanswered_review_question',
      severity: input.feedback.unansweredReviews >= 10 ? 'critical' : 'warning',
      title: 'Есть отзывы без ответа',
      description: 'Проверьте необработанные отзывы. В этой фазе NimbaOS только показывает очередь и не отправляет ответы в WB.',
      href: `${feedbackHref(input)}&tab=reviews&answerStatus=unanswered`,
      source: 'ProductReview',
      metricLabel: 'Без ответа',
      metricValue: String(input.feedback.unansweredReviews),
      entityId: null,
      entityLabel: null,
      createdAt: input.generatedAt,
    })
  }

  if (input.feedback.unansweredQuestions > 0) {
    issues.push({
      id: 'unanswered-questions',
      category: 'unanswered_review_question',
      severity: input.feedback.unansweredQuestions >= 10 ? 'critical' : 'warning',
      title: 'Есть вопросы без ответа',
      description: 'Вопросы покупателей ждут обработки. Откройте очередь, чтобы не терять спрос по карточкам.',
      href: `${feedbackHref(input)}&tab=questions&answerStatus=unanswered`,
      source: 'ProductQuestion',
      metricLabel: 'Без ответа',
      metricValue: String(input.feedback.unansweredQuestions),
      entityId: null,
      entityLabel: null,
      createdAt: input.generatedAt,
    })
  }

  if (input.feedback.negativeReviews > 0) {
    issues.push({
      id: 'negative-reviews',
      category: 'unanswered_review_question',
      severity: input.feedback.negativeReviews >= 5 ? 'critical' : 'warning',
      title: 'Есть новые негативные отзывы',
      description: 'Отзывы с оценкой 1-3 за выбранный период стоит разобрать первыми: они влияют на доверие к карточкам.',
      href: `${feedbackHref(input)}&tab=reviews&rating=1`,
      source: 'ProductReview',
      metricLabel: 'Негативных',
      metricValue: String(input.feedback.negativeReviews),
      entityId: null,
      entityLabel: null,
      createdAt: input.generatedAt,
    })
  }

  return issues
}

function buildStockIssues(input: BuildDashboardProblemCenterInput): DashboardIssue[] {
  if (input.stocks.status === 'missing') {
    return [
      {
        id: 'stocks-missing',
        category: 'product_without_stock_data',
        severity: 'warning',
        title: 'Синхронизировать остатки WB',
        description: 'Нет актуального снимка остатков, поэтому dashboard не может показать дефицит, отсутствие товара и излишки.',
        href: stockHref(input),
        source: 'StockSnapshot',
        metricLabel: 'Снимок',
        metricValue: 'нет данных',
        entityId: null,
        entityLabel: null,
        createdAt: input.generatedAt,
      },
    ]
  }

  const issues: DashboardIssue[] = []
  const seen = new Set<number>()
  for (const item of input.stocks.items) {
    if (seen.has(item.nmId)) continue
    seen.add(item.nmId)
    const label = item.vendorCode || `WB ${item.nmId}`

    if (item.risk === 'out_of_stock') {
      issues.push({
        id: `out-of-stock:${item.nmId}`,
        category: 'out_of_stock',
        severity: 'critical',
        title: `Нет остатка: ${label}`,
        description: 'Товар отсутствует на складах WB. Проверьте поставку или исключите его из активного плана продаж.',
        href: stockHref(input),
        source: 'StockItem',
        metricLabel: 'Остаток',
        metricValue: '0 шт.',
        entityId: String(item.nmId),
        entityLabel: label,
        createdAt: input.generatedAt,
      })
    }

    if (item.risk === 'low_stock') {
      issues.push({
        id: `low-stock:${item.nmId}`,
        category: 'low_stock',
        severity: 'warning',
        title: `Низкий остаток: ${label}`,
        description: 'Остаток близок к нулю по текущему темпу продаж или ниже минимального порога.',
        href: stockHref(input),
        source: 'StockItem + WbSale',
        metricLabel: 'Остаток',
        metricValue: `${item.quantity} шт.`,
        entityId: String(item.nmId),
        entityLabel: label,
        createdAt: input.generatedAt,
      })
    }
  }

  return issues.slice(0, 20)
}

function buildFreshnessIssues(input: BuildDashboardProblemCenterInput): DashboardIssue[] {
  const issues: DashboardIssue[] = []

  for (const item of input.freshnessItems) {
    if (!item.implemented) continue

    if (item.failedJobs > 0) {
      const errorText = item.lastError ? ` Последняя ошибка: ${shortText(item.lastError, 220)}` : ''
      issues.push({
        id: `sync-failed:${item.key}`,
        category: 'sync_failed',
        severity: item.failedJobs > 2 ? 'critical' : 'warning',
        title: `Проверить сбой синхронизации: ${item.label}`,
        description: `${item.failedJobs} задач за последние 7 дней завершились ошибкой. Дашборд продолжает работать по доступным данным.${errorText}`,
        href: item.href,
        source: item.label,
        metricLabel: 'Ошибок',
        metricValue: String(item.failedJobs),
        entityId: item.key,
        entityLabel: item.label,
        createdAt: input.generatedAt,
      })
    }

    if (item.status === 'missing' || item.status === 'partial' || item.isStale) {
      issues.push({
        id: `data-stale:${item.key}`,
        category: 'data_stale',
        severity: item.severity,
        title: `Обновить данные: ${item.label}`,
        description: item.hint ?? 'Источник данных не покрывает выбранный период полностью.',
        href: item.href,
        source: item.label,
        metricLabel: item.isStale ? 'Свежесть' : item.status === 'partial' ? 'Покрытие' : 'Статус',
        metricValue: item.isStale ? 'устарело' : item.status === 'partial' ? 'частично' : 'нет данных',
        entityId: item.key,
        entityLabel: item.label,
        createdAt: input.generatedAt,
      })
    }
  }

  return issues
}

function buildReportAvailabilityIssues(input: BuildDashboardProblemCenterInput): DashboardIssue[] {
  if (input.financialStatus !== 'missing') return []

  return [
    {
      id: 'no-recent-report-data',
      category: 'no_recent_report_data',
      severity: 'critical',
      title: 'Загрузить финансовый отчет за период',
      description: 'Нет строк реализации за выбранный период, поэтому KPI, прибыль и товарные риски не должны подменяться нулями.',
      href: reportsHref(input),
      source: 'RealizationReport',
      metricLabel: 'Строк отчета',
      metricValue: String(input.reportRowsCount),
      entityId: null,
      entityLabel: null,
      createdAt: input.generatedAt,
    },
  ]
}

function buildProductIssues(input: BuildDashboardProblemCenterInput): DashboardIssue[] {
  if (input.financialStatus === 'missing') return []

  const issues: DashboardIssue[] = []
  const rows = input.reportRows
    .filter((row) => row.nmId > 0)
    .sort((a, b) => Number(a.operatingProfit) - Number(b.operatingProfit))

  for (const row of rows) {
    const label = row.vendorCode || `WB ${row.nmId}`
    const operatingProfit = Number(row.operatingProfit)
    const drr = Number(row.drr)
    const costPrice = Number(row.costPrice)
    const sale = Number(row.sale)

    if (costPrice === 0 && row.boughtWithReturns > 0) {
      issues.push({
        id: `missing-cost:${row.nmId}`,
        category: 'missing_cost_price',
        severity: 'warning',
        title: `Заполнить себестоимость: ${label}`,
        description: 'Товар участвовал в продажах, но в справочнике нет себестоимости. Прибыль и маржинальность могут быть искажены.',
        href: referencesHref(input),
        source: 'CostPrice',
        metricLabel: 'Выкуплено',
        metricValue: String(row.boughtWithReturns),
        entityId: String(row.nmId),
        entityLabel: label,
        createdAt: input.generatedAt,
      })
    }

    if (operatingProfit < 0) {
      issues.push({
        id: `negative-margin:${row.nmId}`,
        category: 'negative_margin',
        severity: operatingProfit < -5000 ? 'critical' : 'warning',
        title: `Разобрать отрицательную прибыль: ${label}`,
        description: 'Операционная прибыль ниже нуля. Проверьте цену, логистику, рекламу, возвраты и себестоимость.',
        href: reportsHref(input),
        source: 'Report calculator',
        metricLabel: 'ОП',
        metricValue: formatRub(operatingProfit),
        entityId: String(row.nmId),
        entityLabel: label,
        createdAt: input.generatedAt,
      })
    }

    if (sale > 0 && drr >= 20) {
      issues.push({
        id: `high-drr:${row.nmId}`,
        category: 'high_drr',
        severity: drr >= 35 ? 'critical' : 'warning',
        title: `Проверить высокий ДРР: ${label}`,
        description: 'Доля рекламных расходов высокая относительно выручки. Нужна проверка кампаний и ставок.',
        href: advertisingHref(input),
        source: 'AdCampaignNmStat',
        metricLabel: 'ДРР',
        metricValue: `${formatNumber(drr, 1)}%`,
        entityId: String(row.nmId),
        entityLabel: label,
        createdAt: input.generatedAt,
      })
    }
  }

  return issues.slice(0, 30)
}

function buildDashboardInsights(
  issues: DashboardIssue[],
  generatedAt: string,
): DashboardInsight[] {
  const grouped = new Map<DashboardIssueCategory, DashboardIssue[]>()

  for (const issue of issues) {
    const group = grouped.get(issue.category) ?? []
    group.push(issue)
    grouped.set(issue.category, group)
  }

  return Array.from(grouped.entries())
    .map(([category, group]) => {
      const sorted = group.sort(compareIssues)
      const lead = sorted[0]

      return {
        id: `insight:${category}`,
        category,
        severity: lead.severity,
        title: insightTitle(category, sorted.length, lead),
        description: insightDescription(category, sorted.length, lead),
        metric: insightMetric(category, sorted),
        href: lead.href,
        issueIds: sorted.map((issue) => issue.id),
        createdAt: generatedAt,
      }
    })
    .sort(compareInsights)
}

function insightTitle(category: DashboardIssueCategory, count: number, lead: DashboardIssue): string {
  if (category === 'sync_failed') return 'Есть сбои синхронизации'
  if (category === 'data_stale') return 'Обновить источники данных'
  if (category === 'missing_cost_price') return count === 1 ? lead.title : `Заполнить себестоимость: ${count} товаров`
  if (category === 'no_recent_report_data') return 'Нет свежего финансового отчета'
  if (category === 'high_drr') return count === 1 ? lead.title : `Высокий ДРР: ${count} товаров`
  if (category === 'negative_margin') return count === 1 ? lead.title : `Отрицательная прибыль: ${count} товаров`
  if (category === 'product_without_stock_data') return 'Нужны данные по остаткам'
  if (category === 'unanswered_review_question') return 'Есть необработанная обратная связь'
  if (category === 'low_stock') return 'Есть риск низкого остатка'
  return 'Есть товары без остатка'
}

function insightDescription(category: DashboardIssueCategory, count: number, lead: DashboardIssue): string {
  if (category === 'sync_failed') return `${count} источников требуют проверки после ошибок.`
  if (category === 'data_stale') return `${count} источников не покрывают выбранный период полностью.`
  if (category === 'missing_cost_price') return 'Сначала закройте себестоимость, иначе прибыль по товарам может врать.'
  if (category === 'no_recent_report_data') return lead.description
  if (category === 'high_drr') return 'Проверьте кампании и ставки по товарам с высокой долей рекламных расходов.'
  if (category === 'negative_margin') return 'Начните с товаров с самой низкой операционной прибылью.'
  return lead.description
}

function insightMetric(category: DashboardIssueCategory, issues: DashboardIssue[]): string | null {
  if (category === 'negative_margin') {
    const total = issues.reduce((sum, issue) => sum + parseRub(issue.metricValue), 0)
    return formatRub(total)
  }
  if (category === 'missing_cost_price' || category === 'high_drr') return `${issues.length} поз.`
  return issues[0]?.metricValue ?? null
}

function compareIssues(a: DashboardIssue, b: DashboardIssue): number {
  return severityRank(b.severity) - severityRank(a.severity)
    || categoryRank(a.category) - categoryRank(b.category)
    || a.title.localeCompare(b.title)
}

function compareInsights(a: DashboardInsight, b: DashboardInsight): number {
  return severityRank(b.severity) - severityRank(a.severity)
    || categoryRank(a.category) - categoryRank(b.category)
    || a.title.localeCompare(b.title)
}

function severityRank(severity: DashboardIssueSeverity): number {
  if (severity === 'critical') return 3
  if (severity === 'warning') return 2
  return 1
}

function categoryRank(category: DashboardIssueCategory): number {
  const ranks: Record<DashboardIssueCategory, number> = {
    sync_failed: 1,
    no_recent_report_data: 2,
    data_stale: 3,
    negative_margin: 4,
    high_drr: 5,
    missing_cost_price: 6,
    out_of_stock: 7,
    low_stock: 8,
    product_without_stock_data: 9,
    unanswered_review_question: 10,
  }
  return ranks[category]
}

function reportsHref(input: BuildDashboardProblemCenterInput): string {
  return `/reports?account=${input.accountId}&dateFrom=${input.dateFrom}&dateTo=${input.dateTo}`
}

function referencesHref(input: BuildDashboardProblemCenterInput): string {
  return `/references?account=${input.accountId}`
}

function advertisingHref(input: BuildDashboardProblemCenterInput): string {
  return `/advertising?account=${input.accountId}`
}

function stockHref(input: BuildDashboardProblemCenterInput): string {
  return `/stocks?account=${input.accountId}`
}

function feedbackHref(input: BuildDashboardProblemCenterInput): string {
  return `/reviews?account=${input.accountId}`
}

function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function parseRub(value: string | null): number {
  if (!value) return 0
  return Number(value.replace(/[^\d,-]/g, '').replace(',', '.')) || 0
}

function shortText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}
