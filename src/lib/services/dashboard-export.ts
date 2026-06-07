import {
  appendAoaSheet,
  createWorkbook,
  safeXlsxFilename,
  workbookToBase64,
} from '@/lib/xlsx/export'
import type {
  ActionRecommendation,
  DashboardFreshnessItem,
  DashboardProductSnapshot,
  DashboardSummary,
} from '@/types/dashboard'
import type { FeedbackWorkloadItem } from '@/types/feedback'
import type { StockSummaryItem } from '@/types/stocks'

export type DashboardExportKind =
  | 'summary'
  | 'productRisks'
  | 'stockRisks'
  | 'feedbackWorkload'

export interface DashboardExportFile {
  base64: string
  filename: string
}

const RUB_FORMAT = '#,##0.00'
const PERCENT_FORMAT = '0.00'
const INTEGER_FORMAT = '#,##0'

export function buildDashboardExport(
  summary: DashboardSummary,
  kind: DashboardExportKind,
): DashboardExportFile {
  const workbook = createWorkbook()

  appendContextSheet(workbook, summary)

  if (kind === 'summary') {
    appendDashboardSummarySheets(workbook, summary)
  } else if (kind === 'productRisks') {
    appendProductRiskSheets(workbook, summary)
  } else if (kind === 'stockRisks') {
    appendStockRiskSheets(workbook, summary)
  } else {
    appendFeedbackWorkloadSheets(workbook, summary)
  }

  return {
    base64: workbookToBase64(workbook),
    filename: safeXlsxFilename(
      dashboardExportStem(kind),
      summary.account.name,
      summary.period.dateFrom,
      summary.period.dateTo,
    ),
  }
}

function appendContextSheet(workbook: ReturnType<typeof createWorkbook>, summary: DashboardSummary) {
  appendAoaSheet(
    workbook,
    'Контекст',
    [
      ['Параметр', 'Значение'],
      ['Кабинет', summary.account.name],
      ['Продавец', summary.account.sellerName ?? ''],
      ['ID кабинета', summary.account.id],
      ['Период', `${summary.period.dateFrom} - ${summary.period.dateTo}`],
      ['Сравнение', `${summary.comparisonPeriod.dateFrom} - ${summary.comparisonPeriod.dateTo}`],
      ['Сгенерировано', formatDateTime(summary.generatedAt)],
      ['Режим расчета', summary.computeMode],
      ['Активные синхронизации', summary.freshness.activeJobs],
      ['Ошибки синхронизации за 7 дней', summary.freshness.failedJobs],
      ['Критичных источников', summary.freshness.criticalCount],
      ['Источников с предупреждением', summary.freshness.warningCount],
    ],
    { widths: [32, 48], autoFilter: false },
  )
}

function appendDashboardSummarySheets(workbook: ReturnType<typeof createWorkbook>, summary: DashboardSummary) {
  appendAoaSheet(
    workbook,
    'KPI',
    [
      ['Метрика', 'Значение', 'Предыдущий период', 'Изменение, %', 'Единица', 'Статус', 'Источник', 'Комментарий'],
      ...Object.values(summary.kpis).map((metric) => [
        metric.label,
        metric.value,
        metric.previousValue,
        metric.changePercent,
        metric.unit,
        statusText(metric.status),
        metric.source,
        metric.hint ?? '',
      ]),
    ],
    {
      widths: [28, 18, 18, 16, 14, 18, 30, 52],
    },
  )

  appendAoaSheet(
    workbook,
    'Финансы',
    [
      ['Метрика', 'Значение', 'Статус', 'Источник'],
      ['Выручка', summary.financialBreakdown.revenue, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['К перечислению', summary.financialBreakdown.toTransfer, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Операционная прибыль', summary.financialBreakdown.operatingProfit, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Маржинальность, %', summary.financialBreakdown.marginality, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Рентабельность, %', summary.financialBreakdown.rentability, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Налоги', summary.financialBreakdown.taxes, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Логистика', summary.financialBreakdown.logistics, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Хранение', summary.financialBreakdown.storage, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Штрафы', summary.financialBreakdown.penalties, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Приемка', summary.financialBreakdown.acceptance, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Самовыкупы', summary.financialBreakdown.selfPurchases, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Внешняя реклама', summary.financialBreakdown.externalAds, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Реклама WB', summary.financialBreakdown.wbAds, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Возвраты, сумма', summary.financialBreakdown.returnAmount, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Возвраты, шт.', summary.financialBreakdown.returnCount, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
      ['Возвраты, %', summary.financialBreakdown.returnRate, statusText(summary.financialBreakdown.status), summary.financialBreakdown.source],
    ],
    { widths: [28, 18, 18, 30] },
  )

  appendAoaSheet(
    workbook,
    'План и продажи',
    [
      ['Блок', 'Метрика', 'Значение', 'Статус', 'Источник'],
      ['План-факт', 'Активные планы', summary.plan.activePlans, statusText(summary.plan.status), summary.plan.source],
      ['План-факт', 'План, шт.', summary.plan.plannedUnits, statusText(summary.plan.status), summary.plan.source],
      ['План-факт', 'Факт, шт.', summary.plan.factUnits, statusText(summary.plan.status), summary.plan.source],
      ['План-факт', 'Плановая выручка', summary.plan.plannedRevenue, statusText(summary.plan.status), summary.plan.source],
      ['План-факт', 'Фактическая выручка', summary.plan.factRevenue, statusText(summary.plan.status), summary.plan.source],
      ['План-факт', 'Прогресс, %', summary.plan.progressPercent, statusText(summary.plan.status), summary.plan.source],
      ['Продажи', 'Заказы', summary.salesAnalytics.orders, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Продажи', 'Продажи', summary.salesAnalytics.sales, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Продажи', 'Возвраты', summary.salesAnalytics.returns, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Продажи', 'Отмены', summary.salesAnalytics.cancellations, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Продажи', 'Выкуп, %', summary.salesAnalytics.buyoutPercent, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Продажи', 'Средняя цена', summary.salesAnalytics.averagePrice, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Воронка', 'Переходы в карточку', summary.salesAnalytics.funnel.openCount, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Воронка', 'Добавления в корзину', summary.salesAnalytics.funnel.addToCartCount, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Воронка', 'Корзины', summary.salesAnalytics.funnel.cartCount, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Воронка', 'Заказы', summary.salesAnalytics.funnel.ordersCount, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Воронка', 'Конверсия в корзину, %', summary.salesAnalytics.funnel.addToCartConversion, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
      ['Воронка', 'Корзина-заказ, %', summary.salesAnalytics.funnel.cartToOrderConversion, statusText(summary.salesAnalytics.status), summary.salesAnalytics.source],
    ],
    { widths: [18, 30, 18, 18, 32] },
  )

  appendAoaSheet(
    workbook,
    'Реклама и прогноз',
    [
      ['Блок', 'Метрика', 'Значение', 'Проекция', 'Дневной темп', 'Статус', 'Источник'],
      ['Реклама', 'Расход', summary.advertising.spend, '', '', statusText(summary.advertising.status), summary.advertising.source],
      ['Реклама', 'DRR, %', summary.advertising.drr, '', '', statusText(summary.advertising.status), summary.advertising.source],
      ['Реклама', 'CTR, %', summary.advertising.ctr, '', '', statusText(summary.advertising.status), summary.advertising.source],
      ['Реклама', 'CPC', summary.advertising.cpc, '', '', statusText(summary.advertising.status), summary.advertising.source],
      ['Реклама', 'Заказы', summary.advertising.orders, '', '', statusText(summary.advertising.status), summary.advertising.source],
      ['Реклама', 'Кампаний', summary.advertising.campaigns, '', '', statusText(summary.advertising.status), summary.advertising.source],
      ['Прогноз', summary.forecasts.revenue.label, summary.forecasts.revenue.value, summary.forecasts.revenue.projectedValue, summary.forecasts.revenue.dailyAverage, statusText(summary.forecasts.revenue.status), summary.forecasts.revenue.source],
      ['Прогноз', summary.forecasts.operatingProfit.label, summary.forecasts.operatingProfit.value, summary.forecasts.operatingProfit.projectedValue, summary.forecasts.operatingProfit.dailyAverage, statusText(summary.forecasts.operatingProfit.status), summary.forecasts.operatingProfit.source],
      ['Прогноз', summary.forecasts.advertisingSpend.label, summary.forecasts.advertisingSpend.value, summary.forecasts.advertisingSpend.projectedValue, summary.forecasts.advertisingSpend.dailyAverage, statusText(summary.forecasts.advertisingSpend.status), summary.forecasts.advertisingSpend.source],
      ['Прогноз', 'План, прогноз выполнения %', summary.forecasts.planCompletion.factUnits, summary.forecasts.planCompletion.forecastCompletionPercent, summary.forecasts.planCompletion.requiredDailyUnits, statusText(summary.forecasts.planCompletion.status), summary.forecasts.planCompletion.source],
      ['Прогноз', 'Нужно продать, шт.', summary.forecasts.unitsNeeded.value, summary.forecasts.unitsNeeded.projectedValue, summary.forecasts.unitsNeeded.dailyAverage, statusText(summary.forecasts.unitsNeeded.status), summary.forecasts.unitsNeeded.source],
      ['Прогноз', 'Нужно пополнить, шт.', summary.forecasts.stockNeeded.value, summary.forecasts.stockNeeded.projectedValue, summary.forecasts.stockNeeded.dailyAverage, statusText(summary.forecasts.stockNeeded.status), summary.forecasts.stockNeeded.source],
    ],
    { widths: [18, 32, 18, 18, 18, 18, 34] },
  )

  appendRecommendationsSheet(workbook, summary.recommendations)
  appendFreshnessSheet(workbook, summary.freshness.items)
}

function appendProductRiskSheets(workbook: ReturnType<typeof createWorkbook>, summary: DashboardSummary) {
  appendProductRowsSheet(workbook, 'Риски товаров', summary.products.risks)
  appendProductRowsSheet(workbook, 'Отрицательная прибыль', summary.products.negativeProfit)
  appendProductRowsSheet(workbook, 'Высокая логистика', summary.products.highLogisticsShare)
  appendProductRowsSheet(workbook, 'Высокое хранение', summary.products.highStorageShare)
  appendProductRowsSheet(workbook, 'Нет себестоимости', summary.products.missingCostPrice)
  appendProductRowsSheet(workbook, 'Высокие возвраты', summary.products.highReturnRate)
}

function appendProductRowsSheet(
  workbook: ReturnType<typeof createWorkbook>,
  name: string,
  rows: DashboardProductSnapshot[],
) {
  appendAoaSheet(
    workbook,
    name,
    [
      [
        'Артикул WB',
        'Артикул продавца',
        'Бренд',
        'Категория',
        'Выручка',
        'К перечислению',
        'Операционная прибыль',
        'Маржинальность, %',
        'Рентабельность, %',
        'DRR, %',
        'Логистика',
        'Логистика от продаж, %',
        'Хранение',
        'Хранение от продаж, %',
        'Себестоимость',
        'Возвраты, шт.',
        'Возвраты, %',
        'Статус',
      ],
      ...rows.map((row) => [
        row.nmId,
        row.vendorCode,
        row.brandName,
        row.subjectName,
        row.revenue,
        row.toTransfer,
        row.operatingProfit,
        row.marginality,
        row.rentability,
        row.drr,
        row.logistics,
        row.logisticsShare,
        row.storage,
        row.storageShare,
        row.costPrice,
        row.returns,
        row.returnRate,
        statusText(row.status),
      ]),
    ],
    {
      widths: [14, 20, 18, 22, 16, 16, 18, 16, 16, 12, 16, 18, 16, 18, 16, 14, 14, 16],
      columnFormats: {
        0: INTEGER_FORMAT,
        4: RUB_FORMAT,
        5: RUB_FORMAT,
        6: RUB_FORMAT,
        7: PERCENT_FORMAT,
        8: PERCENT_FORMAT,
        9: PERCENT_FORMAT,
        10: RUB_FORMAT,
        11: PERCENT_FORMAT,
        12: RUB_FORMAT,
        13: PERCENT_FORMAT,
        14: RUB_FORMAT,
        15: INTEGER_FORMAT,
        16: PERCENT_FORMAT,
      },
    },
  )
}

function appendStockRiskSheets(workbook: ReturnType<typeof createWorkbook>, summary: DashboardSummary) {
  appendAoaSheet(
    workbook,
    'Сводка остатков',
    [
      ['Метрика', 'Значение'],
      ['Статус', readyMissingStatusText(summary.stocks.status)],
      ['Синхронизировано', summary.stocks.syncedAt ? formatDateTime(summary.stocks.syncedAt) : ''],
      ['Всего, шт.', summary.stocks.totalUnits],
      ['Стоимость остатков', summary.stocks.stockValue],
      ['К клиенту', summary.stocks.inWayToClient],
      ['От клиента', summary.stocks.inWayFromClient],
      ['Нет остатка', summary.stocks.outOfStockCount],
      ['Низкий остаток', summary.stocks.lowStockCount],
      ['Избыток', summary.stocks.overstockCount],
      ['Продажи без остатка', summary.stocks.productsWithSalesNoStock],
      ['Остаток без продаж', summary.stocks.productsWithStockNoSales],
    ],
    { widths: [28, 24] },
  )

  appendStockRowsSheet(workbook, 'Риски остатков', summary.stocks.items)
  appendAoaSheet(
    workbook,
    'Склады',
    [
      ['Склад WB', 'Регион', 'Остаток, шт.', 'К клиенту', 'От клиента', 'Стоимость остатков'],
      ...summary.stocks.warehouses.map((row) => [
        row.warehouseName,
        row.regionName ?? '',
        row.quantity,
        row.inWayToClient,
        row.inWayFromClient,
        row.stockValue,
      ]),
    ],
    {
      widths: [34, 22, 16, 14, 14, 18],
      columnFormats: { 2: INTEGER_FORMAT, 3: INTEGER_FORMAT, 4: INTEGER_FORMAT, 5: RUB_FORMAT },
    },
  )
}

function appendStockRowsSheet(
  workbook: ReturnType<typeof createWorkbook>,
  name: string,
  rows: StockSummaryItem[],
) {
  appendAoaSheet(
    workbook,
    name,
    [
      [
        'Артикул WB',
        'Артикул продавца',
        'Бренд',
        'Категория',
        'Название',
        'Склад',
        'Остаток, шт.',
        'К клиенту',
        'От клиента',
        'Стоимость остатков',
        'Дней до нуля',
        'Оборачиваемость, дн.',
        'Риск',
        'Синхронизировано',
      ],
      ...rows.map((row) => [
        row.nmId,
        row.vendorCode,
        row.brand ?? '',
        row.category ?? '',
        row.title ?? '',
        row.warehouseName,
        row.quantity,
        row.inWayToClient,
        row.inWayFromClient,
        row.stockValue,
        row.daysUntilZero,
        row.turnoverDays,
        stockRiskText(row.risk),
        formatDateTime(row.syncedAt),
      ]),
    ],
    {
      widths: [14, 20, 18, 22, 34, 28, 14, 14, 14, 18, 14, 20, 20, 22],
      columnFormats: {
        0: INTEGER_FORMAT,
        6: INTEGER_FORMAT,
        7: INTEGER_FORMAT,
        8: INTEGER_FORMAT,
        9: RUB_FORMAT,
        10: '0.0',
        11: '0.0',
      },
    },
  )
}

function appendFeedbackWorkloadSheets(workbook: ReturnType<typeof createWorkbook>, summary: DashboardSummary) {
  appendAoaSheet(
    workbook,
    'Сводка клиентов',
    [
      ['Метрика', 'Значение'],
      ['Статус', readyMissingStatusText(summary.feedback.status)],
      ['Обновлено', summary.feedback.syncedAt ? formatDateTime(summary.feedback.syncedAt) : ''],
      ['Средняя оценка', summary.feedback.averageRating],
      ['Отзывы всего', summary.feedback.reviewsTotal],
      ['Новые отзывы за период', summary.feedback.reviewsNew],
      ['Негативные отзывы за период', summary.feedback.negativeReviews],
      ['Отзывы без ответа', summary.feedback.unansweredReviews],
      ['Вопросы всего', summary.feedback.questionsTotal],
      ['Новые вопросы за период', summary.feedback.questionsNew],
      ['Вопросы без ответа', summary.feedback.unansweredQuestions],
    ],
    { widths: [34, 24] },
  )

  appendFeedbackRowsSheet(workbook, 'Очередь', summary.feedback.urgentItems)
}

function appendFeedbackRowsSheet(
  workbook: ReturnType<typeof createWorkbook>,
  name: string,
  rows: FeedbackWorkloadItem[],
) {
  appendAoaSheet(
    workbook,
    name,
    [
      [
        'Тип',
        'ID WB',
        'Артикул WB',
        'Артикул продавца',
        'Товар',
        'Бренд',
        'Оценка',
        'Статус ответа',
        'Дата',
        'Текст',
      ],
      ...rows.map((row) => [
        row.type === 'reviews' ? 'Отзыв' : 'Вопрос',
        row.externalId,
        row.nmId,
        row.vendorCode ?? '',
        row.productName ?? '',
        row.brandName ?? '',
        row.rating,
        row.isAnswered ? 'Отвечено' : 'Без ответа',
        formatDateTime(row.createdDate),
        row.text,
      ]),
    ],
    {
      widths: [12, 28, 14, 20, 34, 18, 10, 16, 20, 60],
      columnFormats: { 2: INTEGER_FORMAT, 6: '0' },
    },
  )
}

function appendRecommendationsSheet(
  workbook: ReturnType<typeof createWorkbook>,
  recommendations: ActionRecommendation[],
) {
  appendAoaSheet(
    workbook,
    'Рекомендации',
    [
      ['Приоритет', 'Категория', 'Заголовок', 'Описание', 'Метрика', 'Ссылка', 'Создано'],
      ...recommendations.map((row) => [
        severityText(row.severity),
        row.category,
        row.title,
        row.description,
        row.metric ?? '',
        row.href,
        formatDateTime(row.createdAt),
      ]),
    ],
    { widths: [16, 28, 34, 72, 18, 36, 20] },
  )
}

function appendFreshnessSheet(
  workbook: ReturnType<typeof createWorkbook>,
  items: DashboardFreshnessItem[],
) {
  appendAoaSheet(
    workbook,
    'Свежесть',
    [
      ['Источник', 'Статус', 'Важность', 'Устарел', 'Последний успех', 'Последняя ошибка', 'Покрытие', 'Комментарий'],
      ...items.map((item) => [
        item.label,
        statusText(item.status),
        severityText(item.severity),
        item.isStale ? 'Да' : 'Нет',
        item.lastSuccessAt ? formatDateTime(item.lastSuccessAt) : '',
        item.lastError ?? '',
        item.checkedFrom && item.checkedTo ? `${item.checkedFrom} - ${item.checkedTo}` : '',
        item.hint ?? '',
      ]),
    ],
    { widths: [28, 18, 16, 12, 20, 56, 24, 56] },
  )
}

function dashboardExportStem(kind: DashboardExportKind): string {
  if (kind === 'summary') return 'dashboard_summary'
  if (kind === 'productRisks') return 'dashboard_product_risks'
  if (kind === 'stockRisks') return 'dashboard_stock_risks'
  return 'dashboard_feedback_workload'
}

function statusText(status: DashboardSummary['financialBreakdown']['status']): string {
  if (status === 'ready') return 'Готово'
  if (status === 'partial') return 'Частично'
  if (status === 'not_applicable') return 'Не применимо'
  return 'Нет данных'
}

function readyMissingStatusText(status: 'ready' | 'missing'): string {
  return status === 'ready' ? 'Готово' : 'Нет данных'
}

function severityText(severity: DashboardSummary['freshness']['items'][number]['severity']): string {
  if (severity === 'critical') return 'Критично'
  if (severity === 'warning') return 'Требует внимания'
  return 'Инфо'
}

function stockRiskText(risk: StockSummaryItem['risk']): string {
  if (risk === 'out_of_stock') return 'Нет остатка'
  if (risk === 'low_stock') return 'Низкий остаток'
  if (risk === 'overstock') return 'Избыток'
  if (risk === 'no_sales') return 'Остаток без продаж'
  return 'В норме'
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
