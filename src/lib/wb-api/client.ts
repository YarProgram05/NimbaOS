import { WB_API_DOMAINS, RATE_LIMITS, type WbApiDomain } from './constants'

export class WbApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly domain: WbApiDomain,
  ) {
    super(message)
    this.name = 'WbApiError'
  }
}

export class WbRateLimitError extends WbApiError {
  constructor(
    domain: WbApiDomain,
    public readonly retryAfterSec?: number,
  ) {
    super(
      `WB API rate limit exceeded on domain "${domain}"${retryAfterSec ? ` — retry after ${retryAfterSec}s` : ''}`,
      429,
      domain,
    )
    this.name = 'WbRateLimitError'
  }
}

const lastRequestTime: Partial<Record<WbApiDomain, number>> = {}
const REQUEST_TIMEOUT_MS = 60_000
const MAX_AUTO_RETRY_AFTER_SEC = 30

async function throttle(domain: WbApiDomain): Promise<void> {
  const limit = RATE_LIMITS[domain]
  const last = lastRequestTime[domain] ?? 0
  const now = Date.now()
  const elapsed = now - last
  if (elapsed < limit) {
    await new Promise((resolve) => setTimeout(resolve, limit - elapsed))
  }
  lastRequestTime[domain] = Date.now()
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isNetworkFetchError(err: unknown): err is Error {
  return err instanceof Error && (
    err.name === 'TypeError' ||
    err.message.toLowerCase().includes('fetch failed') ||
    err.message.toLowerCase().includes('network')
  )
}

export class WbApiClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async request<T>(
    domain: WbApiDomain,
    path: string,
    options: RequestInit = {},
    retries = 3,
  ): Promise<T> {
    await throttle(domain)

    const url = `${WB_API_DOMAINS[domain]}${path}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response

    try {
      response = await fetch(url, {
        ...options,
        signal: options.signal ?? controller.signal,
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (retries > 0) {
          await sleep(2 ** (3 - retries) * 1000)
          return this.request<T>(domain, path, options, retries - 1)
        }
        throw new WbApiError(
          `WB API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          408,
          domain,
        )
      }

      if (isNetworkFetchError(err) && retries > 0) {
        await sleep(2 ** (3 - retries) * 1000)
        return this.request<T>(domain, path, options, retries - 1)
      }

      if (isNetworkFetchError(err)) {
        throw new WbApiError(
          `WB API network error on ${domain}: ${err.message}`,
          503,
          domain,
        )
      }

      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (response.status === 204) {
      return null as T
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('X-Ratelimit-Retry')
      const retryAfterSec = retryAfter ? Number(retryAfter) : undefined
      if (retries <= 0) {
        throw new WbRateLimitError(domain, retryAfterSec)
      }
      if (retryAfterSec && retryAfterSec > MAX_AUTO_RETRY_AFTER_SEC) {
        throw new WbRateLimitError(domain, retryAfterSec)
      }
      await sleep(retryAfterSec ? retryAfterSec * 1000 : 5000)
      return this.request<T>(domain, path, options, retries - 1)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      if (retries > 0 && response.status >= 500) {
        await sleep(2 ** (3 - retries) * 1000) // exponential backoff
        return this.request<T>(domain, path, options, retries - 1)
      }
      throw new WbApiError(
        `WB API ${response.status}: ${body}`,
        response.status,
        domain,
      )
    }

    return response.json() as Promise<T>
  }

  get<T>(domain: WbApiDomain, path: string, params?: Record<string, string>) {
    const url = params
      ? `${path}?${new URLSearchParams(params).toString()}`
      : path
    return this.request<T>(domain, url, { method: 'GET' })
  }

  post<T>(domain: WbApiDomain, path: string, body: unknown) {
    return this.request<T>(domain, path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}
