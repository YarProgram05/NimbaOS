'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FlexibleSchedule, ScheduleCadence, ScheduleTimeMode } from '@/types/schedules'

const WEEKDAYS = [
  { value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
]

const CADENCE_LABELS: Record<ScheduleCadence, string> = {
  daily: 'Каждый день',
  weekly: 'По дням недели',
  'every-n-weeks': 'Раз в несколько недель',
  monthly: 'Раз в месяц',
}

export function FlexibleScheduleEditor({
  schedule,
  onChange,
  disabled,
  allowedCadences = ['daily', 'weekly', 'every-n-weeks', 'monthly'],
  allowedTimeModes = ['times', 'interval'],
}: {
  schedule: FlexibleSchedule
  onChange: (schedule: FlexibleSchedule) => void
  disabled: boolean
  allowedCadences?: ScheduleCadence[]
  allowedTimeModes?: ScheduleTimeMode[]
}) {
  function patch(patchValue: Partial<FlexibleSchedule>) {
    onChange({ ...schedule, ...patchValue })
  }

  function toggleWeekday(value: number) {
    const weekdays = schedule.weekdays.includes(value)
      ? schedule.weekdays.filter((day) => day !== value)
      : [...schedule.weekdays, value].sort((a, b) => a - b)
    patch({ weekdays })
  }

  function toggleMonthDay(value: number) {
    const monthDays = schedule.monthDays.includes(value)
      ? schedule.monthDays.filter((day) => day !== value)
      : [...schedule.monthDays, value].sort((a, b) => a - b)
    patch({ monthDays })
  }

  function updateTime(index: number, value: string) {
    patch({ times: schedule.times.map((time, currentIndex) => currentIndex === index ? value : time) })
  }

  function addTime() {
    const candidates = ['10:00', '12:00', '15:00', '18:00', '21:00', '08:00']
    const next = candidates.find((time) => !schedule.times.includes(time)) ?? '10:00'
    patch({ times: [...schedule.times, next] })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Периодичность</label>
          <Select
            value={schedule.cadence}
            disabled={disabled}
            onValueChange={(value) => patch({ cadence: value as FlexibleSchedule['cadence'] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedCadences.map((cadence) => (
                <SelectItem key={cadence} value={cadence}>{CADENCE_LABELS[cadence]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Запуски в течение дня</label>
          <Select
            value={schedule.timeMode}
            disabled={disabled || allowedTimeModes.length === 1}
            onValueChange={(value) => patch({ timeMode: value as FlexibleSchedule['timeMode'] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedTimeModes.includes('times') && <SelectItem value="times">В выбранное время</SelectItem>}
              {allowedTimeModes.includes('interval') && <SelectItem value="interval">С интервалом в диапазоне</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(schedule.cadence === 'weekly' || schedule.cadence === 'every-n-weeks') && (
        <div>
          <label className="mb-2 block text-sm font-medium">Дни недели</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <Button
                key={day.value}
                type="button"
                size="sm"
                variant={schedule.weekdays.includes(day.value) ? 'default' : 'outline'}
                disabled={disabled}
                onClick={() => toggleWeekday(day.value)}
                aria-pressed={schedule.weekdays.includes(day.value)}
              >
                {day.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {schedule.cadence === 'every-n-weeks' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Повторять каждые, недель</label>
            <Input
              type="number"
              min={2}
              max={12}
              value={schedule.weekInterval}
              disabled={disabled}
              onChange={(event) => patch({ weekInterval: Number(event.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Начать отсчёт с недели</label>
            <Input
              type="date"
              value={schedule.anchorDate}
              disabled={disabled}
              onChange={(event) => patch({ anchorDate: event.target.value })}
            />
          </div>
        </div>
      )}

      {schedule.cadence === 'monthly' && (
        <div>
          <label className="mb-2 block text-sm font-medium">Дни месяца</label>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={schedule.monthDays.includes(day) ? 'default' : 'outline'}
                disabled={disabled}
                onClick={() => toggleMonthDay(day)}
                aria-pressed={schedule.monthDays.includes(day)}
                className="h-8 min-w-8 px-2"
              >
                {day}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Если выбранного числа в месяце нет, запуск в этом месяце пропускается.</p>
        </div>
      )}

      {schedule.timeMode === 'times' ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium">Время запуска, МСК</label>
            <Button type="button" size="sm" variant="outline" disabled={disabled || schedule.times.length >= 24} onClick={addTime}>
              <Plus className="mr-1.5 h-4 w-4" /> Добавить время
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {schedule.times.map((time, index) => (
              <div key={`${index}-${time}`} className="flex items-center gap-2">
                <Input type="time" value={time} disabled={disabled} onChange={(event) => updateTime(index, event.target.value)} />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled || schedule.times.length === 1}
                  onClick={() => patch({ times: schedule.times.filter((_, currentIndex) => currentIndex !== index) })}
                  aria-label="Удалить время"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Начало, МСК</label>
            <Input
              type="time"
              value={schedule.interval.startTime}
              disabled={disabled}
              onChange={(event) => patch({ interval: { ...schedule.interval, startTime: event.target.value } })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Окончание, МСК</label>
            <Input
              type="time"
              value={schedule.interval.endTime}
              disabled={disabled}
              onChange={(event) => patch({ interval: { ...schedule.interval, endTime: event.target.value } })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Каждые, минут</label>
            <Input
              type="number"
              min={5}
              max={720}
              value={schedule.interval.everyMinutes}
              disabled={disabled}
              onChange={(event) => patch({ interval: { ...schedule.interval, everyMinutes: Number(event.target.value) } })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
