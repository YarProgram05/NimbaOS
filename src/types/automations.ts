export const AUTOMATION_WORKFLOW_KINDS = {
  MORNING_WB_REPORT: 'morning-wb-report',
} as const

export type AutomationWorkflowKind =
  (typeof AUTOMATION_WORKFLOW_KINDS)[keyof typeof AUTOMATION_WORKFLOW_KINDS]

export type AutomationRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type AutomationRunSource = 'manual' | 'scheduled'

export interface MorningWbReportConfig {
  spreadsheetId: string
  spreadsheetUrl: string
}

export interface AutomationAccountRow {
  id: string | null
  wbAccountId: string
  wbAccountName: string
  sellerName: string | null
  enabled: boolean
  sheetName: string
}

export interface AutomationWorkflowRow {
  id: string | null
  kind: AutomationWorkflowKind
  enabled: boolean
  timeOfDay: string
  timezone: string
  config: MorningWbReportConfig
  lastAppliedAt: string | null
  nextRunAt: string | null
  accounts: AutomationAccountRow[]
}

export interface UpdateMorningWbReportWorkflowInput {
  enabled: boolean
  timeOfDay: string
  spreadsheetUrl: string
  accounts: Array<{
    wbAccountId: string
    enabled: boolean
    sheetName: string
  }>
}

export interface AutomationRunRow {
  id: string
  kind: AutomationWorkflowKind
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
  status?: AutomationRunStatus | 'ALL'
  source?: AutomationRunSource | 'ALL'
  createdFrom?: string
  createdTo?: string
  error?: string
}

export interface EnqueuedAutomationRun {
  id: string
  kind: AutomationWorkflowKind
  status: AutomationRunStatus
  bullJobId: string | null
}
