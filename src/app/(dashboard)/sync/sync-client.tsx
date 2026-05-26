'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { RefreshCw, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  type SyncJobRunRow,
  type SyncScheduleRow,
} from '@/types/sync'

interface AccountRow {
  id: string
  name: string
  sellerName: string | null
}

interface SyncClientProps {
  accounts: AccountRow[]
  initialJobs: SyncJobRunRow[]
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
  initialJobs,
  initialSchedules,
  selectedAccountId,
  canEnqueue,
}: SyncClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [jobs, setJobs] = useState(initialJobs)
  const [schedules, setSchedules] = useState(initialSchedules)
  const [pendingKind, setPendingKind] = useState<SyncJobKind | null>(null)
  const [savingSchedule, setSavingSchedule] = useState<SyncJobKind | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [isRefreshing, startRefresh] = useTransition()
  const hasActiveJobs = jobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')

  useEffect(() => {
    if (!hasActiveJobs) return

    const timer = window.setInterval(async () => {
      const result = await getSyncJobRunsAction()
      if (result.success) setJobs(result.data)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [hasActiveJobs])

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
    startRefresh(async () => {
      const result = await getSyncJobRunsAction()
      if (result.success) {
        setJobs(result.data)
      } else {
        toast.error(result.error)
      }
    })
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

    setJobs((current) => current.filter((item) => item.id !== job.id))
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
                  <TableHead>Время МСК</TableHead>
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
                      <Input
                        type="time"
                        value={schedule.timeOfDay}
                        disabled={!canEnqueue}
                        onChange={(event) => patchSchedule(schedule.kind, { timeOfDay: event.target.value })}
                        className="w-32"
                      />
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
                            schedule.kind === SYNC_JOB_KINDS.STOCKS_CURRENT
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
          <CardDescription>История хранится в базе, выполнение идёт через Bull MQ и Redis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Кабинет</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Длительность</TableHead>
                  <TableHead>Попытки</TableHead>
                  <TableHead>Ошибка</TableHead>
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
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      Задач пока нет.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
