import { fileURLToPath } from 'url'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const DATE_FROM = '2026-07-20'
const DATE_TO = '2026-07-30'
const CONFIRMATION = `FBS-${DATE_FROM}-${DATE_TO}`

function argument(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null
}

export async function runFbsBackfill() {
  const wbAccountId = argument('account')
  const execute = process.argv.includes('--execute')
  const confirmation = argument('confirm')

  if (!wbAccountId) {
    throw new Error('Укажите кабинет: --account=<wbAccountId>')
  }

  if (!execute) {
    return {
      dryRun: true,
      wbAccountId,
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
      requiredFlags: `--execute --confirm=${CONFIRMATION}`,
    }
  }
  if (confirmation !== CONFIRMATION) {
    throw new Error(`Для запуска добавьте --confirm=${CONFIRMATION}`)
  }

  const [
    { syncFbsOperational, syncFbsMarkingReport },
    { syncRealizationReport },
  ] = await Promise.all([
    import('@/lib/services/sync-fbs'),
    import('@/lib/services/sync-reports'),
  ])

  const operational = await syncFbsOperational(wbAccountId, {
    dateFrom: DATE_FROM,
    dateTo: DATE_TO,
  })
  const finance = await syncRealizationReport(wbAccountId, DATE_FROM, DATE_TO)
  const marking = await syncFbsMarkingReport(wbAccountId, DATE_FROM, DATE_TO)

  return {
    dryRun: false,
    wbAccountId,
    dateFrom: DATE_FROM,
    dateTo: DATE_TO,
    operational,
    finance: {
      totalRows: finance.totalRows,
      inserted: finance.upserted,
      enriched: finance.enriched,
      errors: finance.errors,
    },
    marking,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFbsBackfill()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'FBS backfill failed')
      process.exit(1)
    })
}
