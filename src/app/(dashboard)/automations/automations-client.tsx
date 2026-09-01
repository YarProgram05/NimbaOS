'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { ArrowRight, Clock3, FileSpreadsheet, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/date-range-picker'
import { MobileSortControls } from '@/components/mobile-sort-controls'
import { Input } from '@/components/ui/input'
import {
  RUN_HISTORY_TABLE_CLASS_NAME,
  RunHistoryCell,
  RunHistoryColumnLayout,
  RunHistoryMobileCard,
  RunHistoryMobileField,
  RunHistoryPager,
  RunHistorySortableHead,
} from '@/components/run-history-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type {
  AutomationCatalogItem,
  AutomationRunQuery,
  AutomationRunRow,
  AutomationRunSortKey,
} from '@/types/automations'
import type { RunHistoryPage, RunHistoryPageSize } from '@/types/run-history'
import { getAutomationCatalogAction, getAutomationRunsAction } from '@/lib/actions/automations'

interface AutomationsClientProps {
  initialAutomations: AutomationCatalogItem[]
  initialRunsPage: RunHistoryPage<AutomationRunRow>
}

const STATUS_LABELS: Record<AutomationRunRow['status'], string> = {
  QUEUED: 'В очереди', RUNNING: 'В работе', SUCCEEDED: 'Готово', FAILED: 'Ошибка',
}
const STATUS_VARIANTS: Record<AutomationRunRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  QUEUED: 'secondary', RUNNING: 'outline', SUCCEEDED: 'default', FAILED: 'destructive',
}
const MOSCOW_TIME_ZONE = 'Europe/Moscow'
const RUN_HISTORY_COLUMN_WIDTHS = [14, 9, 10, 9, 11, 11, 10, 8, 9, 9] as const
const RUN_SORT_OPTIONS = [
  { value: 'name', label: 'Автоматизация' },
  { value: 'status', label: 'Статус' },
  { value: 'source', label: 'Источник' },
  { value: 'createdAt', label: 'Создано' },
  { value: 'attempts', label: 'Попытки' },
  { value: 'error', label: 'Ошибка' },
] satisfies ReadonlyArray<{ value: AutomationRunSortKey; label: string }>

function formatDateTime(value: string | null): string {
  return value ? format(new Date(value), 'd MMM yyyy HH:mm', { locale: ru }) : '-'
}

function formatDuration(value: number | null): string {
  if (value === null) return '-'
  return value < 1000 ? `${value} мс` : `${Math.round(value / 1000)} с`
}

function formatNextRun(value: string | null): string {
  if (!value) return 'Не запланирован'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

export function AutomationsClient({ initialAutomations, initialRunsPage }: AutomationsClientProps) {
  const [automations, setAutomations] = useState(initialAutomations)
  const [runsPage, setRunsPage] = useState(initialRunsPage)
  const [runFilters, setRunFilters] = useState<Required<Pick<
    AutomationRunQuery,
    'kind' | 'status' | 'source' | 'createdFrom' | 'createdTo' | 'error'
  >>>({ kind: 'ALL', status: 'ALL', source: 'ALL', createdFrom: '', createdTo: '', error: '' })
  const [runDateRange, setRunDateRange] = useState<DateRange>({ from: undefined })
  const [runSort, setRunSort] = useState<{ sortBy: AutomationRunSortKey; sortDirection: 'asc' | 'desc' }>({
    sortBy: 'createdAt', sortDirection: 'desc',
  })
  const [runsLoading, setRunsLoading] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()
  const runsRequestId = useRef(0)
  const skipInitialRunFilterLoad = useRef(true)
  const runs = runsPage.rows
  const hasActiveRuns = runs.some((run) => run.status === 'QUEUED' || run.status === 'RUNNING')

  const loadRuns = useCallback(async (page: number, pageSize: RunHistoryPageSize = runsPage.pageSize) => {
    const requestId = ++runsRequestId.current
    setRunsLoading(true)
    const result = await getAutomationRunsAction({ ...runFilters, ...runSort, page, pageSize })
    if (requestId !== runsRequestId.current) return
    setRunsLoading(false)
    if (result.success) setRunsPage(result.data)
    else toast.error(result.error)
  }, [runFilters, runSort, runsPage.pageSize])

  useEffect(() => {
    if (!hasActiveRuns) return
    const timer = window.setInterval(() => void loadRuns(runsPage.page, runsPage.pageSize), 5000)
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

  function refresh() {
    startRefresh(async () => {
      const catalog = await getAutomationCatalogAction()
      if (catalog.success) setAutomations(catalog.data)
      else toast.error(catalog.error)
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
    setRunFilters({ kind: 'ALL', status: 'ALL', source: 'ALL', createdFrom: '', createdTo: '', error: '' })
  }

  function sortRuns(sortBy: AutomationRunSortKey) {
    setRunSort((current) => ({
      sortBy,
      sortDirection: current.sortBy === sortBy && current.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Автоматизации</h1>
          <p className="mt-1 text-sm text-muted-foreground">Выберите процесс, чтобы открыть его настройки и расписание.</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
          <RotateCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Обновить
        </Button>
      </div>

      <section aria-labelledby="automation-list-title">
        <div className="mb-3">
          <h2 id="automation-list-title" className="text-lg font-semibold">Доступные автоматизации</h2>
          <p className="text-sm text-muted-foreground">Настройки каждой автоматизации хранятся отдельно.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {automations.map((automation) => (
            <Card key={automation.kind} className="flex h-full flex-col transition-colors hover:border-primary/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <Badge variant={automation.enabled ? 'default' : 'secondary'}>{automation.enabled ? 'Включено' : 'Выключено'}</Badge>
                </div>
                <CardTitle className="pt-2 text-base">{automation.name}</CardTitle>
                <CardDescription className="min-h-10">{automation.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{automation.scheduleSummary}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Следующий запуск: {formatNextRun(automation.nextRunAt)}</div>
                </div>
                <Button asChild className="w-full">
                  <Link href={`/automations/${automation.kind}`}>Открыть настройки <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История запусков</CardTitle>
          <CardDescription>
            Полная история всех ручных и запланированных автоматизаций. На телефоне записи показаны карточками, на большом экране содержимое ячеек можно раскрывать.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Select value={runFilters.kind} onValueChange={(value) => patchRunFilters({ kind: value as AutomationRunQuery['kind'] })}>
              <SelectTrigger><SelectValue placeholder="Автоматизация" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все автоматизации</SelectItem>
                {automations.map((automation) => <SelectItem key={automation.kind} value={automation.kind}>{automation.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={runFilters.status} onValueChange={(value) => patchRunFilters({ status: value as AutomationRunQuery['status'] })}>
              <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все статусы</SelectItem>
                {Object.entries(STATUS_LABELS).map(([status, label]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}
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
            <DateRangePicker value={runDateRange} onChange={changeRunDateRange} className="w-full min-w-0" />
            <Input value={runFilters.error} onChange={(event) => patchRunFilters({ error: event.target.value })} placeholder="Текст ошибки" aria-label="Фильтр по ошибке" />
            <Button type="button" variant="outline" onClick={resetRunFilters}>Сбросить фильтры</Button>
          </div>
          <MobileSortControls
            value={runSort.sortBy}
            direction={runSort.sortDirection}
            options={RUN_SORT_OPTIONS}
            onFieldChange={(value) => sortRuns(value as AutomationRunSortKey)}
            onDirectionToggle={() => sortRuns(runSort.sortBy)}
            className="mb-3 lg:hidden"
          />
          <div className="space-y-3 lg:hidden">
            {runs.map((run) => (
              <RunHistoryMobileCard
                key={run.id}
                title={run.name}
                status={<Badge variant={STATUS_VARIANTS[run.status]}>{STATUS_LABELS[run.status]}</Badge>}
              >
                <RunHistoryMobileField label="Источник">{run.source === 'scheduled' ? 'Расписание' : run.source === 'manual' ? 'Ручной' : '—'}</RunHistoryMobileField>
                <RunHistoryMobileField label="Создано">{formatDateTime(run.createdAt)}</RunHistoryMobileField>
                <RunHistoryMobileField label="Дата отчёта">{run.targetDate ?? '—'}</RunHistoryMobileField>
                <RunHistoryMobileField label="Длительность">{formatDuration(run.durationMs)}</RunHistoryMobileField>
                <RunHistoryMobileField label="Период" fullWidth>{run.period ?? '—'}</RunHistoryMobileField>
                <RunHistoryMobileField label="Попытки">{run.attempts}</RunHistoryMobileField>
                {run.resultSummary && (
                  <RunHistoryMobileField label="Результат" fullWidth expandable>{run.resultSummary}</RunHistoryMobileField>
                )}
                {run.error && (
                  <RunHistoryMobileField label="Ошибка" fullWidth expandable valueClassName="text-destructive">
                    {run.error}
                  </RunHistoryMobileField>
                )}
              </RunHistoryMobileCard>
            ))}
            {runs.length === 0 && (
              <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
                {runsLoading ? 'Загрузка…' : 'Запуски по выбранным фильтрам не найдены.'}
              </div>
            )}
          </div>
          <div className="hidden overflow-x-auto rounded-md border lg:block">
            <Table className={RUN_HISTORY_TABLE_CLASS_NAME}>
              <RunHistoryColumnLayout widths={RUN_HISTORY_COLUMN_WIDTHS} />
              <TableHeader>
                <TableRow>
                  <RunHistorySortableHead label="Автоматизация" sortKey="name" activeSortKey={runSort.sortBy} direction={runSort.sortDirection} onSort={sortRuns} />
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
                    <RunHistoryCell contentClassName="font-medium">{run.name}</RunHistoryCell>
                    <RunHistoryCell><Badge variant={STATUS_VARIANTS[run.status]}>{STATUS_LABELS[run.status]}</Badge></RunHistoryCell>
                    <RunHistoryCell>{run.source === 'scheduled' ? 'Расписание' : run.source === 'manual' ? 'Ручной' : '—'}</RunHistoryCell>
                    <RunHistoryCell>{run.targetDate ?? '—'}</RunHistoryCell>
                    <RunHistoryCell>{run.period ?? '—'}</RunHistoryCell>
                    <RunHistoryCell>{formatDateTime(run.createdAt)}</RunHistoryCell>
                    <RunHistoryCell>{formatDuration(run.durationMs)}</RunHistoryCell>
                    <RunHistoryCell>{run.attempts}</RunHistoryCell>
                    <RunHistoryCell>{run.resultSummary ?? '—'}</RunHistoryCell>
                    <RunHistoryCell contentClassName="text-destructive">{run.error ?? '—'}</RunHistoryCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">{runsLoading ? 'Загрузка…' : 'Запуски по выбранным фильтрам не найдены.'}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <RunHistoryPager total={runsPage.total} page={runsPage.page} pageSize={runsPage.pageSize} loading={runsLoading} onPageChange={(page) => void loadRuns(page, runsPage.pageSize)} onPageSizeChange={(pageSize) => void loadRuns(1, pageSize)} />
        </CardContent>
      </Card>
    </div>
  )
}
