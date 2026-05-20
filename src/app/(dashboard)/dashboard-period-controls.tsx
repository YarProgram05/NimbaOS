'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/date-range-picker'
import type { DashboardPeriod, DashboardPeriodPreset, DashboardSummaryRequest } from '@/types/dashboard'
import { DashboardExportButtons } from './dashboard-export-buttons'

interface DashboardPeriodControlsProps {
  accountId: string
  period: DashboardPeriod
  exportRequest: DashboardSummaryRequest
}

const PERIODS: { value: DashboardPeriodPreset; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'last7', label: '7 дней' },
  { value: 'currentMonth', label: 'Месяц' },
  { value: 'previousMonth', label: 'Прошлый' },
]

export function DashboardPeriodControls({
  accountId,
  period,
  exportRequest,
}: DashboardPeriodControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const range: DateRange = {
    from: new Date(period.dateFrom),
    to: new Date(period.dateTo),
  }

  function navigate(params: URLSearchParams) {
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function handlePresetChange(preset: DashboardPeriodPreset) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('account', accountId)
    params.set('period', preset)
    params.delete('dateFrom')
    params.delete('dateTo')
    navigate(params)
  }

  function handleRangeChange(nextRange: DateRange) {
    if (!nextRange.from) return

    const dateFrom = format(nextRange.from, 'yyyy-MM-dd')
    const dateTo = format(nextRange.to ?? nextRange.from, 'yyyy-MM-dd')
    const params = new URLSearchParams(searchParams.toString())
    params.set('account', accountId)
    params.set('period', 'custom')
    params.set('dateFrom', dateFrom)
    params.set('dateTo', dateTo)
    navigate(params)
  }

  return (
    <div className="flex flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={period.preset === item.value ? 'default' : 'outline'}
            className="h-8 px-3 text-xs"
            disabled={isPending}
            onClick={() => handlePresetChange(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          value={range}
          onChange={handleRangeChange}
          className="h-9 min-w-[250px] text-xs"
          disabled={isPending}
        />
        <DashboardExportButtons request={exportRequest} />
      </div>
      {isPending && (
        <p className="text-xs font-medium text-muted-foreground">Обновляем период...</p>
      )}
    </div>
  )
}
