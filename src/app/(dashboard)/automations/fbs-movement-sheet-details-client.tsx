'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowLeft, Play, RotateCw, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FbsMovementSheetWorkflowRow } from '@/types/automations'
import {
  enqueueFbsMovementSheetAction,
  getFbsMovementSheetWorkflowAction,
  updateFbsMovementSheetWorkflowAction,
} from '@/lib/actions/automations'
import { AutomationScheduleEditor } from './automation-schedule-editor'

function yesterdayMoscow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const today = new Date(`${read('year')}-${read('month')}-${read('day')}T00:00:00Z`)
  today.setUTCDate(today.getUTCDate() - 1)
  return today.toISOString().slice(0, 10)
}

function formatNextRun(value: string | null) {
  if (!value) return 'Не запланирован'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

export function FbsMovementSheetDetailsClient({
  initialWorkflow,
  canManage,
  name,
  description,
}: {
  initialWorkflow: FbsMovementSheetWorkflowRow
  canManage: boolean
  name: string
  description: string
}) {
  const [workflow, setWorkflow] = useState(initialWorkflow)
  const [targetDate, setTargetDate] = useState(yesterdayMoscow)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()

  function patchWorkflow(patch: Partial<FbsMovementSheetWorkflowRow>) {
    setWorkflow((current) => ({ ...current, ...patch }))
  }

  function patchAccount(wbAccountId: string, patch: Partial<FbsMovementSheetWorkflowRow['accounts'][number]>) {
    setWorkflow((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.wbAccountId === wbAccountId ? { ...account, ...patch } : account),
    }))
  }

  function patchConfig(patch: Partial<FbsMovementSheetWorkflowRow['config']>) {
    setWorkflow((current) => ({ ...current, config: { ...current.config, ...patch } }))
  }

  function refresh() {
    startRefresh(async () => {
      const result = await getFbsMovementSheetWorkflowAction()
      if (result.success) setWorkflow(result.data)
      else toast.error(result.error)
    })
  }

  async function saveWorkflow() {
    setIsSaving(true)
    const result = await updateFbsMovementSheetWorkflowAction({
      enabled: workflow.enabled,
      schedule: workflow.schedule,
      spreadsheetUrl: workflow.config.spreadsheetUrl || workflow.config.spreadsheetId,
      operationsSheetName: workflow.config.operationsSheetName,
      controlSheetName: workflow.config.controlSheetName,
      summarySheetName: workflow.config.summarySheetName,
      referenceSheetName: workflow.config.referenceSheetName,
      wbStockSheetName: workflow.config.wbStockSheetName,
      startDate: workflow.config.startDate,
      accounts: workflow.accounts.map((account) => ({
        wbAccountId: account.wbAccountId,
        enabled: account.enabled,
        cabinetLabel: account.sheetName,
        technicalKey: account.technicalKey ?? '',
      })),
    })
    setIsSaving(false)
    if (!result.success) return toast.error(result.error)
    setWorkflow(result.data)
    toast.success('Настройки FBS-автоматизации сохранены')
  }

  async function runWorkflow() {
    setIsRunning(true)
    const result = await enqueueFbsMovementSheetAction(targetDate)
    setIsRunning(false)
    if (!result.success) return toast.error(result.error)
    toast.success(`Загрузка поставлена в очередь: ${result.data.id}`)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link href="/automations"><ArrowLeft className="mr-2 h-4 w-4" />К списку автоматизаций</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <Badge variant={workflow.enabled ? 'default' : 'secondary'}>{workflow.enabled ? 'Включено' : 'Выключено'}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
          <RotateCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Обновить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Состояние и расписание</CardTitle>
          <CardDescription>Плановый запуск обрабатывает предыдущий завершившийся день по Москве.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={workflow.enabled} disabled={!canManage}
              onChange={(event) => patchWorkflow({ enabled: event.target.checked })} className="h-4 w-4" />
            Автоматизация активна
          </label>
          <AutomationScheduleEditor schedule={workflow.schedule} disabled={!canManage}
            onChange={(schedule) => patchWorkflow({ schedule, config: { ...workflow.config, schedule } })} />
          <div className="rounded-md bg-muted/40 px-4 py-3 text-sm">
            Следующий сохранённый запуск: <span className="font-medium">{formatNextRun(workflow.nextRunAt)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Таблица учета</CardTitle>
          <CardDescription>Названия вкладок меняйте только если они действительно переименованы в Google Sheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Google Sheet URL или ID</label>
            <Input value={workflow.config.spreadsheetUrl} disabled={!canManage}
              onChange={(event) => patchConfig({ spreadsheetUrl: event.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {([
              ['operationsSheetName', 'Операции'], ['controlSheetName', 'Контроль загрузки'],
              ['summarySheetName', 'Сводка'], ['referenceSheetName', 'Справочники'],
              ['wbStockSheetName', 'Остатки WB'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium">Вкладка «{label}»</label>
                <Input value={workflow.config[key]} disabled={!canManage}
                  onChange={(event) => patchConfig({ [key]: event.target.value })} />
              </div>
            ))}
          </div>
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium">Автоматически учитывать с даты</label>
            <Input type="date" value={workflow.config.startDate} disabled={!canManage}
              onChange={(event) => patchConfig({ startDate: event.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Кабинеты</CardTitle>
          <CardDescription>Название видно сотрудникам. Технический ключ нужен только для защиты от дублей и обычно не меняется.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[880px]">
              <TableHeader><TableRow><TableHead>Кабинет NimbaOS</TableHead><TableHead>Вкл.</TableHead><TableHead>Название в таблице</TableHead><TableHead>Технический ключ</TableHead></TableRow></TableHeader>
              <TableBody>
                {workflow.accounts.map((account) => (
                  <TableRow key={account.wbAccountId}>
                    <TableCell><div className="font-medium">{account.wbAccountName}</div>{account.sellerName && <div className="text-xs text-muted-foreground">{account.sellerName}</div>}</TableCell>
                    <TableCell><input type="checkbox" checked={account.enabled} disabled={!canManage}
                      onChange={(event) => patchAccount(account.wbAccountId, { enabled: event.target.checked })} className="h-4 w-4" /></TableCell>
                    <TableCell><Input value={account.sheetName} disabled={!canManage || !account.enabled}
                      onChange={(event) => patchAccount(account.wbAccountId, { sheetName: event.target.value })} /></TableCell>
                    <TableCell><Input value={account.technicalKey ?? ''} disabled={!canManage || !account.enabled}
                      onChange={(event) => patchAccount(account.wbAccountId, { technicalKey: event.target.value })} className="font-mono text-xs" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="flex gap-3 pt-6 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p>Перед записью проверяются часовой пояс, заголовки и формула сводки. Повторный запуск обновляет строки по ключу; возврат добавляется только после фактического приема в NimbaOS.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="w-48">
          <label className="mb-1 block text-sm font-medium">Запустить по дату</label>
          <Input type="date" value={targetDate} max={yesterdayMoscow()} disabled={!canManage || isRunning}
            onChange={(event) => setTargetDate(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!canManage || isRunning} onClick={runWorkflow}>
            <Play className="mr-2 h-4 w-4" /> {isRunning ? 'Запускаем...' : 'Запустить сейчас'}
          </Button>
          <Button disabled={!canManage || isSaving} onClick={saveWorkflow}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
          </Button>
        </div>
      </div>
    </div>
  )
}
