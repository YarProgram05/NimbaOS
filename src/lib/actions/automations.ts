'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { getMorningWbReportWorkflow, updateMorningWbReportWorkflow } from '@/lib/automations/workflows'
import { listAutomationRuns, enqueueAutomationRun } from '@/lib/automations/runs'
import { morningWbReportPayload } from '@/lib/services/morning-wb-report-workflow'
import { AUTOMATION_WORKFLOW_KINDS, type UpdateMorningWbReportWorkflowInput } from '@/types/automations'
import type { ActionResult } from '@/types'
import type {
  AutomationRunRow,
  AutomationWorkflowRow,
  EnqueuedAutomationRun,
} from '@/types/automations'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

async function requireManagerSession() {
  const session = await requireSession()
  if (!checkRole(session, 'MANAGER')) throw new Error('Недостаточно прав')
  return session
}

export async function getMorningWbReportWorkflowAction(): Promise<ActionResult<AutomationWorkflowRow>> {
  try {
    await requireSession()
    return { success: true, data: await getMorningWbReportWorkflow() }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки workflow' }
  }
}

export async function getAutomationRunsAction(): Promise<ActionResult<AutomationRunRow[]>> {
  try {
    await requireSession()
    return { success: true, data: await listAutomationRuns() }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки истории' }
  }
}

export async function updateMorningWbReportWorkflowAction(
  input: UpdateMorningWbReportWorkflowInput,
): Promise<ActionResult<AutomationWorkflowRow>> {
  try {
    await requireManagerSession()
    const workflow = await updateMorningWbReportWorkflow(input)
    revalidatePath('/automations')
    return { success: true, data: workflow }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка сохранения workflow' }
  }
}

export async function enqueueMorningWbReportAction(
  targetDate?: string,
): Promise<ActionResult<EnqueuedAutomationRun>> {
  try {
    await requireManagerSession()
    const workflow = await getMorningWbReportWorkflow()
    if (!workflow.id) return { success: false, error: 'Workflow не найден' }

    const payload = morningWbReportPayload(targetDate)
    const run = await enqueueAutomationRun({
      kind: AUTOMATION_WORKFLOW_KINDS.MORNING_WB_REPORT,
      source: 'manual',
      workflowId: workflow.id,
      targetDate: payload.targetDate,
    })
    revalidatePath('/automations')
    return { success: true, data: run }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка запуска workflow' }
  }
}
