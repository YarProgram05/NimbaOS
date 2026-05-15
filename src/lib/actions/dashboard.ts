'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  buildDashboardExport,
  type DashboardExportFile,
  type DashboardExportKind,
} from '@/lib/services/dashboard-export'
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

export async function exportDashboardXlsxAction(
  request: DashboardSummaryRequest,
  kind: DashboardExportKind,
): Promise<ActionResult<DashboardExportFile>> {
  try {
    await requireSession()
    if (!isDashboardExportKind(kind)) return { success: false, error: 'Неизвестный тип экспорта' }

    const summary = await getDashboardSummary(request)
    if (!summary) return { success: false, error: 'Кабинет не выбран' }

    const data = buildDashboardExport(summary, kind)
    return { success: true, data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Не удалось подготовить экспорт дашборда',
    }
  }
}

function isDashboardExportKind(value: string): value is DashboardExportKind {
  return ['summary', 'productRisks', 'stockRisks', 'feedbackWorkload'].includes(value)
}
