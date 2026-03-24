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

const lastRequestTime: Partial<Record<WbApiDomain, number>> = {}

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
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (response.status === 204) {
      return null as T
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('X-Ratelimit-Retry')
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 5000
      await sleep(waitMs)
      return this.request<T>(domain, path, options, retries)
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
