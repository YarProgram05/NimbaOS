'use client'

import { AlertTriangle, CalendarClock, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FlexibleScheduleEditor } from '@/components/flexible-schedule-editor'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  expandFlexibleScheduleTimes,
  formatFlexibleSchedule,
  getNextFlexibleRuns,
  validateFlexibleSchedule,
  type FlexibleScheduleValidationOptions,
} from '@/lib/schedules/flexible-schedule'
import { getSyncScheduleDefinition, SYNC_ALLOWED_TIME_MODES } from '@/lib/sync/catalog'
import type { SyncScheduleRow } from '@/types/sync'

const MOSCOW_TIME_ZONE = 'Europe/Moscow'

function syncScheduleOptions(): FlexibleScheduleValidationOptions {
  return {
    allowedCadences: ['daily', 'weekly'],
    allowedTimeModes: SYNC_ALLOWED_TIME_MODES,
    maxRunsPerDay: 288,
  }
}

function formatRun(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value)
}

function schedulesCanShareDay(left: SyncScheduleRow, right: SyncScheduleRow): boolean {
  if (left.schedule.cadence === 'daily' || right.schedule.cadence === 'daily') return true
  return left.schedule.weekdays.some((day) => right.schedule.weekdays.includes(day))
}

export function SyncScheduleDrawer({
  draft,
  allSchedules,
  open,
  saving,
  disabled,
  onOpenChange,
  onChange,
  onSave,
}: {
  draft: SyncScheduleRow | null
  allSchedules: SyncScheduleRow[]
  open: boolean
  saving: boolean
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onChange: (schedule: SyncScheduleRow) => void
  onSave: () => void
}) {
  if (!draft) return null
  const definition = getSyncScheduleDefinition(draft.kind)
  const options = syncScheduleOptions()

  let validationError: string | null = null
  let summary = ''
  let nextRuns: Date[] = []
  let currentTimes: string[] = []
  try {
    const normalized = validateFlexibleSchedule(draft.schedule, options)
    summary = formatFlexibleSchedule(normalized, options)
    currentTimes = expandFlexibleScheduleTimes(normalized, options)
    if (draft.enabled) nextRuns = getNextFlexibleRuns(normalized, 3, new Date(), options)
  } catch (error) {
    validationError = error instanceof Error ? error.message : 'Проверьте расписание'
  }

  const currentTimeSet = new Set(currentTimes)
  const conflicts = validationError || !draft.enabled
    ? []
    : allSchedules.filter((schedule) => {
        if (!schedule.enabled || schedule.kind === draft.kind || !schedulesCanShareDay(draft, schedule)) return false
        try {
          return expandFlexibleScheduleTimes(schedule.schedule, syncScheduleOptions())
            .some((time) => currentTimeSet.has(time))
        } catch {
          return false
        }
      })

  function resetRecommended() {
    onChange({
      ...draft!,
      schedule: structuredClone(definition.recommendedSchedule),
      rollingDays: definition.recommendedRollingDays,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-4 py-5 pr-12 sm:pl-6 sm:pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{definition.title}</SheetTitle>
            <Badge variant={draft.enabled ? 'default' : 'secondary'}>
              {draft.enabled ? 'Включено' : 'Выключено'}
            </Badge>
          </div>
          <SheetDescription>{definition.description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <label htmlFor="sync-schedule-enabled" className="text-sm font-medium">Автоматический запуск</label>
              <p className="mt-1 text-xs text-muted-foreground">
                Сохранение сразу заменит расписание этой задачи в очереди.
              </p>
            </div>
            <label
              htmlFor="sync-schedule-enabled"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-start justify-end"
            >
              <input
                id="sync-schedule-enabled"
                type="checkbox"
                checked={draft.enabled}
                disabled={disabled}
                onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
                className="mt-0.5 h-5 w-5"
              />
              <span className="sr-only">Переключить автоматический запуск</span>
            </label>
          </div>

          <FlexibleScheduleEditor
            schedule={draft.schedule}
            onChange={(schedule) => onChange({ ...draft, schedule })}
            disabled={disabled}
            allowedCadences={['daily', 'weekly']}
            allowedTimeModes={SYNC_ALLOWED_TIME_MODES}
          />

          {definition.dataDepthMode === 'rolling' && (
            <div className="rounded-lg border p-4">
              <label htmlFor="sync-rolling-days" className="text-sm font-medium">
                Обновлять последние, дней
              </label>
              <p className="mb-3 mt-1 text-xs text-muted-foreground">
                При каждом запуске задача повторно проверит этот скользящий период. Допустимо от 1 до 30 дней.
              </p>
              <Input
                id="sync-rolling-days"
                type="number"
                min={1}
                max={30}
                value={draft.rollingDays}
                disabled={disabled}
                onChange={(event) => onChange({ ...draft, rollingDays: Number(event.target.value) })}
                className="w-32"
              />
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="h-4 w-4" /> Предпросмотр
            </div>
            {validationError ? (
              <p className="mt-2 text-sm text-destructive">{validationError}</p>
            ) : draft.enabled ? (
              <>
                <p className="mt-2 text-sm">{summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextRuns.map((run) => (
                    <Badge key={run.toISOString()} variant="outline">{formatRun(run)} МСК</Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Расписание настроено, но автоматические запуски выключены.</p>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Есть совпадающее время запуска</p>
                <p className="mt-1">
                  Одновременно настроены: {conflicts.map((item) => getSyncScheduleDefinition(item.kind).title).join(', ')}.
                  Очередь выполнит задачи последовательно, поэтому следующая может начаться позже.
                </p>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
            onClick={resetRecommended}
            disabled={disabled}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Вернуть рекомендуемые настройки
          </Button>
        </div>

        <SheetFooter className="gap-2 border-t bg-background px-4 py-4 sm:px-6 [&_button]:w-full sm:[&_button]:w-auto">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={saving}>Отмена</Button>
          </SheetClose>
          <Button
            type="button"
            onClick={onSave}
            disabled={disabled || saving || Boolean(validationError) || draft.rollingDays < 1 || draft.rollingDays > 30}
          >
            {saving ? 'Сохраняем...' : 'Сохранить расписание'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
