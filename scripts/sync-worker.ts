import { fileURLToPath } from 'url'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

export async function startSyncWorker() {
  const [{ createSyncWorker }, { processSyncJob }] = await Promise.all([
    import('@/lib/queue'),
    import('@/lib/queue/sync-processor'),
  ])
  const worker = await createSyncWorker(processSyncJob)

  worker.on('completed', (job) => {
    console.log(`[sync-worker] completed ${job.name} #${job.id}`)
  })

  worker.on('failed', (job, error) => {
    console.error(`[sync-worker] failed ${job?.name ?? 'unknown'} #${job?.id ?? 'n/a'}: ${error.message}`)
  })

  return worker
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startSyncWorker().then((worker) => {
    console.log('[sync-worker] started')

    process.on('SIGINT', async () => {
      await worker.close()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await worker.close()
      process.exit(0)
    })
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
