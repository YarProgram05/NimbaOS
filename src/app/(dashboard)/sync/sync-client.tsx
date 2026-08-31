'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { RefreshCw, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/date-range-picker'
import { RunHistoryPager, RunHistorySortableHead } from '@/components/run-history-table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  deleteSyncJobRunAction,
  enqueueManualSyncAction,
  getSyncJobRunsAction,
  getSyncSchedulesAction,
  updateSyncScheduleAction,
} from '@/lib/actions/sync'
import {
  SYNC_JOB_KINDS,
  type SyncJobKind,
  type SyncJobRunQuery,
  type SyncJobRunRow,
  type SyncJobRunSortKey,
  type SyncScheduleRow,
} from '@/types/sync'
import type { RunHistoryPage, RunHistoryPageSize } from '@/types/run-history'

interface AccountRow {
  id: string
  name: string
  sellerName: string | null
}

interface SyncClientProps {
  accounts: AccountRow[]
  initialJobsPage: RunHistoryPage<SyncJobRunRow>
  initialSchedules: SyncScheduleRow[]
  selectedAccountId: string | null
  canEnqueue: boolean
}

const JOB_LABELS: Record<SyncJobKind, string> = {
  [SYNC_JOB_KINDS.PRODUCTS_REFRESH]: 'Карточки',
  [SYNC_JOB_KINDS.REPORTS_PERIOD]: 'Отчёты + хранение',
  [SYNC_JOB_KINDS.SALES_PLAN_PERIOD]: 'План продаж',
  [SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS]: 'Рекламные кампании',
  [SYNC_JOB_KINDS.ADVERTISING_STATS]: 'Статистика рекламы',
  [SYNC_JOB_KINDS.ADVERTISING_CLUSTERS]: 'Кластеры рекламы',
  [SYNC_JOB_KINDS.STOCKS_CURRENT]: 'Остатки WB',
  [SYNC_JOB_KINDS.REVIEWS_REFRESH]: 'Отзывы',
  [SYNC_JOB_KINDS.QUESTIONS_REFRESH]: 'Вопросы',
  [SYNC_JOB_KINDS.FBS_OPERATIONAL]: 'FBS: заказы и статусы',
  [SYNC_JOB_KINDS.FBS_STOCKS_CURRENT]: 'FBS: остатки WB',
  [SYNC_JOB_KINDS.FBS_MARKING_REPORT]: 'FBS: маркировка',
}

const STATUS_LABELS: Record<SyncJobRunRow['status'], string> = {
  QUEUED: 'В очереди',
  RUNNING: 'В работе',
  SUCCEEDED: 'Готово',
  FAILED: 'Ошибка',
}

const STATUS_VARIANTS: Record<SyncJobRunRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  QUEUED: 'secondary',
  RUNNING: 'outline',
  SUCCEEDED: 'default',
  FAILED: 'destructive',
}

const MANUAL_JOBS: SyncJobKind[] = [
  SYNC_JOB_KINDS.PRODUCTS_REFRESH,
  SYNC_JOB_KINDS.REPORTS_PERIOD,
  SYNC_JOB_KINDS.SALES_PLAN_PERIOD,
  SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS,
  SYNC_JOB_KINDS.ADVERTISING_STATS,
  SYNC_JOB_KINDS.STOCKS_CURRENT,
  SYNC_JOB_KINDS.REVIEWS_REFRESH,
  SYNC_JOB_KINDS.QUESTIONS_REFRESH,
  SYNC_JOB_KINDS.FBS_OPERATIONAL,
  SYNC_JOB_KINDS.FBS_STOCKS_CURRENT,
  SYNC_JOB_KINDS.FBS_MARKING_REPORT,
]

const MOSCOW_TIME_ZONE = 'Europe/Moscow'

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return format(new Date(value), 'd MMM yyyy HH:mm', { locale: ru })
}

function formatDuration(value: number | null): string {
  if (value === null) return '—'
  if (value < 1000) return `${value} мс`
  return `${Math.round(value / 1000)} с`
}

function formatNextRun(value: string | null): string {
  if (!value) return '—'
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return `${part('day')} ${part('month')} ${part('hour')}:${part('minute')}`.trim()
}

export function SyncClient({
  accounts,
  initialJobsPage,
  initialSchedules,
  selectedAccountId,
  canEnqueue,
}: SyncClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [jobsPage, setJobsPage] = useState(initialJobsPage)
  const [jobFilters, setJobFilters] = useState<Required<Pick<
    SyncJobRunQuery,
    'kind' | 'status' | 'wbAccountId' | 'source' | 'createdFrom' | 'createdTo' | 'error'
  >>>({
    kind: 'ALL',
    status: 'ALL',
    wbAccountId: 'ALL',
    source: 'ALL',
    createdFrom: '',
    createdTo: '',
    error: '',
  })
  const [jobDateRange, setJobDateRange] = useState<DateRange>({ from: undefined })
  const [jobSort, setJobSort] = useState<{
    sortBy: SyncJobRunSortKey
    sortDirection: 'asc' | 'desc'
  }>({ sortBy: 'createdAt', sortDirection: 'desc' })
  const [jobsLoading, setJobsLoading] = useState(false)
  const [schedules, setSchedules] = useState(initialSchedules)
  const [pendingKind, setPendingKind] = useState<SyncJobKind | null>(null)
  const [savingSchedule, setSavingSchedule] = useState<SyncJobKind | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [isRefreshing, startRefresh] = useTransition()
  const jobsRequestId = useRef(0)
  const skipInitialJobFilterLoad = useRef(true)
  const jobs = jobsPage.rows
  const hasActiveJobs = jobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')

  const loadJobs = useCallback(async (page: number, pageSize: RunHistoryPageSize = jobsPage.pageSize) => {
    const requestId = ++jobsRequestId.current
    setJobsLoading(true)
    const result = await getSyncJobRunsAction({
      ...jobFilters,
      ...jobSort,
      page,
      pageSize,
    })
    if (requestId !== jobsRequestId.current) return
    setJobsLoading(false)
    if (result.success) setJobsPage(result.data)
    else toast.error(result.error)
  }, [jobFilters, jobSort, jobsPage.pageSize])

  useEffect(() => {
    if (!hasActiveJobs) return

    const timer = window.setInterval(async () => {
      await loadJobs(jobsPage.page, jobsPage.pageSize)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [hasActiveJobs, jobsPage.page, jobsPage.pageSize, loadJobs])

  useEffect(() => {
    if (skipInitialJobFilterLoad.current) {
      skipInitialJobFilterLoad.current = false
      return
    }
    const timer = window.setTimeout(() => void loadJobs(1), 300)
    return () => window.clearTimeout(timer)
  }, [jobFilters, jobSort, loadJobs])

  function handleAccountChange(id: string) {
    const params = new URLSearchParams(window.location.search)
    params.set('account', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    if (!selectedAccountId) {
      setSchedules([])
      return
    }

    getSyncSchedulesAction(selectedAccountId).then((result) => {
      if (result.success) setSchedules(result.data)
      else toast.error(result.error)
    })
  }, [selectedAccountId])

  function refreshJobs() {
    startRefresh(() => {
      void loadJobs(jobsPage.page, jobsPage.pageSize)
    })
  }

  function patchJobFilters(patch: Partial<typeof jobFilters>) {
    setJobFilters((current) => ({ ...current, ...patch }))
  }

  function changeJobDateRange(range: DateRange) {
    setJobDateRange(range)
    patchJobFilters({
      createdFrom: range.from ? format(range.from, 'yyyy-MM-dd') : '',
      createdTo: range.to ? format(range.to, 'yyyy-MM-dd') : range.from ? format(range.from, 'yyyy-MM-dd') : '',
    })
  }

  function resetJobFilters() {
    setJobDateRange({ from: undefined })
    setJobFilters({
      kind: 'ALL',
      status: 'ALL',
      wbAccountId: 'ALL',
      source: 'ALL',
      createdFrom: '',
      createdTo: '',
      error: '',
    })
  }

  function sortJobs(sortBy: SyncJobRunSortKey) {
    setJobSort((current) => ({
      sortBy,
      sortDirection: current.sortBy === sortBy && current.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }

  async function enqueue(kind: SyncJobKind) {
    if (!selectedAccountId) {
      toast.error('Кабинет не выбран')
      return
    }

    setPendingKind(kind)
    const result = await enqueueManualSyncAction(kind, selectedAccountId)
    setPendingKind(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`Задача поставлена в фон: ${result.data.id}`)
    refreshJobs()
  }

  async function deleteJob(job: SyncJobRunRow) {
    if (job.status === 'RUNNING') {
      toast.error('Нельзя удалить задачу, которая выполняется прямо сейчас')
      return
    }

    const confirmed = window.confirm('Удалить задачу из очереди и истории синхронизации?')
    if (!confirmed) return

    setDeletingJobId(job.id)
    const result = await deleteSyncJobRunAction(job.id)
    setDeletingJobId(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    await loadJobs(jobsPage.page, jobsPage.pageSize)
    toast.success('Задача удалена')
  }

  function patchSchedule(kind: SyncJobKind, patch: Partial<SyncScheduleRow>) {
    setSchedules((current) =>
      current.map((schedule) =>
        schedule.kind === kind ? { ...schedule, ...patch } : schedule,
      ),
    )
  }

  async function saveSchedule(schedule: SyncScheduleRow) {
    if (!selectedAccountId) {
      toast.error('Кабинет не выбран')
      return
    }

    setSavingSchedule(schedule.kind)
    const result = await updateSyncScheduleAction({
      wbAccountId: selectedAccountId,
      kind: schedule.kind,
      enabled: schedule.enabled,
      timeOfDay: schedule.timeOfDay,
      intervalMinutes: schedule.intervalMinutes,
      rollingDays: schedule.rollingDays,
    })
    setSavingSchedule(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    patchSchedule(schedule.kind, result.data)
    toast.success('Расписание сохранено')
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Синхронизация</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Фоновые read-only задачи WB, их последние статусы и безопасный ручной запуск.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={selectedAccountId ?? ''} onValueChange={handleAccountChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Выберите кабинет" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                  {account.sellerName ? ` · ${account.sellerName}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={refreshJobs} disabled={isRefreshing}>
            <RotateCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ручной запуск</CardTitle>
          <CardDescription>
            Запускает актуальные данные без historical/full resync. Для отчётов, плана и рекламы берётся период из сохранённого расписания.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MANUAL_JOBS.map((kind) => (
            <Button
              key={kind}
              variant="outline"
              disabled={!canEnqueue || !selectedAccountId || pendingKind !== null}
              onClick={() => enqueue(kind)}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${pendingKind === kind ? 'animate-spin' : ''}`} />
              {JOB_LABELS[kind]}
            </Button>
          ))}
          {!canEnqueue && (
            <p className="basis-full text-sm text-muted-foreground">
              У вашей роли доступен только просмотр статусов.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Расписание</CardTitle>
          <CardDescription>
            Автоматические read-only синхронизации запускаются по московскому времени. Сохранение сразу обновляет расписание в очереди.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Вкл.</TableHead>
                  <TableHead>Время / интервал</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Следующий запуск</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.kind}>
                    <TableCell className="font-medium">{JOB_LABELS[schedule.kind]}</TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        disabled={!canEnqueue}
                        onChange={(event) => patchSchedule(schedule.kind, { enabled: event.target.checked })}
                        className="h-4 w-4"
                        aria-label="Включить расписание"
                      />
                    </TableCell>
                    <TableCell>
                      {schedule.intervalMinutes === null ? (
                        <Input
                          type="time"
                          value={schedule.timeOfDay}
                          disabled={!canEnqueue}
                          onChange={(event) => patchSchedule(schedule.kind, { timeOfDay: event.target.value })}
                          className="w-32"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={1440}
                            value={schedule.intervalMinutes}
                            disabled={!canEnqueue}
                            onChange={(event) =>
                              patchSchedule(schedule.kind, {
                                intervalMinutes: Number(event.target.value) || 1,
                              })
                            }
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">мин.</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={schedule.rollingDays}
                          disabled={
                            !canEnqueue ||
                            schedule.kind === SYNC_JOB_KINDS.PRODUCTS_REFRESH ||
                            schedule.kind === SYNC_JOB_KINDS.ADVERTISING_CAMPAIGNS ||
                            schedule.kind === SYNC_JOB_KINDS.STOCKS_CURRENT ||
                            schedule.kind === SYNC_JOB_KINDS.FBS_STOCKS_CURRENT
                          }
                          onChange={(event) =>
                            patchSchedule(schedule.kind, {
                              rollingDays: Number(event.target.value) || 1,
                            })
                          }
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">дней</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatNextRun(schedule.nextRunAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEnqueue || savingSchedule !== null}
                        onClick={() => saveSchedule(schedule)}
                      >
                        {savingSchedule === schedule.kind ? 'Сохраняем...' : 'Сохранить'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {schedules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      Выберите кабинет, чтобы настроить расписание.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {!canEnqueue && (
            <p className="mt-3 text-sm text-muted-foreground">
              У вашей роли доступен только просмотр расписания.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние задачи</CardTitle>
          <CardDescription>Полная история из базы с фильтрами, сортировкой и постраничным просмотром.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Select value={jobFilters.kind} onValueChange={(value) => patchJobFilters({ kind: value as SyncJobRunQuery['kind'] })}>
              <SelectTrigger><SelectValue placeholder="Тип задачи" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все типы</SelectItem>
                {Object.entries(JOB_LABELS).map(([kind, label]) => (
                  <SelectItem key={kind} value={kind}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={jobFilters.status} onValueChange={(value) => patchJobFilters({ status: value as SyncJobRunQuery['status'] })}>
              <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все статусы</SelectItem>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <SelectItem key={status} value={status}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={jobFilters.wbAccountId} onValueChange={(value) => patchJobFilters({ wbAccountId: value })}>
              <SelectTrigger><SelectValue placeholder="Кабинет" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все кабинеты</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={jobFilters.source} onValueChange={(value) => patchJobFilters({ source: value as SyncJobRunQuery['source'] })}>
              <SelectTrigger><SelectValue placeholder="Источник" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все источники</SelectItem>
                <SelectItem value="manual">Ручной</SelectItem>
                <SelectItem value="scheduled">Расписание</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker
              value={jobDateRange}
              onChange={changeJobDateRange}
              className="w-full min-w-0 md:col-span-2"
            />
            <div className="flex gap-2">
              <Input
                value={jobFilters.error}
                onChange={(event) => patchJobFilters({ error: event.target.value })}
                placeholder="Текст ошибки"
                aria-label="Фильтр по ошибке"
              />
              <Button
                type="button"
                variant="outline"
                onClick={resetJobFilters}
              >
                Сбросить
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <RunHistorySortableHead label="Тип" sortKey="kind" activeSortKey={jobSort.sortBy} direction={jobSort.sortDirection} onSort={sortJobs} />
                  <RunHistorySortableHead label="Статус" sortKey="status" activeSortKey={jobSort.sortBy} direction={jobSort.sortDirection} onSort={sortJobs} />
                  <RunHistorySortableHead label="Кабинет" sortKey="wbAccountName" activeSortKey={jobSort.sortBy} direction={jobSort.sortDirection} onSort={sortJobs} />
                  <TableHead>Источник</TableHead>
                  <TableHead>Период</TableHead>
                  <RunHistorySortableHead label="Создано" sortKey="createdAt" activeSortKey={jobSort.sortBy} direction={jobSort.sortDirection} onSort={sortJobs} />
                  <TableHead>Длительность</TableHead>
                  <RunHistorySortableHead label="Попытки" sortKey="attempts" activeSortKey={jobSort.sortBy} direction={jobSort.sortDirection} onSort={sortJobs} />
                  <RunHistorySortableHead label="Ошибка" sortKey="error" activeSortKey={jobSort.sortBy} direction={jobSort.sortDirection} onSort={sortJobs} />
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{JOB_LABELS[job.kind]}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[job.status]}>{STATUS_LABELS[job.status]}</Badge>
                    </TableCell>
                    <TableCell>{job.wbAccountName ?? '—'}</TableCell>
                    <TableCell>{job.source === 'scheduled' ? 'Расписание' : job.source === 'manual' ? 'Ручной' : '—'}</TableCell>
                    <TableCell>{job.period ?? '—'}</TableCell>
                    <TableCell>{formatDateTime(job.createdAt)}</TableCell>
                    <TableCell>{formatDuration(job.durationMs)}</TableCell>
                    <TableCell>{job.attempts}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-destructive">
                      {job.error ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEnqueue && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={job.status === 'RUNNING' || deletingJobId === job.id}
                          onClick={() => deleteJob(job)}
                          title={job.status === 'RUNNING' ? 'Задача сейчас выполняется' : 'Удалить задачу'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {jobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      {jobsLoading ? 'Загрузка…' : 'Задачи по выбранным фильтрам не найдены.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <RunHistoryPager
            total={jobsPage.total}
            page={jobsPage.page}
            pageSize={jobsPage.pageSize}
            loading={jobsLoading}
            onPageChange={(page) => void loadJobs(page, jobsPage.pageSize)}
            onPageSizeChange={(pageSize) => void loadJobs(1, pageSize)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
