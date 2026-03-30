'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getCampaignLogAction } from '@/lib/actions/advertising'
import type { AdActionLogRow } from '@/types/advertising'

interface LogTabProps {
  campaignId: string
}

const LOCAL_ACTION_LABELS: Record<string, string> = {
  bid_change: 'Изменение ставки',
  deposit: 'Пополнение бюджета',
  start: 'Запуск кампании',
  stop: 'Завершение кампании',
}

function formatActionLabel(row: AdActionLogRow): string {
  if (row.source === 'local') {
    return LOCAL_ACTION_LABELS[row.action] ?? row.action
  }

  return row.action
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatValue(value: string | null): string {
  if (!value) return '—'

  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isNaN(parsed) && normalized.match(/^-?\d+(\.\d+)?$/)) {
    return parsed.toLocaleString('ru-RU', {
      minimumFractionDigits: normalized.includes('.') ? 2 : 0,
      maximumFractionDigits: 2,
    })
  }

  return value
}

function formatLogDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return format(date, 'dd.MM.yyyy HH:mm', { locale: ru })
}

export function LogTab({ campaignId }: LogTabProps) {
  const [rows, setRows] = useState<AdActionLogRow[]>([])
  const [isLoading, startLoading] = useTransition()

  const loadRows = useCallback(() => {
    startLoading(async () => {
      const result = await getCampaignLogAction(campaignId)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      setRows(result.data)
    })
  }, [campaignId])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <CardTitle className="text-base">Журнал действий</CardTitle>
          <CardDescription>
            Объединённая история локальных действий и изменений из WB upd history
          </CardDescription>
        </div>

        <Button variant="outline" onClick={loadRows} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Обновление...' : 'Обновить'}
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка журнала...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-base font-semibold">Журнал пока пуст</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              После изменений ставок, пополнений и событий WB история появится здесь.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-muted/20">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">Дата</th>
                  <th className="px-3 py-2 text-left font-medium">Действие</th>
                  <th className="px-3 py-2 text-left font-medium">До</th>
                  <th className="px-3 py-2 text-left font-medium">После</th>
                  <th className="px-3 py-2 text-left font-medium">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatLogDate(row.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={row.source === 'local' ? 'default' : 'secondary'}>
                          {row.source === 'local' ? 'Локально' : 'WB'}
                        </Badge>
                        <span className="font-medium">{formatActionLabel(row)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {formatValue(row.valueBefore)}
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {formatValue(row.valueAfter)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
