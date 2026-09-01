export type ScheduleCadence = 'daily' | 'weekly' | 'every-n-weeks' | 'monthly'
export type ScheduleTimeMode = 'times' | 'interval'

export interface FlexibleSchedule {
  cadence: ScheduleCadence
  timeMode: ScheduleTimeMode
  times: string[]
  interval: {
    startTime: string
    endTime: string
    everyMinutes: number
  }
  weekdays: number[]
  weekInterval: number
  anchorDate: string
  monthDays: number[]
}
