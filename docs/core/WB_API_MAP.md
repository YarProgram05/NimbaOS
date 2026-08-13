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
- FBS: `syncFbsOperational` (warehouses, orders, statuses, metadata, supplies), `syncFbsStocksCurrent`, `syncFbsMarkingReport`.

## UI And Scheduled Refresh

- User refresh buttons enqueue jobs through `src/lib/actions/sync.ts` where implemented.
- BullMQ processing lives in `src/lib/queue/sync-processor.ts`.
- Daily schedule helpers live in `src/lib/sync/schedules.ts` and `scripts/schedule-sync.ts`.

## FBS Marketplace API

Read-only:
- `GET /api/v3/warehouses`;
- `GET /api/v3/orders/new`, `GET /api/v3/orders`;
- `POST /api/v3/orders/status`;
- `POST /api/marketplace/v3/orders/meta`;
- `GET /api/v3/supplies`;
- `POST /api/v3/stocks/{warehouseId}`;
- `POST /api/v3/orders/stickers`;
- `POST /api/v1/analytics/excise-report`;
- Finance `sales-reports/detailed` fields `orderId`, `orderUid`, `kiz`, `isB2b`, `trbxId`, `deliveryMethod`.

Live FBS response notes:
- `warehouses.deliveryType/cargoType` and `supplies.cargoType/crossBorderType` are numeric in live responses and are normalized to strings for the current Prisma schema.
- Period order `dateFrom/dateTo` query values are Unix timestamps; application date inputs are converted using Moscow day boundaries.
- Status and metadata reads are batched at 100 order IDs.
- `POST /api/marketplace/v3/orders/meta` returns the concrete order-to-marking mapping as `orders[].id -> meta.sgtin.value[]` when a code has been attached in WB. A read-only check on 2026-07-30 found non-empty SGTIN arrays for 20 of 24 latest local FBS orders across both cabinets without logging any code values.
- `syncFbsOperational` extracts `sgtin` before sanitization, normalizes and parses the code, encrypts the full value, deduplicates by account-scoped SHA-256 hash, validates GTIN when the assortment GTIN is known, and attaches the `KizUnit` to the WB order. The ordinary order/event metadata JSON still stores only `[REDACTED]`.
- Sync results expose counts only: received, created, assigned, already assigned, released, rejected, conflicts and GTIN mismatches. Never include full codes in job results or logs.
- The Finance report also exposes `orderId` with `kiz`, but it is delayed financial evidence and should be used as reconciliation/backfill, not the primary operational mapping.
- Finance `deliveryMethod=FBS` is not guaranteed on the `Продажа`/`Возврат` row. Local verification on 2026-08-12 found it mainly on connected zero-quantity logistics rows. FBS analytics must use the account-scoped `orderId -> fbs_orders.externalOrderId` link and treat row-level `deliveryMethod` only as a fallback hint.
- Current stock reconciliation refreshes seller warehouses and checks every available local catalog `chrtId`, not only assortment previously observed in orders.
- `options.isB2b` is the current nested order field; the direct legacy field remains a compatibility fallback.

Explicit write wrappers:
- `PUT /api/v3/orders/{orderId}/meta/sgtin`;
- `PATCH /api/v3/orders/{orderId}/{confirm|complete|cancel}`;
- `PATCH /api/v3/supplies/{supplyId}/orders/{orderId}`;
- `PATCH /api/v3/supplies/{supplyId}/deliver`;
- `PUT /api/v3/stocks/{warehouseId}`.

These write wrappers require manager intent, an admin-enabled warehouse gate and `fbs_action_logs`. Never call them from sync, analytics or recommendation code.

## Limits And Errors

- WB domains have strict rate limits; `WbRateLimitError` exists for 429 handling.
- Realization report uses paged API.
- Advertising clusters are limited by WB period rules; code chunks long periods.
- Null/empty advertising fullstats responses are treated as empty where hardened.

## Principle

WB API обновляет базу. Analytics/report/UI/agent читают базу после sync.
