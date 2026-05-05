import { fileURLToPath } from 'url'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

export async function upsertDefaultSyncSchedule() {
  const { applyAllSyncSchedules } = await import('@/lib/sync/schedules')
  return applyAllSyncSchedules()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  upsertDefaultSyncSchedule()
    .then((result) => {
      console.log(`[sync-schedule] upserted ${result.scheduled} schedulers for ${result.accounts} accounts`)
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
