'use client'

import { useState } from 'react'
import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { DayPicker, type DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
  disabled?: boolean
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: 'Прошлая неделя',
    getRange: () => {
      const last = subWeeks(new Date(), 1)
      return { from: startOfWeek(last, { weekStartsOn: 1 }), to: endOfWeek(last, { weekStartsOn: 1 }) }
    },
  },
  {
    label: 'Последние 2 недели',
    getRange: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Прошлый месяц',
    getRange: () => {
      const last = subMonths(new Date(), 1)
      return { from: startOfMonth(last), to: endOfMonth(last) }
    },
  },
  {
    label: 'Текущий месяц',
    getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  {
    label: 'Последние 30 дней',
    getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
]

export function DateRangePicker({ value, onChange, className, disabled = false }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [tempRange, setTempRange] = useState<DateRange | undefined>(value)

  const label =
    value.from && value.to
      ? `${format(value.from, 'd MMM yyyy', { locale: ru })} — ${format(value.to, 'd MMM yyyy', { locale: ru })}`
      : 'Выберите период'

  function handleOpen(v: boolean) {
    if (v) setTempRange(value)
    setOpen(v)
  }

  function handleApply() {
    if (tempRange?.from) {
      onChange({ from: tempRange.from, to: tempRange.to ?? tempRange.from })
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('min-w-60 justify-start gap-2', className)} disabled={disabled}>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] max-h-[calc(100vh-5rem)] w-[min(calc(100vw-1rem),920px)] overflow-auto p-0 sm:w-auto"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
      >
        <div className="flex min-w-max">
          {/* Quick presets sidebar */}
          <div className="flex flex-col gap-0.5 border-r p-3 min-w-[165px]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">
              Быстрый выбор
            </p>
            {PRESETS.map((preset) => {
              const range = preset.getRange()
              const isActive =
                tempRange?.from?.toDateString() === range.from?.toDateString() &&
                tempRange?.to?.toDateString() === range.to?.toDateString()
              return (
                <button
                  key={preset.label}
                  onClick={() => setTempRange(preset.getRange())}
                  disabled={disabled}
                  className={cn(
                    'text-sm text-left px-3 py-2 rounded-md hover:bg-accent transition-colors cursor-pointer',
                    isActive && 'bg-accent font-medium',
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Calendar + Apply */}
          <div className="flex flex-col">
            <DayPicker
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              locale={ru}
              numberOfMonths={2}
              defaultMonth={subMonths(new Date(), 1)}
              weekStartsOn={1}
              className="p-3"
            />

            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={disabled}>
                Отмена
              </Button>
              <Button size="sm" onClick={handleApply} disabled={disabled || !tempRange?.from}>
                Применить
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
