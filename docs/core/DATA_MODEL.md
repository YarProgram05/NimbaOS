# Data Model

Prisma/PostgreSQL модель NimbaOS. Last updated: 2026-05-25.

## Business Keys

- Cabinet/account key: `wbAccountId` links nearly all WB data to `WbAccount`.
- Product key: `nmId` is the main WB article key.
- Seller article: `vendorCode`; can be missing in WB reports, fallback comes from `Product`.
- Size/barcode keys: `chrtId`, `barcode`, `techSize`, `wbSize`.
- Advertising key: `advertId` under `wbAccountId`.
- Analytics should filter by `wbAccountId` and period first.

## Core Account/Auth Tables

- `users`, `invitations`, `user_preferences`.
- `wb_accounts`: encrypted WB API key, tax rate, seller metadata, `lastSyncAt`.

## Sync State Tables

- `sync_job_runs`: job kind/status/payload/result/error/attempts/timestamps.
- `sync_schedule_settings`: per-account job schedule settings.
- `sync_data_coverages`: account/kind/date range coverage.
- `automation_workflow_settings`: workflow settings, schedule and config.
- `automation_workflow_accounts`: per-workflow account-to-sheet mapping.
- `automation_runs`: workflow run history/status/result/errors.

## Product And Reference Tables

- `products`: normalized product card cache by `wbAccountId + nmId`.
- `product_sizes`: size/barcode/chrt links.
- `product_materials`: materials for products.
- `cost_prices`: cost by `wbAccountId + vendorCode`.
- `self_purchases`: self-purchase/cashback rows.
- `external_ads`: external ad spend rows.
- `article_overrides`: local article name/material overrides.
- `reply_template_groups`, `reply_templates`: feedback answer templates.

## Report/Sales/Stock Tables

- `realization_reports`: raw/cached WB realization rows.
- `paid_storage`: raw/cached WB paid storage task rows.
- `wb_orders`: raw/cached WB orders.
- `wb_sales`: raw/cached WB sales.
- `wb_funnel_stats`: WB analytics funnel by account/nm/date.
- `sales_plans`, `sales_plan_items`: plan/fact domain.
- `warehouses`, `stock_snapshots`, `stock_items`: current WB warehouse inventory snapshots.

## Advertising Tables

- `ad_campaigns`: campaign metadata by `wbAccountId + advertId`.
- `ad_campaign_stats`: campaign/date/source stats.
- `ad_campaign_nm_stats`: campaign/date/source/nm stats.
- `ad_campaign_clusters`: cluster stats by campaign and selected period.
- `ad_action_logs`: local action history.

## Feedback Tables

- `product_reviews`, `product_questions`: read-side customer feedback cache.
- `feedback_write_action_logs`: write action audit for answers.

## Raw, Normalized, Aggregate

- Raw/cached WB: `realization_reports`, `paid_storage`, `wb_orders`, `wb_sales`, `wb_funnel_stats`, `ad_campaign_stats`, `ad_campaign_nm_stats`, `ad_campaign_clusters`, `stock_items`, `product_reviews`, `product_questions`.
- Normalized project: `wb_accounts`, `products`, `product_sizes`, references, sales plans, `ad_campaigns`, templates.
- Aggregate/summary tables: не обнаружены.
- Views/materialized views: не обнаружены.
- Aggregation currently lives in service functions.

## Important Indexes

- Sync/automation: `sync_job_runs(status, createdAt)`, `(kind, createdAt)`, `(wbAccountId, createdAt)`, `bullJobId`; `sync_data_coverages(wbAccountId, kind, dateFrom, dateTo)`; `automation_runs(kind, createdAt)`, `(status, createdAt)`, `(workflowId, createdAt)`, `bullJobId`; unique automation workflow kind and account mapping.
- Products: unique `(wbAccountId, nmId)`, indexes `nmId`, `vendorCode`, `wbAccountId`.
- Sizes/stocks: `product_sizes(productId/chrtId/barcode)`, `stock_snapshots(wbAccountId, syncedAt)`, `stock_items(snapshotId)`, `(wbAccountId, nmId)`, `warehouseId`, `chrtId`.
- Feedback: unique `(wbAccountId, externalId)`, indexes by `(wbAccountId, createdDate)`, `(wbAccountId, nmId)`, `(wbAccountId, isAnswered)`, `rating`.
- References: unique `(wbAccountId, vendorCode)` for cost/overrides; indexes by account/date/vendor.
- Realization: unique `(wbAccountId, rrdId)`, indexes `wbAccountId`, `nmId`, `vendorCode`, `(dateFrom, dateTo)`, `(wbAccountId, nmId, dateFrom)`.
- Paid storage: unique `(wbAccountId, date, nmId, chrtId)`, indexes `(wbAccountId)`, `(wbAccountId, date)`, `(wbAccountId, nmId)`.
- Ads: unique `(wbAccountId, advertId)`, `(campaignId, date, source)`, `(campaignId, date, source, nmId)`, indexes by campaign, date, status, nmId.
- Orders/sales/funnel: unique `(wbAccountId, srid)` for orders/sales, indexes `(wbAccountId, nmId, date)`, `(wbAccountId, date)`, `(wbAccountId, lastChangeDate)`, unique `(wbAccountId, nmId, date)` for funnel.

## Potential Future Indexes/Aggregates

Нужно уточнить на реальных объемах: aggregate tables/materialized views for daily account/nm sales, stock risk, ad spend, and dashboard periods may be useful if service-level aggregation becomes slow.
