# WB API Map

Карта WB API слоя. Last updated: 2026-06-04.

## Financial Reports Migration

2026-06-04: NimbaOS financial report sync was migrated from deprecated `GET /api/v5/supplier/reportDetailByPeriod` on `https://statistics-api.wildberries.ru` to `POST /api/finance/v1/sales-reports/detailed` on `https://finance-api.wildberries.ru`.

Implementation status:
- `fetchRealizationReportPage` sends POST JSON with `dateFrom`, `dateTo`, `period: daily`, `limit: 100000`, `rrdId`, and the fields used by `realization_reports`.
- Finance camelCase/string-money fields are normalized into the existing internal row shape before Prisma mapping.
- Important renames include `reportId -> realizationreport_id`, `sku -> barcode`, `forPay -> ppvz_for_pay`, `deliveryService -> delivery_rub`, `paidStorage -> storage_fee`, `paidAcceptance -> acceptance`, `sellerOperName -> supplier_oper_name`, and `rrDate -> rr_dt`.
- Pagination starts with `rrdId = 0`, advances using the last row `rrdId`, and stops on `204 No data` or an empty response.
- Finance domain throttle is 1 request per minute.
- Live verification passed on 2026-06-04 for `WB Galioni (WB_2)`: 1738 rows read, 244 new rows inserted for 2026-06-02 - 2026-06-03, and coverage advanced through 2026-06-03.
- Future `ReportSyncResult` values record exact `sourceApi` domain/method/path for auditability.

Endpoint differences:
- Old method: `GET /api/v5/supplier/reportDetailByPeriod`, query params `dateFrom`, `dateTo`, `limit`, `rrdid`, `period`; the retired implementation expected snake_case response fields such as `rrd_id`, `realizationreport_id`, `date_from`, `date_to`, `nm_id`.
- New method: `POST /api/finance/v1/sales-reports/detailed`, JSON body with `dateFrom`, `dateTo`, `limit <= 100000`, `rrdId`, `period`, optional `fields`; response sample uses camelCase fields such as `rrdId`, `reportId`, `dateFrom`, `dateTo`, `nmId`.
- Pagination remains cursor-based: start with `rrdId = 0`, then pass the last row `rrdId`, repeat until `204 No data`.
- Rate limit remains 1 request per minute per seller account.
- Dates are RFC3339/date strings in Moscow time `UTC+3`; data is documented as available since 2024-01-29 for the period details method.
- Token category changes to Finance API context; validate existing WB tokens/scopes before production rollout.
- The implementation normalizes camelCase Finance API rows into the existing `realization_reports` schema. Do not change Prisma schema unless live verification reveals an incompatible field.

## Client

- `src/lib/wb-api/client.ts`: `WbApiClient`, `WbApiError`, `WbRateLimitError`, throttling, retries, JSON request wrapper.
- `src/lib/wb-api/constants.ts`: WB domains and rate limits.
- API keys live encrypted in `WbAccount`; never print decrypted keys.

## Read-Only Methods

- Accounts/common: `ping`, `getSellerInfo`, `validateAndFetchSellerInfo`.
- Products/prices read: `fetchCardsList`, `fetchPrices`, `fetchPricesByNmId`, `fetchPricesByNmIds`.
- Reports: `fetchRealizationReportPage` uses live-verified `POST /api/finance/v1/sales-reports/detailed`.
- Paid storage: `createPaidStorageTask`, status/wait/download/fetch task flow. Task creation is for report retrieval, not data mutation in WB.
- Orders/sales: `fetchOrdersPage`, `fetchSalesPage`.
- Funnel analytics: `fetchFunnelHistory`.
- Stocks: `fetchWbWarehouseStocks`.
- Feedback read: `fetchWbFeedbacks`, `fetchWbQuestions`, detail methods.
- Advertising read: `fetchAdvertList`, `fetchAdvertInfoByIds`, `fetchCampaignBudget`, `fetchFullStats`, `fetchClusterStats`, `fetchUpdHistory`.

## Potentially Write Methods

- Prices: `uploadPriceTask`.
- Advertising: `setBid`, `depositBudget`, `startCampaign`, `pauseCampaign`, `stopCampaign`.
- Feedback: `answerWbFeedback`, `answerWbQuestion`.

These require explicit user intent and must not be triggered as analytics side effects.

## Sync Services Using WB API

- Historical/current reports: `syncRealizationReport`, `syncPaidStorage`.
- Incremental orders/sales: `syncOrders`, `syncSales`.
- Funnel current/period data: `syncFunnel`.
- Products/prices: `syncProducts`.
- Advertising: `syncAdCampaigns`, `syncAdStats`, `syncAdClusters`.
- Stocks: `syncStocksCurrent`.
- Reviews/questions: `syncReviews`, `syncQuestions`.

## UI And Scheduled Refresh

- User refresh buttons enqueue jobs through `src/lib/actions/sync.ts` where implemented.
- BullMQ processing lives in `src/lib/queue/sync-processor.ts`.
- Daily schedule helpers live in `src/lib/sync/schedules.ts` and `scripts/schedule-sync.ts`.

## Limits And Errors

- WB domains have strict rate limits; `WbRateLimitError` exists for 429 handling.
- Realization report uses paged API.
- Advertising clusters are limited by WB period rules; code chunks long periods.
- Null/empty advertising fullstats responses are treated as empty where hardened.

## Principle

WB API обновляет базу. Analytics/report/UI/agent читают базу после sync.
