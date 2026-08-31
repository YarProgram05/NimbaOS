'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Play, RotateCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/date-range-picker'
import { Input } from '@/components/ui/input'
import { RunHistoryPager, RunHistorySortableHead } from '@/components/run-history-table'
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
import type {
  AutomationRunQuery,
  AutomationRunRow,
  AutomationRunSortKey,
  AutomationWorkflowRow,
} from '@/types/automations'
import type { RunHistoryPage, RunHistoryPageSize } from '@/types/run-history'
import {
  enqueueMorningWbReportAction,
  getAutomationRunsAction,
  getMorningWbReportWorkflowAction,
  updateMorningWbReportWorkflowAction,
} from '@/lib/actions/automations'

interface AutomationsClientProps {
  initialWorkflow: AutomationWorkflowRow
  initialRunsPage: RunHistoryPage<AutomationRunRow>
  canManage: boolean
}

const STATUS_LABELS: Record<AutomationRunRow['status'], string> = {
  QUEUED: 'В очереди',
  RUNNING: 'В работе',
  SUCCEEDED: 'Готово',
  FAILED: 'Ошибка',
}

const STATUS_VARIANTS: Record<AutomationRunRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  QUEUED: 'secondary',
  RUNNING: 'outline',
  SUCCEEDED: 'default',
  FAILED: 'destructive',
}

const MOSCOW_TIME_ZONE = 'Europe/Moscow'

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return format(new Date(value), 'd MMM yyyy HH:mm', { locale: ru })
}

function formatDuration(value: number | null): string {
  if (value === null) return '-'
  if (value < 1000) return `${value} мс`
  return `${Math.round(value / 1000)} с`
}

function formatNextRun(value: string | null): string {
  if (!value) return '-'
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

export function AutomationsClient({
  initialWorkflow,
  initialRunsPage,
  canManage,
}: AutomationsClientProps) {
  const [workflow, setWorkflow] = useState(initialWorkflow)
  const [runsPage, setRunsPage] = useState(initialRunsPage)
  const [runFilters, setRunFilters] = useState<Required<Pick<
    AutomationRunQuery,
    'status' | 'source' | 'createdFrom' | 'createdTo' | 'error'
  >>>({
    status: 'ALL',
    source: 'ALL',
    createdFrom: '',
    createdTo: '',
    error: '',
  })
  const [runDateRange, setRunDateRange] = useState<DateRange>({ from: undefined })
  const [runSort, setRunSort] = useState<{
    sortBy: AutomationRunSortKey
    sortDirection: 'asc' | 'desc'
  }>({ sortBy: 'createdAt', sortDirection: 'desc' })
  const [runsLoading, setRunsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()
  const runsRequestId = useRef(0)
  const skipInitialRunFilterLoad = useRef(true)
  const runs = runsPage.rows
  const hasActiveRuns = runs.some((run) => run.status === 'QUEUED' || run.status === 'RUNNING')

  const loadRuns = useCallback(async (page: number, pageSize: RunHistoryPageSize = runsPage.pageSize) => {
    const requestId = ++runsRequestId.current
    setRunsLoading(true)
    const result = await getAutomationRunsAction({
      ...runFilters,
      ...runSort,
      page,
      pageSize,
    })
    if (requestId !== runsRequestId.current) return
    setRunsLoading(false)
    if (result.success) setRunsPage(result.data)
    else toast.error(result.error)
  }, [runFilters, runSort, runsPage.pageSize])

  useEffect(() => {
    if (!hasActiveRuns) return

    const timer = window.setInterval(async () => {
      await loadRuns(runsPage.page, runsPage.pageSize)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [hasActiveRuns, loadRuns, runsPage.page, runsPage.pageSize])

  useEffect(() => {
    if (skipInitialRunFilterLoad.current) {
      skipInitialRunFilterLoad.current = false
      return
    }
    const timer = window.setTimeout(() => void loadRuns(1), 300)
    return () => window.clearTimeout(timer)
  }, [loadRuns, runFilters, runSort])

  function patchWorkflow(patch: Partial<AutomationWorkflowRow>) {
    setWorkflow((current) => ({ ...current, ...patch }))
  }

  function patchAccount(wbAccountId: string, patch: Partial<AutomationWorkflowRow['accounts'][number]>) {
    setWorkflow((current) => ({
      ...current,
      accounts: current.accounts.map((account) =>
        account.wbAccountId === wbAccountId ? { ...account, ...patch } : account,
      ),
    }))
  }

  function refresh() {
    startRefresh(async () => {
      const workflowResult = await getMorningWbReportWorkflowAction()
      if (workflowResult.success) setWorkflow(workflowResult.data)
      else toast.error(workflowResult.error)
      await loadRuns(runsPage.page, runsPage.pageSize)
    })
  }

  function patchRunFilters(patch: Partial<typeof runFilters>) {
    setRunFilters((current) => ({ ...current, ...patch }))
  }

  function changeRunDateRange(range: DateRange) {
    setRunDateRange(range)
    patchRunFilters({
      createdFrom: range.from ? format(range.from, 'yyyy-MM-dd') : '',
      createdTo: range.to ? format(range.to, 'yyyy-MM-dd') : range.from ? format(range.from, 'yyyy-MM-dd') : '',
    })
  }

  function resetRunFilters() {
    setRunDateRange({ from: undefined })
    setRunFilters({
      status: 'ALL',
      source: 'ALL',
      createdFrom: '',
      createdTo: '',
      error: '',
    })
  }

  function sortRuns(sortBy: AutomationRunSortKey) {
    setRunSort((current) => ({
      sortBy,
      sortDirection: current.sortBy === sortBy && current.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }

  async function saveWorkflow() {
    setIsSaving(true)
    const result = await updateMorningWbReportWorkflowAction({
      enabled: workflow.enabled,
      timeOfDay: workflow.timeOfDay,
      spreadsheetUrl: workflow.config.spreadsheetUrl || workflow.config.spreadsheetId,
      accounts: workflow.accounts.map((account) => ({
        wbAccountId: account.wbAccountId,
        enabled: account.enabled,
        sheetName: account.sheetName,
      })),
    })
    setIsSaving(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setWorkflow(result.data)
    toast.success('Workflow сохранен')
  }

  async function runWorkflow() {
    setIsRunning(true)
    const result = await enqueueMorningWbReportAction()
    setIsRunning(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`Workflow поставлен в очередь: ${result.data.id}`)
    refresh()
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Автоматизации</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление регулярными workflow, которые работают поверх локальной базы и безопасных фоновых задач.
          </p>
        </div>

        <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
          <RotateCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Утренний отчет WB</CardTitle>
              <CardDescription>
                Ежедневно заполняет Google Sheet за текущий месяц и строку итога с начала года.
              </CardDescription>
            </div>
            <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
              {workflow.enabled ? 'Включено' : 'Выключено'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={workflow.enabled}
                disabled={!canManage}
                onChange={(event) => patchWorkflow({ enabled: event.target.checked })}
                className="h-4 w-4"
              />
              Активен
            </label>

            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div>
                <label className="mb-1 block text-sm font-medium">Время МСК</label>
                <Input
                  type="time"
                  value={workflow.timeOfDay}
                  disabled={!canManage}
                  onChange={(event) => patchWorkflow({ timeOfDay: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Google Sheet URL или ID</label>
                <Input
                  value={workflow.config.spreadsheetUrl}
                  disabled={!canManage}
                  onChange={(event) =>
                    patchWorkflow({
                      config: {
                        ...workflow.config,
                        spreadsheetUrl: event.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Кабинет</TableHead>
                  <TableHead>Вкл.</TableHead>
                  <TableHead>Вкладка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflow.accounts.map((account) => (
                  <TableRow key={account.wbAccountId}>
                    <TableCell>
                      <div className="font-medium">{account.wbAccountName}</div>
                      {account.sellerName && (
                        <div className="text-xs text-muted-foreground">{account.sellerName}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={account.enabled}
                        disabled={!canManage}
                        onChange={(event) => patchAccount(account.wbAccountId, { enabled: event.target.checked })}
                        className="h-4 w-4"
                        aria-label="Включить кабинет"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={account.sheetName}
                        disabled={!canManage || !account.enabled}
                        onChange={(event) => patchAccount(account.wbAccountId, { sheetName: event.target.value })}
                        className="max-w-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {workflow.accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                      Активных кабинетов пока нет.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Следующий запуск: {formatNextRun(workflow.nextRunAt)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!canManage || isRunning} onClick={runWorkflow}>
                <Play className="mr-2 h-4 w-4" />
                {isRunning ? 'Запускаем...' : 'Запустить сейчас'}
              </Button>
              <Button disabled={!canManage || isSaving} onClick={saveWorkflow}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
            </div>
          </div>

          {!canManage && (
            <p className="text-sm text-muted-foreground">
              У вашей роли доступен только просмотр автоматизаций.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История запусков</CardTitle>
          <CardDescription>Полная история ручных и запланированных выполнений workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Select value={runFilters.status} onValueChange={(value) => patchRunFilters({ status: value as AutomationRunQuery['status'] })}>
              <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все статусы</SelectItem>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <SelectItem key={status} value={status}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={runFilters.source} onValueChange={(value) => patchRunFilters({ source: value as AutomationRunQuery['source'] })}>
              <SelectTrigger><SelectValue placeholder="Источник" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все источники</SelectItem>
                <SelectItem value="manual">Ручной</SelectItem>
                <SelectItem value="scheduled">Расписание</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker
              value={runDateRange}
              onChange={changeRunDateRange}
              className="w-full min-w-0 md:col-span-2"
            />
            <Input
              value={runFilters.error}
              onChange={(event) => patchRunFilters({ error: event.target.value })}
              placeholder="Текст ошибки"
              aria-label="Фильтр по ошибке"
            />
            <Button
              type="button"
              variant="outline"
              onClick={resetRunFilters}
            >
              Сбросить фильтры
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <RunHistorySortableHead label="Статус" sortKey="status" activeSortKey={runSort.sortBy} direction={runSort.sortDirection} onSort={sortRuns} />
                  <RunHistorySortableHead label="Источник" sortKey="source" activeSortKey={runSort.sortBy} direction={runSort.sortDirection} onSort={sortRuns} />
                  <TableHead>Дата отчета</TableHead>
                  <TableHead>Период</TableHead>
                  <RunHistorySortableHead label="Создано" sortKey="createdAt" activeSortKey={runSort.sortBy} direction={runSort.sortDirection} onSort={sortRuns} />
                  <TableHead>Длительность</TableHead>
                  <RunHistorySortableHead label="Попытки" sortKey="attempts" activeSortKey={runSort.sortBy} direction={runSort.sortDirection} onSort={sortRuns} />
                  <TableHead>Результат</TableHead>
                  <RunHistorySortableHead label="Ошибка" sortKey="error" activeSortKey={runSort.sortBy} direction={runSort.sortDirection} onSort={sortRuns} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[run.status]}>{STATUS_LABELS[run.status]}</Badge>
                    </TableCell>
                    <TableCell>{run.source === 'scheduled' ? 'Расписание' : 'Ручной'}</TableCell>
                    <TableCell>{run.targetDate ?? '-'}</TableCell>
                    <TableCell>{run.period ?? '-'}</TableCell>
                    <TableCell>{formatDateTime(run.createdAt)}</TableCell>
                    <TableCell>{formatDuration(run.durationMs)}</TableCell>
                    <TableCell>{run.attempts}</TableCell>
                    <TableCell>{run.resultSummary ?? '-'}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-destructive">{run.error ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {runsLoading ? 'Загрузка…' : 'Запуски по выбранным фильтрам не найдены.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <RunHistoryPager
            total={runsPage.total}
            page={runsPage.page}
            pageSize={runsPage.pageSize}
            loading={runsLoading}
            onPageChange={(page) => void loadRuns(page, runsPage.pageSize)}
            onPageSizeChange={(pageSize) => void loadRuns(1, pageSize)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
