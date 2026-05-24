# WB API Map

Карта WB API слоя. Last updated: 2026-05-24.

## Client

- `src/lib/wb-api/client.ts`: `WbApiClient`, `WbApiError`, `WbRateLimitError`, throttling, retries, JSON request wrapper.
- `src/lib/wb-api/constants.ts`: WB domains and rate limits.
- API keys live encrypted in `WbAccount`; never print decrypted keys.

## Read-Only Methods

- Accounts/common: `ping`, `getSellerInfo`, `validateAndFetchSellerInfo`.
- Products/prices read: `fetchCardsList`, `fetchPrices`, `fetchPricesByNmId`, `fetchPricesByNmIds`.
- Reports: `fetchRealizationReportPage`.
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

