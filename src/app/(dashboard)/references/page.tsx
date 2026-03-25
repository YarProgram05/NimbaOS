import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  getCostPrices,
  getSelfPurchases,
  getExternalAds,
  getArticleOverrides,
  getVendorCodes,
} from '@/lib/actions/references'
import { ReferencesClient } from './references-client'

const VALID_TABS = ['cost-price', 'self-purchases', 'external-ads', 'overrides'] as const
type TabValue = (typeof VALID_TABS)[number]

interface ReferencesPageProps {
  searchParams: Promise<{
    account?: string
    tab?: string
  }>
}

export default async function ReferencesPage({ searchParams }: ReferencesPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams

  // ── Resolve WB account ──────────────────────────────────────────────────────
  let wbAccountId: string | null = params.account ?? null

  if (!wbAccountId) {
    const firstAccount = await prisma.wbAccount.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (firstAccount) wbAccountId = firstAccount.id
  }

  if (!wbAccountId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Справочники</h1>
        <p className="text-muted-foreground">
          Добавьте кабинет WB в{' '}
          <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
            настройках
          </Link>
          , чтобы начать вести справочники.
        </p>
      </div>
    )
  }

  // ── Validate tab ────────────────────────────────────────────────────────────
  const tab: TabValue = VALID_TABS.includes(params.tab as TabValue)
    ? (params.tab as TabValue)
    : 'cost-price'

  // ── Fetch all datasets in parallel ──────────────────────────────────────────
  const [costPrices, selfPurchases, externalAds, articleOverrides, vendorCodes] =
    await Promise.all([
      getCostPrices(wbAccountId),
      getSelfPurchases(wbAccountId),
      getExternalAds(wbAccountId),
      getArticleOverrides(wbAccountId),
      getVendorCodes(wbAccountId),
    ])

  return (
    <ReferencesClient
      wbAccountId={wbAccountId}
      initialTab={tab}
      costPrices={costPrices}
      selfPurchases={selfPurchases}
      externalAds={externalAds}
      articleOverrides={articleOverrides}
      vendorCodes={vendorCodes}
    />
  )
}
