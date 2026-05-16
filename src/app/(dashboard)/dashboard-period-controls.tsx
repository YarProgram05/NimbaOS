'use client'

import Link from 'next/link'
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
  const range: DateRange = {
    from: new Date(period.dateFrom),
    to: new Date(period.dateTo),
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
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((item) => (
          <Button
            key={item.value}
            asChild
            size="sm"
            variant={period.preset === item.value ? 'default' : 'outline'}
            className="h-8 px-3 text-xs"
          >
            <Link href={`/?account=${accountId}&period=${item.value}`}>{item.label}</Link>
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={range} onChange={handleRangeChange} className="h-9 min-w-[250px] text-xs" />
        <DashboardExportButtons request={exportRequest} />
      </div>
    </div>
  )
}
