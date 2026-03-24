export const WB_API_DOMAINS = {
  content:    'https://content-api.wildberries.ru',
  prices:     'https://discounts-prices-api.wildberries.ru',
  statistics: 'https://statistics-api.wildberries.ru',
  analytics:  'https://seller-analytics-api.wildberries.ru',
  advert:     'https://advert-api.wildberries.ru',
  common:     'https://common-api.wildberries.ru',
  finance:    'https://finance-api.wildberries.ru',
  marketplace:'https://marketplace-api.wildberries.ru',
  documents:  'https://documents-api.wildberries.ru',
} as const

export type WbApiDomain = keyof typeof WB_API_DOMAINS

// Rate limits (ms between requests)
export const RATE_LIMITS = {
  content:    600,   // 100 req/min
  prices:     600,
  statistics: 60000, // 1 req/min
  analytics:  20000, // 3 req/min
  advert:     200,   // 5 req/sec
  common:     600,
  finance:    600,
  marketplace:200,
  documents:  600,
} as const satisfies Record<WbApiDomain, number>
