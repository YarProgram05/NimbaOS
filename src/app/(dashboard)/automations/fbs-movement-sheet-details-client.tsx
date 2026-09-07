'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowLeft, Play, RotateCw, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AutomationSheetTemplateDefinition, FbsMovementSheetWorkflowRow } from '@/types/automations'
import {
  enqueueFbsMovementSheetAction,
  getFbsMovementSheetWorkflowAction,
  updateFbsMovementSheetWorkflowAction,
} from '@/lib/actions/automations'
import { AutomationScheduleEditor } from './automation-schedule-editor'
import { GoogleSheetTemplateEditor } from './google-sheet-template-editor'
import { FbsMappingReview } from './fbs-mapping-review'
import type { FbsSheetMappingReview } from '@/types/fbs-sheet-mappings'

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
  sheetTemplate,
  initialMappingReview,
}: {
  initialWorkflow: FbsMovementSheetWorkflowRow
  canManage: boolean
  name: string
  description: string
  sheetTemplate: AutomationSheetTemplateDefinition
  initialMappingReview: FbsSheetMappingReview
}) {
  const [workflow, setWorkflow] = useState(initialWorkflow)
  const [targetDate, setTargetDate] = useState(yesterdayMoscow)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isTemplateValid, setIsTemplateValid] = useState(true)
  const [isConfirmingMapping, setIsConfirmingMapping] = useState(false)
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
      sheetTabs: workflow.config.sheetTabs,
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

      <FbsMappingReview initialReview={initialMappingReview} canManage={canManage}
        disabled={isSaving || isRunning} onBusyChange={setIsConfirmingMapping} />

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

      <GoogleSheetTemplateEditor
        spreadsheetUrl={workflow.config.spreadsheetUrl}
        sheetTabs={workflow.config.sheetTabs}
        accounts={workflow.accounts}
        definition={sheetTemplate}
        canManage={canManage}
        workflowEnabled={workflow.enabled}
        onSpreadsheetUrlChange={(spreadsheetUrl) => patchConfig({ spreadsheetUrl })}
        onSheetTabsChange={(sheetTabs) => patchConfig({ sheetTabs })}
        onAccountChange={patchAccount}
        onValidityChange={setIsTemplateValid}
        additionalSettings={(
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Параметры загрузки</CardTitle>
              <CardDescription>Дата ограничивает самый ранний день автоматического учета.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <label className="mb-1 block text-sm font-medium">Автоматически учитывать с даты</label>
                <Input type="date" value={workflow.config.startDate} disabled={!canManage}
                  onChange={(event) => patchConfig({ startDate: event.target.value })} />
              </div>
            </CardContent>
          </Card>
        )}
      />

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
          <Button variant="outline" disabled={!canManage || isRunning || isConfirmingMapping} onClick={runWorkflow}>
            <Play className="mr-2 h-4 w-4" /> {isRunning ? 'Запускаем...' : 'Запустить сейчас'}
          </Button>
          <Button disabled={!canManage || isSaving || isConfirmingMapping || !isTemplateValid} onClick={saveWorkflow}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
          </Button>
        </div>
      </div>
    </div>
  )
}
