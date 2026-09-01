'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowLeft, Play, RotateCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AutomationSheetTemplateDefinition, MorningWbReportWorkflowRow } from '@/types/automations'
import {
  enqueueMorningWbReportAction,
  getMorningWbReportWorkflowAction,
  updateMorningWbReportWorkflowAction,
} from '@/lib/actions/automations'
import { AutomationScheduleEditor } from './automation-schedule-editor'
import { GoogleSheetTemplateEditor } from './google-sheet-template-editor'

function formatNextRun(value: string | null): string {
  if (!value) return 'Не запланирован'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

export function AutomationDetailsClient({
  initialWorkflow,
  canManage,
  name,
  description,
  sheetTemplate,
}: {
  initialWorkflow: MorningWbReportWorkflowRow
  canManage: boolean
  name: string
  description: string
  sheetTemplate: AutomationSheetTemplateDefinition
}) {
  const [workflow, setWorkflow] = useState(initialWorkflow)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isTemplateValid, setIsTemplateValid] = useState(true)
  const [isRefreshing, startRefresh] = useTransition()

  function patchWorkflow(patch: Partial<MorningWbReportWorkflowRow>) {
    setWorkflow((current) => ({ ...current, ...patch }))
  }

  function patchAccount(wbAccountId: string, patch: Partial<MorningWbReportWorkflowRow['accounts'][number]>) {
    setWorkflow((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.wbAccountId === wbAccountId ? { ...account, ...patch } : account),
    }))
  }

  function refresh() {
    startRefresh(async () => {
      const result = await getMorningWbReportWorkflowAction()
      if (result.success) setWorkflow(result.data)
      else toast.error(result.error)
    })
  }

  async function saveWorkflow() {
    setIsSaving(true)
    const result = await updateMorningWbReportWorkflowAction({
      enabled: workflow.enabled,
      schedule: workflow.schedule,
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
    toast.success('Настройки автоматизации сохранены')
  }

  async function runWorkflow() {
    setIsRunning(true)
    const result = await enqueueMorningWbReportAction()
    setIsRunning(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(`Автоматизация поставлена в очередь: ${result.data.id}`)
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
          <CardDescription>Все даты и время рассчитываются по Москве.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={workflow.enabled}
              disabled={!canManage}
              onChange={(event) => patchWorkflow({ enabled: event.target.checked })}
              className="h-4 w-4"
            />
            Автоматизация активна
          </label>
          <AutomationScheduleEditor
            schedule={workflow.schedule}
            disabled={!canManage}
            onChange={(schedule) => patchWorkflow({ schedule, config: { ...workflow.config, schedule } })}
          />
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
        onSpreadsheetUrlChange={(spreadsheetUrl) => patchWorkflow({
          config: { ...workflow.config, spreadsheetUrl },
        })}
        onSheetTabsChange={(sheetTabs) => patchWorkflow({ config: { ...workflow.config, sheetTabs } })}
        onAccountChange={patchAccount}
        onValidityChange={setIsTemplateValid}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        {!canManage ? (
          <p className="text-sm text-muted-foreground">У вашей роли доступен только просмотр автоматизации.</p>
        ) : <span />}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!canManage || isRunning} onClick={runWorkflow}>
            <Play className="mr-2 h-4 w-4" /> {isRunning ? 'Запускаем...' : 'Запустить сейчас'}
          </Button>
          <Button disabled={!canManage || isSaving || !isTemplateValid} onClick={saveWorkflow}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
          </Button>
        </div>
      </div>
    </div>
  )
}
