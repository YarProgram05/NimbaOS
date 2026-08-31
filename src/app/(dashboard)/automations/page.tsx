import { getAutomationCatalog } from '@/lib/automations/workflows'
import { listAutomationRuns } from '@/lib/automations/runs'
import { AutomationsClient } from './automations-client'

export const dynamic = 'force-dynamic'

export default async function AutomationsPage() {
  const [automations, runs] = await Promise.all([
    getAutomationCatalog(),
    listAutomationRuns({ page: 1, pageSize: 25 }),
  ])

  return (
    <AutomationsClient
      initialAutomations={automations}
      initialRunsPage={runs}
    />
  )
}
