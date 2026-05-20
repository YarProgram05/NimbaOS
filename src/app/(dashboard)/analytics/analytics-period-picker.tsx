'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/date-range-picker'
import type { DashboardPeriod } from '@/types/dashboard'

interface AnalyticsPeriodPickerProps {
  accountId: string
  period: DashboardPeriod
}

export function AnalyticsPeriodPicker({ accountId, period }: AnalyticsPeriodPickerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const range: DateRange = {
    from: new Date(period.dateFrom),
    to: new Date(period.dateTo),
  }

  function handleRangeChange(nextRange: DateRange) {
    if (!nextRange.from) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('account', accountId)
    params.set('period', 'custom')
    params.set('dateFrom', format(nextRange.from, 'yyyy-MM-dd'))
    params.set('dateTo', format(nextRange.to ?? nextRange.from, 'yyyy-MM-dd'))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <DateRangePicker
      value={range}
      onChange={handleRangeChange}
      className="h-9 min-w-[250px] text-xs"
    />
  )
}
