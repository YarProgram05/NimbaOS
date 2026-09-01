'use client'

import type { ReactNode } from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { inspectAutomationSpreadsheetAction } from '@/lib/actions/automations'
import type {
  AutomationAccountRow,
  AutomationSheetTemplateDefinition,
  AutomationSpreadsheetInspection,
} from '@/types/automations'

interface GoogleSheetTemplateEditorProps {
  spreadsheetUrl: string
  sheetTabs: Record<string, string>
  accounts: AutomationAccountRow[]
  definition: AutomationSheetTemplateDefinition
  canManage: boolean
  workflowEnabled: boolean
  additionalSettings?: ReactNode
  onSpreadsheetUrlChange: (value: string) => void
  onSheetTabsChange: (value: Record<string, string>) => void
  onAccountChange: (wbAccountId: string, patch: Partial<AutomationAccountRow>) => void
  onValidityChange?: (valid: boolean) => void
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('ru')
}

export function GoogleSheetTemplateEditor({
  spreadsheetUrl,
  sheetTabs,
  accounts,
  definition,
  canManage,
  workflowEnabled,
  additionalSettings,
  onSpreadsheetUrlChange,
  onSheetTabsChange,
  onAccountChange,
  onValidityChange,
}: GoogleSheetTemplateEditorProps) {
  const listId = `google-sheet-tabs-${useId().replace(/:/g, '')}`
  const [inspection, setInspection] = useState<AutomationSpreadsheetInspection | null>(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const tabTitles = useMemo(() => inspection?.tabs.map((tab) => tab.title) ?? [], [inspection])
  const tabTitleSet = useMemo(() => new Set(tabTitles), [tabTitles])
  const enabledAccounts = useMemo(() => accounts.filter((account) => account.enabled), [accounts])
  const assignedTabNames = useMemo(() => {
    const names = new Set(
      definition.roles
        .map((role) => sheetTabs[role.role]?.trim())
        .filter((sheetName): sheetName is string => Boolean(sheetName)),
    )
    if (definition.accountTargetMode === 'sheet') {
      for (const account of enabledAccounts) {
        if (account.sheetName.trim()) names.add(account.sheetName.trim())
      }
    }
    return names
  }, [definition.accountTargetMode, definition.roles, enabledAccounts, sheetTabs])
  const usedTabs = useMemo(
    () => tabTitles.filter((title) => assignedTabNames.has(title)),
    [assignedTabNames, tabTitles],
  )
  const unusedTabs = useMemo(
    () => tabTitles.filter((title) => !assignedTabNames.has(title)),
    [assignedTabNames, tabTitles],
  )

  const issues = useMemo(() => {
    const next: string[] = []
    if (!spreadsheetUrl.trim()) next.push('Укажите ссылку или ID Google Sheet.')

    const usedRoleTabs = new Set<string>()
    for (const role of definition.roles) {
      const sheetName = sheetTabs[role.role]?.trim() ?? ''
      if (role.required && !sheetName) next.push(`Не выбрана вкладка для назначения «${role.title}».`)
      if (sheetName) {
        const key = normalized(sheetName)
        if (usedRoleTabs.has(key)) next.push(`Вкладка «${sheetName}» назначена нескольким ролям.`)
        usedRoleTabs.add(key)
        if (inspection && !tabTitleSet.has(sheetName)) next.push(`Вкладка «${sheetName}» больше не найдена в Google Sheet.`)
      }
    }

    if (workflowEnabled && enabledAccounts.length === 0) next.push('Для активной автоматизации выберите хотя бы один кабинет.')
    const usedAccountTabs = new Set<string>()
    const usedTechnicalKeys = new Set<string>()
    for (const account of enabledAccounts) {
      const target = account.sheetName.trim()
      if (!target) next.push(`Для кабинета «${account.wbAccountName}» не заполнено поле «${definition.accountTargetLabel}».`)
      if (definition.accountTargetMode === 'sheet' && target) {
        const key = normalized(target)
        if (usedAccountTabs.has(key)) next.push(`Вкладка «${target}» выбрана для нескольких кабинетов.`)
        usedAccountTabs.add(key)
        if (inspection && !tabTitleSet.has(target)) next.push(`Вкладка кабинета «${target}» не найдена в Google Sheet.`)
      }
      if (definition.showTechnicalKeys) {
        const key = normalized(account.technicalKey ?? '')
        if (!key) next.push(`Для кабинета «${account.wbAccountName}» не задан технический ключ.`)
        else if (usedTechnicalKeys.has(key)) next.push(`Технический ключ «${key}» повторяется.`)
        else usedTechnicalKeys.add(key)
      }
    }
    return Array.from(new Set(next))
  }, [
    definition.accountTargetLabel,
    definition.accountTargetMode,
    definition.roles,
    definition.showTechnicalKeys,
    enabledAccounts,
    inspection,
    sheetTabs,
    spreadsheetUrl,
    tabTitleSet,
    workflowEnabled,
  ])

  const isValid = issues.length === 0
  useEffect(() => onValidityChange?.(isValid), [isValid, onValidityChange])

  function changeSpreadsheetUrl(value: string) {
    setInspection(null)
    onSpreadsheetUrlChange(value)
  }

  async function inspectSpreadsheet() {
    setIsInspecting(true)
    const result = await inspectAutomationSpreadsheetAction(spreadsheetUrl)
    setIsInspecting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setInspection(result.data)
    const discovered = new Set(result.data.tabs.map((tab) => tab.title))
    const nextTabs = { ...sheetTabs }
    let autoMapped = 0
    for (const role of definition.roles) {
      const current = nextTabs[role.role]?.trim() ?? ''
      if ((!current || !discovered.has(current)) && discovered.has(role.defaultSheetName)) {
        nextTabs[role.role] = role.defaultSheetName
        autoMapped += 1
      }
    }
    if (autoMapped) onSheetTabsChange(nextTabs)
    toast.success(`Подключено: найдено ${result.data.tabs.length} вкладок`)
  }

  const mappedRoles = definition.roles.filter((role) => sheetTabs[role.role]?.trim()).length

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Подключение</CardTitle>
            <CardDescription>После проверки вкладки загружаются из Google Sheet и становятся доступны для выбора.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Google Sheet URL или ID</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={spreadsheetUrl}
                  disabled={!canManage}
                  onChange={(event) => changeSpreadsheetUrl(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={isInspecting || !spreadsheetUrl.trim()}
                  onClick={inspectSpreadsheet}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isInspecting ? 'animate-spin' : ''}`} />
                  {inspection ? 'Обновить структуру' : 'Проверить подключение'}
                </Button>
              </div>
            </div>
            {inspection && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">{inspection.title}</span>
                  <span>· найдено {inspection.tabs.length}</span>
                  <span>· используется {usedTabs.length}</span>
                  <span>· свободно {unusedTabs.length}</span>
                  {inspection.timeZone && <Badge variant="outline">{inspection.timeZone}</Badge>}
                </div>
                <details open={inspection.tabs.length <= 12} className="rounded-md border bg-muted/20">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    Все вкладки Google Sheet ({inspection.tabs.length})
                  </summary>
                  <div className="grid gap-2 border-t p-3 sm:grid-cols-2">
                    {inspection.tabs.map((tab) => {
                      const isUsed = assignedTabNames.has(tab.title)
                      return (
                        <div key={tab.sheetId} className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                          <span className="min-w-0 break-words font-medium">{tab.title}</span>
                          <Badge variant={isUsed ? 'default' : 'secondary'} className="shrink-0">
                            {isUsed ? 'Используется' : 'Не используется'}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                  {unusedTabs.length > 0 && (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      Неиспользуемые вкладки не считаются ошибкой. Их можно выбрать для существующего назначения.
                    </p>
                  )}
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        {definition.roles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Назначение вкладок</CardTitle>
              <CardDescription>Назначение остается постоянным, а фактическое имя вкладки можно менять без правки кода.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <datalist id={listId}>
                {tabTitles.map((title) => <option key={title} value={title} />)}
              </datalist>
              {definition.roles.map((role) => {
                const value = sheetTabs[role.role] ?? ''
                const found = inspection ? tabTitleSet.has(value.trim()) : null
                return (
                  <div key={role.role} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)_7.5rem] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{role.title}</p>
                        {role.required && <Badge variant="secondary">Обязательно</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground md:sr-only">Вкладка Google Sheet</label>
                      <Input
                        list={listId}
                        value={value}
                        disabled={!canManage}
                        placeholder={inspection ? 'Выберите найденную вкладку' : role.defaultSheetName}
                        onChange={(event) => onSheetTabsChange({ ...sheetTabs, [role.role]: event.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {found === true && <><CheckCircle2 className="h-4 w-4 text-emerald-700" /><span className="text-emerald-700">Найдена</span></>}
                      {found === false && <><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="text-amber-700">Не найдена</span></>}
                      {found === null && <><CircleDashed className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Не проверено</span></>}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {additionalSettings}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Кабинеты</CardTitle>
            <CardDescription>{definition.accountTargetDescription} Технические параметры скрыты от случайного изменения.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {definition.accountTargetMode === 'sheet' && (
              <datalist id={`${listId}-accounts`}>
                {tabTitles.map((title) => <option key={title} value={title} />)}
              </datalist>
            )}
            {accounts.map((account) => {
              const accountTabFound = inspection && definition.accountTargetMode === 'sheet'
                ? tabTitleSet.has(account.sheetName.trim())
                : null
              return (
                <div key={account.wbAccountId} className="rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.9fr)_auto_minmax(16rem,1.1fr)] md:items-center">
                    <div>
                      <div className="font-medium">{account.wbAccountName}</div>
                      {account.sellerName && <div className="text-xs text-muted-foreground">{account.sellerName}</div>}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={account.enabled}
                        disabled={!canManage}
                        onChange={(event) => onAccountChange(account.wbAccountId, { enabled: event.target.checked })}
                        className="h-4 w-4"
                      />
                      Включен
                    </label>
                    <div>
                      <label className="mb-1 block text-xs font-medium">{definition.accountTargetLabel}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          list={definition.accountTargetMode === 'sheet' ? `${listId}-accounts` : undefined}
                          value={account.sheetName}
                          disabled={!canManage || !account.enabled}
                          onChange={(event) => onAccountChange(account.wbAccountId, { sheetName: event.target.value })}
                        />
                        {accountTabFound === true && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />}
                        {accountTabFound === false && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                      </div>
                    </div>
                  </div>
                  {definition.showTechnicalKeys && (
                    <details className="mt-3 border-t pt-2">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground">
                        <ChevronDown className="h-3.5 w-3.5" /> Дополнительные параметры
                      </summary>
                      <div className="mt-2 max-w-sm">
                        <label className="mb-1 block text-xs font-medium">Технический ключ</label>
                        <Input
                          value={account.technicalKey ?? ''}
                          disabled={!canManage || !account.enabled}
                          onChange={(event) => onAccountChange(account.wbAccountId, { technicalKey: event.target.value })}
                          className="font-mono text-xs"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Используется для защиты от дублей. Не меняйте после первого успешного запуска.</p>
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
            {accounts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Активных кабинетов пока нет.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="xl:sticky xl:top-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5" />Проверка шаблона</CardTitle>
          <CardDescription>Состояние подключения и обязательных настроек.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><span>Google Sheet</span><span className="font-medium">{inspection ? 'Подключена' : 'Не проверена'}</span></div>
            {inspection && <div className="flex items-center justify-between gap-2"><span>Используется</span><span className="font-medium">{usedTabs.length} из {tabTitles.length}</span></div>}
            {inspection && <div className="flex items-center justify-between gap-2"><span>Свободно</span><span className="font-medium">{unusedTabs.length}</span></div>}
            {definition.roles.length > 0 && <div className="flex items-center justify-between gap-2"><span>Вкладки</span><span className="font-medium">{mappedRoles} из {definition.roles.length}</span></div>}
            <div className="flex items-center justify-between gap-2"><span>Кабинеты</span><span className="font-medium">{enabledAccounts.length} включено</span></div>
          </div>
          {issues.length > 0 ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
              {issues.map((issue) => <p key={issue} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{issue}</p>)}
            </div>
          ) : (
            <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{inspection ? 'Ошибок нет. Шаблон можно сохранять.' : 'Обязательные поля заполнены. Проверьте подключение перед сохранением.'}</p>
            </div>
          )}
          {inspection && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Если вкладку переименуют, обновите структуру и выберите новое имя — код менять не потребуется.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
