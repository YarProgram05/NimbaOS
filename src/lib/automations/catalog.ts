import { AUTOMATION_WORKFLOW_KINDS, type AutomationWorkflowKind } from '@/types/automations'

export interface AutomationDefinition {
  kind: AutomationWorkflowKind
  name: string
  description: string
}

export const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
  {
    kind: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
    name: 'Утренний отчет WB',
    description: 'Заполняет Google Sheet данными WB из локальной базы после проверки полноты периода.',
  },
  {
    kind: AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET,
    name: 'Заказы FBS → таблица учета',
    description: 'Ежедневно переносит заказы, отмены до отгрузки и принятые возвраты из NimbaOS в таблицу учета и сверяет каждый день.',
  },
]

const DEFINITIONS_BY_KIND = new Map(AUTOMATION_DEFINITIONS.map((definition) => [definition.kind, definition]))

export function getAutomationDefinition(kind: AutomationWorkflowKind): AutomationDefinition {
  const definition = DEFINITIONS_BY_KIND.get(kind)
  if (!definition) throw new Error(`Неизвестная автоматизация: ${kind}`)
  return definition
}

export function getAutomationName(kind: AutomationWorkflowKind): string {
  return getAutomationDefinition(kind).name
}

export function isAutomationWorkflowKind(value: string): value is AutomationWorkflowKind {
  return DEFINITIONS_BY_KIND.has(value as AutomationWorkflowKind)
}
