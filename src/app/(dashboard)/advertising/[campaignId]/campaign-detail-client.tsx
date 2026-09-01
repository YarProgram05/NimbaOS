'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PauseCircle, PlayCircle, RefreshCw, Wallet } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  depositBudgetAction,
  getCampaignDetailAction,
  pauseCampaignAction,
  setBidAction,
  startCampaignAction,
  stopCampaignAction,
} from '@/lib/actions/advertising'
import type { AdCampaignDetail } from '@/types/advertising'
import { AD_STATUS_VARIANT, BID_TYPE_LABELS } from '@/types/advertising'
import { StatsTab } from './stats-tab'
import { ClustersTab } from './clusters-tab'
import { BreakdownTab } from './breakdown-tab'
import { LogTab } from './log-tab'

interface CampaignDetailClientProps {
  campaign: AdCampaignDetail
  accountParam: string
  initialDateFrom?: string
  initialDateTo?: string
}

function formatMoney(value: string | null): string {
  if (!value) return '—'
  return `${Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₽`
}

function formatBidType(value: string | null): string {
  if (!value) return '—'
  if (value in BID_TYPE_LABELS) {
    return BID_TYPE_LABELS[value as keyof typeof BID_TYPE_LABELS]
  }
  return value
}

export function CampaignDetailClient({
  campaign: initialCampaign,
  accountParam,
  initialDateFrom,
  initialDateTo,
}: CampaignDetailClientProps) {
  const router = useRouter()
  const [campaign, setCampaign] = useState(initialCampaign)
  const [bidValue, setBidValue] = useState(campaign.lastBid ?? '')
  const [budgetValue, setBudgetValue] = useState('')
  const [isRefreshing, startRefresh] = useTransition()
  const [isSavingBid, startSaveBid] = useTransition()
  const [isDepositing, startDeposit] = useTransition()
  const [isChangingStatus, startStatusChange] = useTransition()

  async function refreshCampaign() {
    startRefresh(async () => {
      const result = await getCampaignDetailAction(campaign.id)
      if (result.success) {
        setCampaign(result.data)
        setBidValue(result.data.lastBid ?? '')
      }
    })
  }

  function handleSetBid() {
    const parsed = parseFloat(bidValue)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Введите корректную ставку')
      return
    }

    startSaveBid(async () => {
      const result = await setBidAction(campaign.id, parsed)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Ставка обновлена')
      await refreshCampaign()
    })
  }

  function handleDeposit() {
    const parsed = parseFloat(budgetValue)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Введите корректную сумму пополнения')
      return
    }

    startDeposit(async () => {
      const result = await depositBudgetAction(campaign.id, parsed)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Бюджет пополнен')
      setBudgetValue('')
      await refreshCampaign()
    })
  }

  function handleStart() {
    startStatusChange(async () => {
      const result = await startCampaignAction(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Кампания запущена')
      await refreshCampaign()
    })
  }

  function handlePause() {
    startStatusChange(async () => {
      const result = await pauseCampaignAction(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Кампания поставлена на паузу')
      await refreshCampaign()
    })
  }

  function handleStop() {
    startStatusChange(async () => {
      const result = await stopCampaignAction(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Кампания завершена')
      await refreshCampaign()
    })
  }

  const canStart = campaign.status === 4 || campaign.status === 11
  const canPause = campaign.status === 9
  const canStop = campaign.status === 9 || campaign.status === 11
  const bidLabel = campaign.paymentType === 'cpc' ? 'Ставка CPC' : 'Ставка CPM'

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 -ml-2"
        onClick={() => router.push(`/advertising?account=${accountParam}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        К кампаниям
      </Button>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between md:space-y-0">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">{campaign.name}</CardTitle>
              <Badge variant={AD_STATUS_VARIANT[campaign.status]}>
                {campaign.statusLabel}
              </Badge>
            </div>
            <CardDescription>
              ID {campaign.advertId} • {formatBidType(campaign.bidType)} • {campaign.paymentType ?? '—'}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshCampaign}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Бюджет</div>
              <div className="mt-1 text-xl font-semibold">{formatMoney(campaign.budget)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">{bidLabel}</div>
              <div className="mt-1 text-xl font-semibold">{formatMoney(campaign.lastBid)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Размещение</div>
              <div className="mt-1 text-xl font-semibold">
                {campaign.placementSearch && campaign.placementReco
                  ? 'Поиск + рекомендации'
                  : campaign.placementSearch
                    ? 'Поиск'
                    : campaign.placementReco
                      ? 'Рекомендации'
                      : '—'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_auto]">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4" />
                {bidLabel}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bidValue}
                  onChange={(e) => setBidValue(e.target.value)}
                  placeholder={campaign.lastBid ?? '0.00'}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetBid()}
                />
                <Button onClick={handleSetBid} disabled={isSavingBid}>
                  {isSavingBid ? 'Сохранение...' : 'Установить'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4" />
                Пополнение бюджета
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  placeholder="Сумма"
                  onKeyDown={(e) => e.key === 'Enter' && handleDeposit()}
                />
                <Button onClick={handleDeposit} disabled={isDepositing}>
                  {isDepositing ? 'Пополнение...' : 'Пополнить'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-3 text-sm font-medium">Управление</div>
              <div className="flex flex-col gap-2">
                {canStart && (
                  <Button onClick={handleStart} disabled={isChangingStatus}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {isChangingStatus ? 'Запуск...' : 'Возобновить'}
                  </Button>
                )}
                {canPause && (
                  <Button variant="outline" onClick={handlePause} disabled={isChangingStatus}>
                    <PauseCircle className="mr-2 h-4 w-4" />
                    {isChangingStatus ? 'Пауза...' : 'Пауза'}
                  </Button>
                )}
                {canStop && (
                  <Button variant="destructive" onClick={handleStop} disabled={isChangingStatus}>
                    {isChangingStatus ? 'Завершение...' : 'Завершить'}
                  </Button>
                )}
                {!canStart && !canPause && !canStop && (
                  <div className="text-sm text-muted-foreground">
                    Для текущего статуса действий нет.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="stats" className="space-y-4">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="stats">Статистика</TabsTrigger>
          <TabsTrigger value="clusters">Кластеры</TabsTrigger>
          <TabsTrigger value="breakdown">Разбивка</TabsTrigger>
          <TabsTrigger value="log">Журнал</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <StatsTab campaignId={campaign.id} initialDateFrom={initialDateFrom} initialDateTo={initialDateTo} />
        </TabsContent>

        <TabsContent value="clusters">
          <ClustersTab campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value="breakdown">
          <BreakdownTab campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value="log">
          <LogTab campaignId={campaign.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
