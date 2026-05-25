import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRole } from '@/lib/auth/check-role'
import { getMorningWbReportWorkflow } from '@/lib/automations/workflows'
import { listAutomationRuns } from '@/lib/automations/runs'
import { AutomationsClient } from './automations-client'

export default async function AutomationsPage() {
  const session = await getServerSession(authOptions)
  const canManage = checkRole(session, 'MANAGER')
  const [workflow, runs] = await Promise.all([
    getMorningWbReportWorkflow(),
    listAutomationRuns(),
  ])

  return (
    <AutomationsClient
      initialWorkflow={workflow}
      initialRuns={runs}
      canManage={canManage}
    />
  )
}
