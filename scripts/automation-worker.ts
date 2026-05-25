import { createAutomationWorker } from '@/lib/queue/automation'
import { processAutomationJob } from '@/lib/queue/automation-processor'

async function main() {
  const worker = await createAutomationWorker(processAutomationJob)

  worker.on('completed', (job) => {
    console.log(`[automation-worker] completed ${job.name}#${job.id}`)
  })

  worker.on('failed', (job, error) => {
    console.error(`[automation-worker] failed ${job?.name}#${job?.id}:`, error)
  })

  console.log('[automation-worker] started')
}

main().catch((error) => {
  console.error('[automation-worker] fatal error', error)
  process.exit(1)
})
