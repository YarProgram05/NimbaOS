import { Queue, type ConnectionOptions } from 'bullmq'

const connection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}

export const QUEUE_NAMES = {
  SYNC_PRODUCTS:      'sync-products',
  SYNC_REALIZATION:   'sync-realization',
  SYNC_ORDERS:        'sync-orders',
  SYNC_SALES:         'sync-sales',
  SYNC_CAMPAIGNS:     'sync-campaigns',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

export function createQueue(name: QueueName) {
  return new Queue(name, { connection })
}

export { connection as redisConnection }
