import {
  AUTOMATION_WORKFLOW_KINDS,
  type AutomationRunSource,
  type AutomationWorkflowKind,
} from '@/types/automations'

export type PrismaAutomationWorkflowKind = 'MORNING_WB_REPORT' | 'FBS_MOVEMENT_SHEET'

const KIND_TO_PRISMA: Record<AutomationWorkflowKind, PrismaAutomationWorkflowKind> = {
  [AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT]: 'MORNING_WB_REPORT',
  [AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET]: 'FBS_MOVEMENT_SHEET',
}

const PRISMA_TO_KIND = Object.fromEntries(
  Object.entries(KIND_TO_PRISMA).map(([kind, prismaKind]) => [prismaKind, kind]),
) as Record<PrismaAutomationWorkflowKind, AutomationWorkflowKind>

export function toPrismaAutomationKind(kind: AutomationWorkflowKind): PrismaAutomationWorkflowKind {
  return KIND_TO_PRISMA[kind]
}

export function fromPrismaAutomationKind(kind: PrismaAutomationWorkflowKind): AutomationWorkflowKind {
  return PRISMA_TO_KIND[kind]
}

export function parseAutomationSource(payload: unknown): AutomationRunSource | null {
  if (!payload || typeof payload !== 'object') return null
  const source = (payload as { source?: unknown }).source
  return source === 'manual' || source === 'scheduled' ? source : null
}

export function parseTargetDate(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const value = (payload as { targetDate?: unknown }).targetDate
  return typeof value === 'string' ? value : null
}
