'use client'

import { FlexibleScheduleEditor } from '@/components/flexible-schedule-editor'
import type { AutomationSchedule } from '@/types/automations'

export function AutomationScheduleEditor({
  schedule,
  onChange,
  disabled,
}: {
  schedule: AutomationSchedule
  onChange: (schedule: AutomationSchedule) => void
  disabled: boolean
}) {
  return (
    <FlexibleScheduleEditor
      schedule={schedule}
      onChange={onChange}
      disabled={disabled}
    />
  )
}
