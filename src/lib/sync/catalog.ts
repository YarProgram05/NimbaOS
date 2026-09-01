import { defaultFlexibleSchedule } from '@/lib/schedules/flexible-schedule'
import { SYNC_JOB_KINDS, type SyncJobKind } from '@/types/sync'
import type { FlexibleSchedule, ScheduleTimeMode } from '@/types/schedules'

export type SyncScheduleCategoryId = 'core' | 'reports' | 'advertising' | 'feedback' | 'fbs'
export type SyncDataDepthMode = 'snapshot' | 'rolling'

export interface SyncScheduleDefinition {
  kind: SyncJobKind
  title: string
  description: string
  category: SyncScheduleCategoryId
  dataDepthMode: SyncDataDepthMode
  recommendedRollingDays: number
  recommendedSchedule: FlexibleSchedule
}

export const SYNC_ALLOWED_TIME_MODES: ScheduleTimeMode[] = ['times', 'interval']

export const SYNC_SCHEDULE_CATEGORIES: Array<{
  id: SyncScheduleCategoryId
  title: string
  description: string
}> = [
  { id: 'core', title: 'Основные данные', description: 'Карточки и актуальные остатки кабинета.' },
  { id: 'reports', title: 'Отчёты и аналитика', description: 'Финансовые данные, заказы, продажи и план.' },
  { id: 'advertising', title: 'Реклама', description: 'Сначала кампании, затем их статистика.' },
  { id: 'feedback', title: 'Обратная связь', description: 'Новые отзывы и вопросы покупателей.' },
  { id: 'fbs', title: 'Оперативный FBS', description: 'Частые read-only обновления в выбранные часы.' },
]

function exact(time: string): FlexibleSchedule {
  return {
    ...defaultFlexibleSchedule(time),
    weekdays: [1, 2, 3, 4, 5, 6, 7],
  }
}

function interval(startTime: string, endTime: string, everyMinutes: number): FlexibleSchedule {
  return {
    ...exact(startTime),
    timeMode: 'interval',
    interval: { startTime, endTime, everyMinutes },
  }
}

export const SYNC_SCHEDULE_DEFINITIONS: SyncScheduleDefinition[] = [
  {
    kind: SYNC_JOB_KINDS.PRODUCTS_REFRESH,
    title: 'Карточки',
    description: 'Обновляет карточки, характеристики и связанные справочные данные.',
    category: 'core', dataDepthMode: 'snapshot',
    recommendedRollingDays: 7, recommendedSchedule: exact('02:00'),
  },
  {
    kind: SYNC_JOB_KINDS.STOCKS_CURRENT,
    title: 'Остатки WB',
    description: 'Сохраняет текущий снимок доступных остатков Wildberries.',
    category: 'core', dataDepthMode: 'snapshot',
    recommendedRollingDays: 7, recommendedSchedule: exact('05:30'),
  },
  {
    kind: SYNC_JOB_KINDS.REPORTS_PERIOD,
    title: 'Отчёты + хранение',
    description: 'Обновляет финансовый отчёт, платное хранение и заказы за выбранную глубину.',
    category: 'reports', dataDepthMode: 'rolling',
    recommendedRollingDays: 15, recommendedSchedule: exact('02:30'),
  },
  {
    kind: SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
    title: 'План продаж',
    description: 'Пересчитывает заказы, продажи и воронку для активных планов.',
    category: 'reports', dataDepthMode: 'rolling',
    recommendedRollingDays: 15, recommendedSchedule: exact('03:30'),
  },
  {
    kind: SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS,
    title: 'Рекламные кампании',
    description: 'Сначала обновляет список и параметры кампаний для последующей статистики.',
    category: 'advertising', dataDepthMode: 'snapshot',
    recommendedRollingDays: 7, recommendedSchedule: exact('04:30'),
  },
  {
    kind: SYNC_JOB_KINDS.ADVERTISING_STATS,
    title: 'Статистика рекламы',
    description: 'Загружает статистику известных кампаний за последние дни.',
    category: 'advertising', dataDepthMode: 'rolling',
    recommendedRollingDays: 15, recommendedSchedule: exact('05:00'),
  },
  {
    kind: SYNC_JOB_KINDS.REVIEWS_REFRESH,
    title: 'Отзывы',
    description: 'Обновляет отзывы покупателей за выбранную глубину.',
    category: 'feedback', dataDepthMode: 'rolling',
    recommendedRollingDays: 15, recommendedSchedule: exact('06:00'),
  },
  {
    kind: SYNC_JOB_KINDS.QUESTIONS_REFRESH,
    title: 'Вопросы',
    description: 'Обновляет вопросы покупателей за выбранную глубину.',
    category: 'feedback', dataDepthMode: 'rolling',
    recommendedRollingDays: 15, recommendedSchedule: exact('06:15'),
  },
  {
    kind: SYNC_JOB_KINDS.FBS_OPERATIONAL,
    title: 'FBS: заказы и статусы',
    description: 'Часто обновляет заказы, статусы и метаданные FBS в рабочее окно.',
    category: 'fbs', dataDepthMode: 'rolling',
    recommendedRollingDays: 1, recommendedSchedule: interval('08:00', '23:55', 5),
  },
  {
    kind: SYNC_JOB_KINDS.FBS_STOCKS_CURRENT,
    title: 'FBS: остатки WB',
    description: 'Сверяет текущие остатки FBS без изменения данных Wildberries.',
    category: 'fbs', dataDepthMode: 'snapshot',
    recommendedRollingDays: 1, recommendedSchedule: interval('08:00', '23:45', 15),
  },
  {
    kind: SYNC_JOB_KINDS.FBS_MARKING_REPORT,
    title: 'FBS: маркировка',
    description: 'Обновляет read-only отчёт по маркировке за последние дни.',
    category: 'fbs', dataDepthMode: 'rolling',
    recommendedRollingDays: 1, recommendedSchedule: interval('08:00', '23:00', 60),
  },
]

const BY_KIND = new Map(SYNC_SCHEDULE_DEFINITIONS.map((definition) => [definition.kind, definition]))

export function getSyncScheduleDefinition(kind: SyncJobKind): SyncScheduleDefinition {
  const definition = BY_KIND.get(kind)
  if (!definition) throw new Error(`Неизвестный тип синхронизации: ${kind}`)
  return definition
}
