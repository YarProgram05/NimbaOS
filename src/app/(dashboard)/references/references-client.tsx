'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CostPriceTab } from './cost-price-tab'
import { SelfPurchaseTab } from './self-purchase-tab'
import { ExternalAdTab } from './external-ad-tab'
import { ArticleOverrideTab } from './article-override-tab'
import { ReplyTemplateTab } from './reply-template-tab'
import type {
  CostPriceItem,
  SelfPurchaseRow,
  ExternalAdRow,
  ArticleOverrideRow,
  ReplyTemplateGroupRow,
  VendorCodeOption,
} from '@/types/references'

interface ReferencesClientProps {
  wbAccountId: string
  initialTab: string
  costPriceItems: CostPriceItem[]
  selfPurchases: SelfPurchaseRow[]
  externalAds: ExternalAdRow[]
  articleOverrides: ArticleOverrideRow[]
  replyTemplateGroups: ReplyTemplateGroupRow[]
  vendorCodes: VendorCodeOption[]
}

export function ReferencesClient({
  wbAccountId,
  initialTab,
  costPriceItems,
  selfPurchases,
  externalAds,
  articleOverrides,
  replyTemplateGroups,
  vendorCodes,
}: ReferencesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState(initialTab)

  function handleTabChange(value: string) {
    setTab(value)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleMutate = () => router.refresh()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Справочники</h1>
        <p className="text-muted-foreground mt-1 text-sm">Ручные данные для расчётов</p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
          <TabsTrigger value="cost-price">Себестоимость</TabsTrigger>
          <TabsTrigger value="self-purchases">Самовыкупы</TabsTrigger>
          <TabsTrigger value="external-ads">Внешняя реклама</TabsTrigger>
          <TabsTrigger value="overrides">Переименования</TabsTrigger>
          <TabsTrigger value="reply-templates">Шаблоны ответов</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cost-price" className="mt-4">
          <CostPriceTab
            items={costPriceItems}
            wbAccountId={wbAccountId}
            onMutate={handleMutate}
          />
        </TabsContent>

        <TabsContent value="self-purchases" className="mt-4">
          <SelfPurchaseTab
            rows={selfPurchases}
            vendorCodes={vendorCodes}
            wbAccountId={wbAccountId}
            onMutate={handleMutate}
          />
        </TabsContent>

        <TabsContent value="external-ads" className="mt-4">
          <ExternalAdTab
            rows={externalAds}
            vendorCodes={vendorCodes}
            wbAccountId={wbAccountId}
            onMutate={handleMutate}
          />
        </TabsContent>

        <TabsContent value="overrides" className="mt-4">
          <ArticleOverrideTab
            rows={articleOverrides}
            vendorCodes={vendorCodes}
            wbAccountId={wbAccountId}
            onMutate={handleMutate}
          />
        </TabsContent>

        <TabsContent value="reply-templates" className="mt-4">
          <ReplyTemplateTab
            groups={replyTemplateGroups}
            wbAccountId={wbAccountId}
            onMutate={handleMutate}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
