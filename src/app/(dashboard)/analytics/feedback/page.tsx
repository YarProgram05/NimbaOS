import {
  AnalyticsEmptyState,
  AnalyticsShell,
  DetailPanel,
  FeedbackList,
  MetricGrid,
  detailIcons,
  formatNumber,
  formatOptionalNumber,
  loadAnalyticsDetail,
  type AnalyticsPageProps,
} from '../analytics-shared'

export default async function AnalyticsFeedbackPage({ searchParams }: AnalyticsPageProps) {
  const detail = await loadAnalyticsDetail(searchParams)
  if (!detail) return <AnalyticsEmptyState />

  const { feedback } = detail.summary
  const unanswered = feedback.urgentItems.filter((row) => !row.isAnswered)
  const negative = feedback.urgentItems.filter((row) => row.type === 'reviews' && (row.rating ?? 5) <= 3)

  return (
    <AnalyticsShell
      detail={detail}
      active="feedback"
      title="Отзывы и вопросы"
      description="Клиентская очередь, негатив и элементы без ответа за выбранный период."
    >
      <MetricGrid
        metrics={[
          { label: 'Средняя оценка', value: formatOptionalNumber(feedback.averageRating, 2), status: feedback.status },
          { label: 'Новых отзывов', value: formatNumber(feedback.reviewsNew), status: feedback.status },
          { label: 'Негативных отзывов', value: formatNumber(feedback.negativeReviews), status: feedback.status },
          { label: 'Отзывы без ответа', value: formatNumber(feedback.unansweredReviews), status: feedback.status },
          { label: 'Новых вопросов', value: formatNumber(feedback.questionsNew), status: feedback.status },
          { label: 'Вопросы без ответа', value: formatNumber(feedback.unansweredQuestions), status: feedback.status },
          { label: 'Всего отзывов', value: formatNumber(feedback.reviewsTotal), status: feedback.status },
          { label: 'Всего вопросов', value: formatNumber(feedback.questionsTotal), status: feedback.status },
        ]}
      />
      <section className="grid gap-3 xl:grid-cols-2">
        <DetailPanel label="Очередь" title="Без ответа" icon={detailIcons.feedback}>
          <FeedbackList rows={unanswered} />
        </DetailPanel>
        <DetailPanel label="Риски" title="Негативные отзывы" icon={detailIcons.risks}>
          <FeedbackList rows={negative} />
        </DetailPanel>
        <DetailPanel label="Фокус" title="Срочные позиции" icon={detailIcons.feedback}>
          <FeedbackList rows={feedback.urgentItems} />
        </DetailPanel>
      </section>
    </AnalyticsShell>
  )
}
