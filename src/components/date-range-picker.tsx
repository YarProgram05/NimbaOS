'use client'

import { useEffect, useState } from 'react'
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
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsMobile(!media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

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
        <Button
          variant="outline"
          className={cn('w-full min-w-0 justify-start gap-2 sm:w-auto sm:min-w-60', className)}
          disabled={disabled}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="min-w-0 truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] flex w-[min(calc(100vw-1rem),920px)] flex-col overflow-hidden p-0 md:w-auto"
        align={isMobile ? 'center' : 'start'}
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        style={{ maxHeight: 'min(calc(100dvh - 1rem), var(--radix-popover-content-available-height))' }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex w-full min-w-0 flex-col md:min-w-max md:flex-row">
            {/* Quick presets sidebar */}
            <div className="min-w-0 border-b p-3 md:flex md:min-w-[165px] md:flex-col md:gap-0.5 md:border-b-0 md:border-r">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Быстрый выбор
              </p>
              <div className="flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain pb-1 md:contents">
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
                        'min-h-11 shrink-0 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent md:min-h-0 md:w-full md:shrink',
                        isActive && 'bg-accent font-medium',
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-w-0 overflow-x-auto">
              <DayPicker
                mode="range"
                selected={tempRange}
                onSelect={setTempRange}
                locale={ru}
                numberOfMonths={isMobile ? 1 : 2}
                defaultMonth={isMobile ? new Date() : subMonths(new Date(), 1)}
                weekStartsOn={1}
                className="mx-auto p-2 sm:p-3"
              />
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 items-center gap-2 border-t bg-popover px-3 py-3 sm:flex sm:justify-end sm:px-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setOpen(false)}
            disabled={disabled}
          >
            Отмена
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleApply}
            disabled={disabled || !tempRange?.from}
          >
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
