import type { WbApiClient } from './client'
import type {
  WbPaidStorageRow,
  WbPaidStorageTaskResponse,
  WbPaidStorageTaskStatusResponse,
} from '@/types/reports'

const PAID_STORAGE_CREATE_THROTTLE_MS = 60_000
const PAID_STORAGE_STATUS_THROTTLE_MS = 5_000
const PAID_STORAGE_DOWNLOAD_THROTTLE_MS = 60_000
const PAID_STORAGE_MAX_STATUS_POLLS = 12

type PaidStorageRequestKind = 'create' | 'status' | 'download'

const lastPaidStorageRequestAt: Partial<Record<PaidStorageRequestKind, number>> = {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function throttlePaidStorage(kind: PaidStorageRequestKind): Promise<void> {
  const minInterval =
    kind === 'status'
      ? PAID_STORAGE_STATUS_THROTTLE_MS
      : kind === 'download'
        ? PAID_STORAGE_DOWNLOAD_THROTTLE_MS
        : PAID_STORAGE_CREATE_THROTTLE_MS

  const now = Date.now()
  const last = lastPaidStorageRequestAt[kind] ?? 0
  const elapsed = now - last

  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed)
  }

  lastPaidStorageRequestAt[kind] = Date.now()
}

function isTerminalFailureStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === 'failed' || normalized === 'error' || normalized === 'cancelled' || normalized === 'canceled'
}

export async function createPaidStorageTask(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
): Promise<string> {
  await throttlePaidStorage('create')

  const response = await client.get<WbPaidStorageTaskResponse>(
    'analytics',
    '/api/v1/paid_storage',
    { dateFrom, dateTo },
  )

  return response.data.taskId
}

export async function getPaidStorageTaskStatus(
  client: WbApiClient,
  taskId: string,
): Promise<string> {
  await throttlePaidStorage('status')

  const response = await client.get<WbPaidStorageTaskStatusResponse>(
    'analytics',
    `/api/v1/paid_storage/tasks/${taskId}/status`,
  )

  return response.data.status
}

export async function waitForPaidStorageTask(
  client: WbApiClient,
  taskId: string,
): Promise<void> {
  for (let attempt = 1; attempt <= PAID_STORAGE_MAX_STATUS_POLLS; attempt++) {
    const status = await getPaidStorageTaskStatus(client, taskId)
    const normalizedStatus = status.trim().toLowerCase()

    if (normalizedStatus === 'done') {
      return
    }

    if (isTerminalFailureStatus(status)) {
      throw new Error(`WB paid storage task ${taskId} failed with status "${status}"`)
    }

    if (attempt < PAID_STORAGE_MAX_STATUS_POLLS) {
      await sleep(PAID_STORAGE_STATUS_THROTTLE_MS)
    }
  }

  throw new Error(`WB paid storage task ${taskId} did not reach "done" status in time`)
}

export async function downloadPaidStorageTask(
  client: WbApiClient,
  taskId: string,
): Promise<WbPaidStorageRow[]> {
  await throttlePaidStorage('download')

  const response = await client.get<WbPaidStorageRow[] | null>(
    'analytics',
    `/api/v1/paid_storage/tasks/${taskId}/download`,
  )

  return response ?? []
}

export async function fetchPaidStorageReport(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
): Promise<WbPaidStorageRow[]> {
  const taskId = await createPaidStorageTask(client, dateFrom, dateTo)
  await waitForPaidStorageTask(client, taskId)
  return downloadPaidStorageTask(client, taskId)
}
