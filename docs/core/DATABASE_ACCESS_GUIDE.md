# Database Access Guide

Быстрый и безопасный доступ к данным. Last updated: 2026-06-04.

## Main Rule

Агент не должен делать тяжелые ad-hoc запросы по raw-таблицам, если есть готовые report services, repository functions, views, summary tables, агрегаты или нормализованные источники.

Всегда ограничивать запросы `wbAccountId` и периодом, если это возможно.

## Preferred Service Entry Points

- Продажи/финансы: `calculateReport` in `src/lib/services/report-calculator.ts`; UI/action layer `src/lib/actions/reports.ts`.
- Итоги report rows: `aggregateReportRows` in `src/lib/reports/aggregate-report-rows.ts`.
- Утренний WB-отчет: `getMorningReportData` in `src/lib/services/morning-report.ts`; automation writer in `src/lib/services/morning-wb-report-workflow.ts` checks coverage first, then reads DB and writes Google Sheets. It must not call WB API or sync services.
- План/факт: `calculatePlanDetail` in `src/lib/services/plan-calculator.ts`; actions in `src/lib/actions/sales-plan.ts`.
- Dashboard: `getDashboardSummary`, `buildDashboardProblemCenter`, `buildDashboardExport`.
- Остатки: `getStocksSummary`, `getPaginatedStocks`.
- Отзывы/вопросы: `getFeedbackSummary`, `getPaginatedFeedback`.
- Реклама: actions in `src/lib/actions/advertising.ts`, sync services for refresh only.

## Table Choice By Task

- Financial report: `realization_reports`, `paid_storage`, products, references, ad stats and `wb_orders` through `report-calculator`.
- Orders/sales/plan: `wb_orders`, `wb_sales`, `wb_funnel_stats`, `sales_plans`, `sales_plan_items` through `plan-calculator`.
- Stock risk/turnover: latest `stock_snapshots` + `stock_items` + recent non-return `wb_sales` through stock services.
- Advertising efficiency: `ad_campaigns`, `ad_campaign_stats`, `ad_campaign_nm_stats`, `ad_campaign_clusters`; prefer actions/services.
- Prices/cards: `products`, `product_sizes`; WB API only for approved refresh/sync.
- Feedback: `product_reviews`, `product_questions`; answer writes require confirmation.
- Automations: `automation_workflow_settings`, `automation_workflow_accounts`, `automation_runs` for workflow configuration/history; do not query raw WB tables manually for automation output.

## Raw Tables

Raw/cached WB tables can be large: `realization_reports`, `paid_storage`, `wb_orders`, `wb_sales`, `wb_funnel_stats`, ad stats, stock items, reviews/questions. Use them only through existing services or with bounded account/date filters.

## Normalized Tables

Use `products`, `product_sizes`, references, `sales_plans`, `ad_campaigns`, `wb_accounts` for joins and metadata.

## Aggregates/Views/Summary Tables

Persisted aggregate tables, materialized views and DB views were not found. Current aggregation is in TypeScript service layer. If performance becomes a problem, discuss daily per-account/per-nm summary tables before adding heavy direct queries.

## Query Rules

- Select only needed fields.
- Filter by account and period.
- Avoid `SELECT *` against raw tables.
- Avoid joining multiple raw fact tables without pre-aggregation.
- For long periods, prefer existing calculators or future aggregates.
- For freshness, inspect `SyncDataCoverage`, `SyncJobRun`, `WbAccount.lastSyncAt`, and domain-specific timestamps.

## Slow Spots To Watch

- `realization_reports` sync uses live-verified WB Finance API `POST /api/finance/v1/sales-reports/detailed` and normalizes camelCase/string-money fields before the existing Prisma mapper. Future job results expose `report.sourceApi` for endpoint audits.
- Finance API may lowercase `vendorCode`; financial report reference lookups normalize vendor-code casing, Unicode form and surrounding whitespace before matching `cost_prices` and related references.
- `Заказано руб.` needs fresh `wb_orders.finishedPrice` for all order rows, including cancelled orders; normal `reports.period` sync now refreshes this source for the selected period.
- Long-period `realization_reports` calculations.
- `Заказано руб.` needs fresh `wb_orders`; check `SALES_PLAN_PERIOD` coverage for the selected period.
- `paid_storage` joins for storage-only articles.
- `ad_campaign_nm_stats` completeness and long-period ad allocation.
- Dashboard summary if it grows beyond current service-level aggregation.
- Any marketplace ad-hoc request that scans all raw rows across all accounts.
