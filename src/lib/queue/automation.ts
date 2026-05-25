import type { ConnectionOptions, JobsOptions, Processor, Queue, Worker } from 'bullmq'
import {
  AUTOMATION_WORKFLOW_KINDS,
  type AutomationRunSource,
  type AutomationWorkflowKind,
} from '@/types/automations'

export const AUTOMATION_QUEUE_NAME = 'automation'

export { AUTOMATION_WORKFLOW_KINDS, type AutomationWorkflowKind, type AutomationRunSource }

export interface AutomationJobData {
  kind: AutomationWorkflowKind
  source: AutomationRunSource
  workflowId?: string
  runId?: string
  targetDate?: string
}

export const DEFAULT_AUTOMATION_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: {
    type: 'exponential',
    delay: 60_000,
  },
  removeOnComplete: 500,
  removeOnFail: 500,
}

let automationQueue: Queue<AutomationJobData> | null = null

export function getAutomationRedisConnection(): ConnectionOptions {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  }
}

export async function getAutomationQueue(): Promise<Queue<AutomationJobData>> {
  if (!automationQueue) {
    const { Queue } = await import('bullmq')
    automationQueue = new Queue<AutomationJobData>(AUTOMATION_QUEUE_NAME, {
      connection: getAutomationRedisConnection(),
      defaultJobOptions: DEFAULT_AUTOMATION_JOB_OPTIONS,
    })
  }

  return automationQueue
}

export async function createAutomationWorker(
  processor: Processor<AutomationJobData>,
): Promise<Worker<AutomationJobData>> {
  const { Worker } = await import('bullmq')
  return new Worker<AutomationJobData>(AUTOMATION_QUEUE_NAME, processor, {
    connection: getAutomationRedisConnection(),
    concurrency: Number(process.env.AUTOMATION_WORKER_CONCURRENCY ?? 1),
    lockDuration: Number(process.env.AUTOMATION_WORKER_LOCK_DURATION_MS ?? 15 * 60_000),
    stalledInterval: Number(process.env.AUTOMATION_WORKER_STALLED_INTERVAL_MS ?? 60_000),
  })
}
