/**
 * Debug script for Phase 7 WB advert endpoints.
 *
 * Reads the first active WB account unless WB_ACCOUNT_ID is set.
 * Optional: ADVERT_ID=<campaign id in WB> narrows checks to one campaign.
 *
 * Run:
 *   npx tsx scripts/debug-advertising.ts
 *   WB_ACCOUNT_ID=<account uuid> ADVERT_ID=<wb advert id> npx tsx scripts/debug-advertising.ts
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

type ModuleWithDefault<T> = T | { default: T }

function unwrapModule<T extends object>(mod: ModuleWithDefault<T>): T {
  return 'default' in mod ? mod.default : mod
}

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    const rawValue = trimmed.slice(eq + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function daysAgo(days: number): Date {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}

function pickAdvertId(adverts: Array<{ id: number; status: number }>): number | null {
  const fromEnv = process.env.ADVERT_ID ? Number(process.env.ADVERT_ID) : null
  if (fromEnv && Number.isFinite(fromEnv)) return fromEnv

  return adverts.find((advert) => advert.status === 9 || advert.status === 11)?.id
    ?? adverts[0]?.id
    ?? null
}

async function main() {
  loadDotEnv()

  const { decrypt } = unwrapModule(await import('@/lib/encryption'))
  const { prisma } = unwrapModule(await import('@/lib/db'))
  const { WbApiClient } = unwrapModule(await import('@/lib/wb-api/client'))
  const {
    fetchAdvertInfoByIds,
    fetchAdvertList,
    fetchClusterStats,
    fetchFullStats,
    fetchUpdHistory,
  } = unwrapModule(await import('@/lib/wb-api/advertising'))

  const account = await prisma.wbAccount.findFirst({
    where: {
      id: process.env.WB_ACCOUNT_ID || undefined,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      apiKey: true,
    },
  })

  if (!account) {
    throw new Error('No active WB account found. Set WB_ACCOUNT_ID or add an account first.')
  }

  const client = new WbApiClient(decrypt(account.apiKey))
  console.log(`Account: ${account.name} (${account.id})`)

  console.log('Checking campaign list...')
  const adverts = await fetchAdvertList(client)
  console.log(`Campaigns from WB: ${adverts.length}`)

  const statusCounts = new Map<number, number>()
  for (const advert of adverts) {
    statusCounts.set(advert.status, (statusCounts.get(advert.status) ?? 0) + 1)
  }
  console.log('Statuses:', Object.fromEntries(statusCounts))

  const advertId = pickAdvertId(adverts)
  if (!advertId) {
    console.log('No campaign available for endpoint checks.')
    return
  }

  console.log('Checking selected campaign settings...')
  const [advert] = await fetchAdvertInfoByIds(client, [advertId])
  const nmIds = Array.from(new Set((advert?.nm_settings ?? []).map((item) => item.nm_id)))
  console.log(`Selected campaign: ${advertId}`)
  console.log(`Campaign cards: ${nmIds.length}`)

  const dateFrom = formatDate(daysAgo(6))
  const dateTo = formatDate(new Date())
  console.log(`Checking fullstats ${dateFrom}..${dateTo}...`)
  const stats = await fetchFullStats(client, advertId, dateFrom, dateTo)
  const days = stats.flatMap((campaign) => campaign.days ?? campaign.daily_stats ?? [])
  const nmRows = days.flatMap((day) =>
    (day.apps ?? day.app_type_stats ?? day.appTypeStats ?? [])
      .flatMap((app) => app.nms ?? []),
  )

  console.log(`Fullstats ${dateFrom}..${dateTo}: ${days.length} day rows, ${nmRows.length} nm rows`)

  if (nmIds.length > 0) {
    console.log('Checking clusters...')
    const clusters = await fetchClusterStats(client, advertId, nmIds.slice(0, 100), dateFrom, dateTo)
    const clusterRows = clusters.reduce((sum, group) => sum + (group.stats?.length ?? 0), 0)
    console.log(`Clusters: ${clusters.length} nm groups, ${clusterRows} cluster rows`)
  }

  console.log('Checking upd history...')
  const history = await fetchUpdHistory(client, dateFrom, dateTo)
  const campaignHistory = history.filter((item) => (item.advertId ?? item.advert_id) === advertId)
  console.log(`Upd history rows: ${campaignHistory.length}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    const { prisma } = unwrapModule(await import('@/lib/db'))
    await prisma.$disconnect()
  })
