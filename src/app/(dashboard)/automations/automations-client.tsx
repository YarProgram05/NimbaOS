'use client'

import { useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Play, RotateCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  AutomationRunRow,
  AutomationWorkflowRow,
} from '@/types/automations'
import {
  enqueueMorningWbReportAction,
  getAutomationRunsAction,
  getMorningWbReportWorkflowAction,
  updateMorningWbReportWorkflowAction,
} from '@/lib/actions/automations'

interface AutomationsClientProps {
  initialWorkflow: AutomationWorkflowRow
  initialRuns: AutomationRunRow[]
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
  initialRuns,
  canManage,
}: AutomationsClientProps) {
  const [workflow, setWorkflow] = useState(initialWorkflow)
  const [runs, setRuns] = useState(initialRuns)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()
  const hasActiveRuns = runs.some((run) => run.status === 'QUEUED' || run.status === 'RUNNING')

  useEffect(() => {
    if (!hasActiveRuns) return

    const timer = window.setInterval(async () => {
      const result = await getAutomationRunsAction()
      if (result.success) setRuns(result.data)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [hasActiveRuns])

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
      const [workflowResult, runsResult] = await Promise.all([
        getMorningWbReportWorkflowAction(),
        getAutomationRunsAction(),
      ])
      if (workflowResult.success) setWorkflow(workflowResult.data)
      else toast.error(workflowResult.error)
      if (runsResult.success) setRuns(runsResult.data)
      else toast.error(runsResult.error)
    })
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
          <CardDescription>Последние ручные и запланированные выполнения workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Статус</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead>Дата отчета</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Длительность</TableHead>
                  <TableHead>Попытки</TableHead>
                  <TableHead>Результат</TableHead>
                  <TableHead>Ошибка</TableHead>
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
                      Запусков пока нет.
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
