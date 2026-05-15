'use client'

import { useTransition } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportDashboardXlsxAction } from '@/lib/actions/dashboard'
import type { DashboardSummaryRequest } from '@/types/dashboard'
import type { DashboardExportKind } from '@/lib/services/dashboard-export'

interface DashboardExportButtonsProps {
  request: DashboardSummaryRequest
}

const EXPORT_OPTIONS: Array<{ kind: DashboardExportKind; label: string }> = [
  { kind: 'summary', label: 'Сводка дашборда' },
  { kind: 'productRisks', label: 'Риски товаров' },
  { kind: 'stockRisks', label: 'Риски остатков' },
  { kind: 'feedbackWorkload', label: 'Отзывы и вопросы' },
]

export function DashboardExportButtons({ request }: DashboardExportButtonsProps) {
  const [isExporting, startExport] = useTransition()

  function handleExport(kind: DashboardExportKind) {
    startExport(async () => {
      const result = await exportDashboardXlsxAction(request, kind)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      const { base64, filename } = result.data
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Excel-файл готов')
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={isExporting} className="h-9 gap-2">
          <Download className="h-4 w-4" />
          {isExporting ? 'Экспорт...' : 'Excel'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXPORT_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.kind} onClick={() => handleExport(option.kind)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
