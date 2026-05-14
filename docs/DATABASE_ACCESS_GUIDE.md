# Database Access Guide

## Main principle

Агент не должен делать тяжёлые ad-hoc запросы по raw-таблицам, если есть готовые агрегаты, report services, calculators or repository functions.

Всегда ограничивать запросы по `wbAccountId` и периоду, если это возможно.

## Raw / cached WB tables

- `realization_reports`: WB realization report rows.
- `paid_storage`: WB paid storage task results.
- `wb_orders`: WB orders for sales plan.
- `wb_sales`: WB sales for sales plan.
- `wb_funnel_stats`: WB analytics funnel history.
- `ad_campaign_stats`: advertising daily stats by campaign/date/source.
- `ad_campaign_nm_stats`: advertising daily stats by campaign/date/source/nmId.
- `ad_campaign_clusters`: advertising cluster stats by period.
- `stock_snapshots`, `stock_items`, `warehouses`: current WB warehouse inventory snapshots. Read the latest `stock_snapshots` row per `wbAccountId` for stock analytics.

## Normalized project tables

- `wb_accounts`: encrypted WB account config and sync metadata.
- `products`, `product_sizes`, `product_materials`: product catalog cache.
- `cost_prices`, `self_purchases`, `external_ads`, `article_overrides`: reference data.
- `sales_plans`, `sales_plan_items`: sales plan domain.
- `ad_campaigns`, `ad_action_logs`: advertising campaign state and local action history.

## Aggregate / service layer

Prefer:
- `src/lib/services/report-calculator.ts` for financial reports;
- `src/lib/reports/aggregate-report-rows.ts` for report totals;
- `src/lib/services/plan-calculator.ts` for sales plan daily metrics;
- `src/lib/services/sync-*` services for DB refresh from WB;
- Server Actions in `src/lib/actions` for UI-facing reads/mutations.

## Important indexes

Check `prisma/schema.prisma` for current indexes. Common access patterns:
- by `wbAccountId`;
- by `date` / `rrDt`;
- by `nmId`;
- by `vendorCode`;
- by unique external IDs such as `rrdId`, `srid`, `advertId`.

## Query rules

Use:
- date-bounded queries;
- account-bounded queries;
- selected fields instead of full rows when possible;
- existing services/calculators for complex analytics.

Avoid:
- unbounded scans on raw WB tables;
- joining large raw tables without date/account filters;
- ad-hoc recalculation that duplicates report or plan calculators;
- reading encrypted API keys unless needed for an approved WB API operation.

## Areas needing care

- `realization_reports` can be large; prefer calculator patterns.
- `paid_storage` can include storage-only articles.
- `ad_campaign_nm_stats` depends on WB `fullstats` response shape and live verification.
- Sales plan metrics combine orders, sales, funnel, and ad stats; avoid one-off formulas.

## Documentation updates

Update this file when:
- schema changes;
- indexes change;
- new aggregate services are added;
- performance problems reveal a preferred access pattern.
## Phase 8 sync job history

- `sync_job_runs` stores Bull MQ read-only sync history.
- Important fields: `kind`, `status`, `wbAccountId`, `payload`, `bullJobId`, `result`, `error`, `attempts`, `startedAt`, `finishedAt`.
- Use it for operational status and failure inspection; do not store secrets in `payload`, `result` or `error`.
