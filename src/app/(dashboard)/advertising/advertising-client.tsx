'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Megaphone, RefreshCw, Search, CircleSlash } from 'lucide-react'
import { toast } from 'sonner'
import { syncCampaignsAction, getCampaignsAction } from '@/lib/actions/advertising'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AdCampaignRow } from '@/types/advertising'
import { AD_STATUS_VARIANT, BID_TYPE_LABELS } from '@/types/advertising'

type FilterTab = 'all' | 'active' | 'paused' | 'completed'

interface AdvertisingClientProps {
  initialCampaigns: AdCampaignRow[]
  wbAccountId: string
}

function formatMoney(value: string | null): string {
  if (!value) return '—'
  return `${Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₽`
}

function formatPlacement(campaign: AdCampaignRow): string {
  if (campaign.placementSearch && campaign.placementReco) return 'Поиск + рекомендации'
  if (campaign.placementSearch) return 'Поиск'
  if (campaign.placementReco) return 'Рекомендации'
  return '—'
}

function formatBidType(value: string | null): string {
  if (!value) return '—'
  if (value in BID_TYPE_LABELS) {
    return BID_TYPE_LABELS[value as keyof typeof BID_TYPE_LABELS]
  }
  return value
}

function matchesFilter(campaign: AdCampaignRow, filter: FilterTab): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return campaign.status === 9
  if (filter === 'paused') return campaign.status === 11
  return campaign.status === 7
}

export function AdvertisingClient({
  initialCampaigns,
  wbAccountId,
}: AdvertisingClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [isSyncing, startSync] = useTransition()

  const accountParam = searchParams.get('account') || wbAccountId

  const filteredCampaigns = useMemo(
    () => campaigns.filter((campaign) => matchesFilter(campaign, filter)),
    [campaigns, filter],
  )

  function handleRowClick(campaignId: string) {
    router.push(`/advertising/${campaignId}?account=${accountParam}`)
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncCampaignsAction(wbAccountId)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(
        `Синхронизировано: ${result.data.upserted} кампаний` +
        (result.data.errors > 0 ? `, ошибок ${result.data.errors}` : '') +
        ` (${(result.data.durationMs / 1000).toFixed(1)}с)`,
      )

      const refreshed = await getCampaignsAction(wbAccountId)
      if (refreshed.success) {
        setCampaigns(refreshed.data)
      } else {
        toast.error(refreshed.error)
      }
    })
  }

  const counts = {
    all: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === 9).length,
    paused: campaigns.filter((campaign) => campaign.status === 11).length,
    completed: campaigns.filter((campaign) => campaign.status === 7).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">Все ({counts.all})</TabsTrigger>
            <TabsTrigger value="active">Активные ({counts.active})</TabsTrigger>
            <TabsTrigger value="paused">Пауза ({counts.paused})</TabsTrigger>
            <TabsTrigger value="completed">Завершённые ({counts.completed})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto">
          <Button onClick={handleSync} disabled={isSyncing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Найдено кампаний:{' '}
        <span className="font-medium text-foreground">
          {filteredCampaigns.length.toLocaleString('ru-RU')}
        </span>
      </p>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Megaphone className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">Кампании ещё не загружены</h3>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            Выполните первую синхронизацию, чтобы подтянуть рекламные кампании из WB.
          </p>
          <Button onClick={handleSync} variant="outline" className="gap-2" disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <CircleSlash className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">Нет кампаний в выбранном фильтре</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Попробуйте переключить вкладку или обновить список кампаний.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Бюджет</TableHead>
                <TableHead>Тип ставки</TableHead>
                <TableHead>Оплата</TableHead>
                <TableHead>Размещение</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(campaign.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate">{campaign.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ID {campaign.advertId}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={AD_STATUS_VARIANT[campaign.status]}>
                      {campaign.statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatMoney(campaign.budget)}</TableCell>
                  <TableCell>{formatBidType(campaign.bidType)}</TableCell>
                  <TableCell>{campaign.paymentType ?? '—'}</TableCell>
                  <TableCell>{formatPlacement(campaign)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>
              Клик по строке открывает детальную страницу кампании.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
