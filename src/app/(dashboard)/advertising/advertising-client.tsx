'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleSlash,
  Megaphone,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { syncCampaignsAction } from '@/lib/actions/advertising'
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
import { AD_STATUS_VARIANT, BID_TYPE_LABELS, type AdCampaignRow } from '@/types/advertising'

type FilterTab = 'all' | 'active' | 'paused' | 'completed'
type SortKey = 'name' | 'status' | 'budget' | 'bidType' | 'paymentType' | 'placement'

interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

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

function SortIcon({
  active,
  direction,
}: {
  active: boolean
  direction: 'asc' | 'desc'
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
  }

  return direction === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 shrink-0" />
    : <ArrowDown className="h-3.5 w-3.5 shrink-0" />
}

export function AdvertisingClient({
  initialCampaigns,
  wbAccountId,
}: AdvertisingClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [campaigns] = useState(initialCampaigns)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortState | null>(null)
  const [isSyncing, startSync] = useTransition()

  const accountParam = searchParams.get('account') || wbAccountId

  const filteredCampaigns = useMemo(() => {
    const visible = campaigns.filter((campaign) => matchesFilter(campaign, filter))
    if (!sort) return visible

    return [...visible].sort((left, right) => {
      let comparison = 0

      switch (sort.key) {
        case 'name':
          comparison = left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' })
          if (comparison === 0) comparison = left.advertId - right.advertId
          break
        case 'status':
          comparison = left.status - right.status
          if (comparison === 0) {
            comparison = left.statusLabel.localeCompare(right.statusLabel, 'ru', {
              sensitivity: 'base',
            })
          }
          break
        case 'budget':
          comparison = Number(left.budget ?? 0) - Number(right.budget ?? 0)
          break
        case 'bidType':
          comparison = formatBidType(left.bidType).localeCompare(formatBidType(right.bidType), 'ru', {
            sensitivity: 'base',
          })
          break
        case 'paymentType':
          comparison = (left.paymentType ?? '').localeCompare(right.paymentType ?? '', 'ru', {
            sensitivity: 'base',
          })
          break
        case 'placement':
          comparison = formatPlacement(left).localeCompare(formatPlacement(right), 'ru', {
            sensitivity: 'base',
          })
          break
      }

      if (comparison === 0) {
        comparison = left.updatedAt.localeCompare(right.updatedAt)
      }

      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [campaigns, filter, sort])

  function handleRowClick(campaignId: string) {
    router.push(`/advertising/${campaignId}?account=${accountParam}`)
  }

  function handleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        }
      }

      return {
        key,
        direction: key === 'budget' || key === 'bidType' ? 'desc' : 'asc',
      }
    })
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncCampaignsAction(wbAccountId)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Задача синхронизации поставлена в фон: ${result.data.id}`)
    })
  }

  const counts = {
    all: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === 9).length,
    paused: campaigns.filter((campaign) => campaign.status === 11).length,
    completed: campaigns.filter((campaign) => campaign.status === 7).length,
  }

  function renderSortableHeader(
    key: SortKey,
    label: string,
    align: 'left' | 'right' = 'left',
  ) {
    const isActive = sort?.key === key

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-auto px-0 py-0 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground ${
          align === 'right' ? 'ml-auto flex justify-end' : ''
        }`}
        onClick={() => handleSort(key)}
      >
        <span className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          <SortIcon active={isActive} direction={isActive ? sort.direction : 'asc'} />
        </span>
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterTab)} className="min-w-0 max-w-full">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="all">Все ({counts.all})</TabsTrigger>
            <TabsTrigger value="active">Активные ({counts.active})</TabsTrigger>
            <TabsTrigger value="paused">Пауза ({counts.paused})</TabsTrigger>
            <TabsTrigger value="completed">Завершённые ({counts.completed})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-full sm:ml-auto sm:w-auto">
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
            Выполните первую синхронизацию, чтобы подтянуть кампании из WB.
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
        <div className="overflow-hidden rounded-lg border">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>{renderSortableHeader('name', 'Название')}</TableHead>
                <TableHead>{renderSortableHeader('status', 'Статус')}</TableHead>
                <TableHead>{renderSortableHeader('budget', 'Бюджет', 'right')}</TableHead>
                <TableHead>{renderSortableHeader('bidType', 'Тип ставки')}</TableHead>
                <TableHead>{renderSortableHeader('paymentType', 'Оплата')}</TableHead>
                <TableHead>{renderSortableHeader('placement', 'Размещение')}</TableHead>
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
                  <TableCell className="text-right">{formatMoney(campaign.budget)}</TableCell>
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
