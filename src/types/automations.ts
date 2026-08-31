export const AUTOMATION_WORKFLOW_KINDS = {
  MORNING_WB_REPORT: 'morning-wb-report',
  FBS_MOVEMENT_SHEET: 'fbs-movement-sheet',
} as const

export type AutomationWorkflowKind =
  (typeof AUTOMATION_WORKFLOW_KINDS)[keyof typeof AUTOMATION_WORKFLOW_KINDS]

export type AutomationRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type AutomationRunSource = 'manual' | 'scheduled'

export type AutomationScheduleCadence = 'daily' | 'weekly' | 'every-n-weeks' | 'monthly'
export type AutomationScheduleTimeMode = 'times' | 'interval'

export interface AutomationSchedule {
  cadence: AutomationScheduleCadence
  timeMode: AutomationScheduleTimeMode
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

export interface MorningWbReportConfig {
  spreadsheetId: string
  spreadsheetUrl: string
  schedule: AutomationSchedule
}

export interface FbsMovementSheetConfig {
  spreadsheetId: string
  spreadsheetUrl: string
  operationsSheetName: string
  controlSheetName: string
  summarySheetName: string
  referenceSheetName: string
  wbStockSheetName: string
  startDate: string
  accountKeys: Record<string, string>
  productAliases: Record<string, string>
  schedule: AutomationSchedule
}

export type AutomationWorkflowConfig = MorningWbReportConfig | FbsMovementSheetConfig

export interface AutomationAccountRow {
  id: string | null
  wbAccountId: string
  wbAccountName: string
  sellerName: string | null
  enabled: boolean
  sheetName: string
  technicalKey?: string
}

export interface AutomationWorkflowRow<TConfig extends AutomationWorkflowConfig = AutomationWorkflowConfig> {
  id: string | null
  kind: AutomationWorkflowKind
  enabled: boolean
  timeOfDay: string
  schedule: AutomationSchedule
  timezone: string
  config: TConfig
  lastAppliedAt: string | null
  nextRunAt: string | null
  accounts: AutomationAccountRow[]
}

export type MorningWbReportWorkflowRow = AutomationWorkflowRow<MorningWbReportConfig>
export type FbsMovementSheetWorkflowRow = AutomationWorkflowRow<FbsMovementSheetConfig>

export interface UpdateMorningWbReportWorkflowInput {
  enabled: boolean
  schedule: AutomationSchedule
  spreadsheetUrl: string
  accounts: Array<{
    wbAccountId: string
    enabled: boolean
    sheetName: string
  }>
}

export interface UpdateFbsMovementSheetWorkflowInput {
  enabled: boolean
  schedule: AutomationSchedule
  spreadsheetUrl: string
  operationsSheetName: string
  controlSheetName: string
  summarySheetName: string
  referenceSheetName: string
  wbStockSheetName: string
  startDate: string
  accounts: Array<{
    wbAccountId: string
    enabled: boolean
    cabinetLabel: string
    technicalKey: string
  }>
}

export interface AutomationRunRow {
  id: string
  kind: AutomationWorkflowKind
  name: string
  status: AutomationRunStatus
  source: AutomationRunSource | null
  bullJobId: string | null
  targetDate: string | null
  period: string | null
  resultSummary: string | null
  error: string | null
  attempts: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
}

export type AutomationRunSortKey =
  | 'name'
  | 'status'
  | 'source'
  | 'createdAt'
  | 'attempts'
  | 'error'

export interface AutomationRunQuery {
  page?: number
  pageSize?: number
  sortBy?: AutomationRunSortKey
  sortDirection?: 'asc' | 'desc'
  kind?: AutomationWorkflowKind | 'ALL'
  status?: AutomationRunStatus | 'ALL'
  source?: AutomationRunSource | 'ALL'
  createdFrom?: string
  createdTo?: string
  error?: string
}

export interface AutomationCatalogItem {
  kind: AutomationWorkflowKind
  name: string
  description: string
  enabled: boolean
  timezone: string
  scheduleSummary: string
  nextRunAt: string | null
  lastAppliedAt: string | null
}

export interface EnqueuedAutomationRun {
  id: string
  kind: AutomationWorkflowKind
  status: AutomationRunStatus
  bullJobId: string | null
}
