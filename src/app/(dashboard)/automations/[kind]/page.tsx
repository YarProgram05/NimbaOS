import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { getAutomationDefinition, isAutomationWorkflowKind } from '@/lib/automations/catalog'
import { getFbsMovementSheetWorkflow, getMorningWbReportWorkflow } from '@/lib/automations/workflows'
import { AUTOMATION_WORKFLOW_KINDS } from '@/types/automations'
import { AutomationDetailsClient } from '../automation-details-client'
import { FbsMovementSheetDetailsClient } from '../fbs-movement-sheet-details-client'

export default async function AutomationDetailsPage({ params }: { params: { kind: string } }) {
  if (!isAutomationWorkflowKind(params.kind)) notFound()
  const session = await getServerSession(authOptions)
  const definition = getAutomationDefinition(params.kind)

  if (params.kind === AUTOMATION_WORKFLOW_KINDS.FBS_MOVEMENT_SHEET) {
    const workflow = await getFbsMovementSheetWorkflow()
    return (
      <FbsMovementSheetDetailsClient
        initialWorkflow={workflow}
        canManage={checkRole(session, 'MANAGER')}
        name={definition.name}
        description={definition.description}
      />
    )
  }

  const workflow = await getMorningWbReportWorkflow()

  return (
    <AutomationDetailsClient
      initialWorkflow={workflow}
      canManage={checkRole(session, 'MANAGER')}
      name={definition.name}
      description={definition.description}
    />
  )
}
