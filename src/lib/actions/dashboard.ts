'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDashboardSummary } from '@/lib/services/dashboard-summary'
import type { ActionResult } from '@/types'
import type { DashboardSummary, DashboardSummaryRequest } from '@/types/dashboard'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

export async function getDashboardSummaryAction(
  request: DashboardSummaryRequest,
): Promise<ActionResult<DashboardSummary | null>> {
  try {
    await requireSession()
    const data = await getDashboardSummary(request)
    return { success: true, data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Не удалось загрузить сводку дашборда',
    }
  }
}
