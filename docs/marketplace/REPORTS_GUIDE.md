# Reports Guide

Отчеты и экспорт в NimbaOS. Last updated: 2026-05-25.

## Existing Reports

- Financial report: `/reports`, `src/lib/actions/reports.ts`, `src/lib/services/report-calculator.ts`, XLSX export. Includes `Заказано руб.`, `ДРР %`, `ROMI %`.
- Sales plan report: `/sales-plan`, `src/lib/actions/sales-plan.ts`, `src/lib/services/plan-calculator.ts`, XLSX export.
- Dashboard summary/export: home dashboard, `dashboard-summary.ts`, `dashboard-export.ts`.
- Advertising campaign exports: advertising actions and `exportAdStatsXlsxAction`.
- Stocks and feedback screens: operational reports from local DB. Stocks include `Оборачиваемость, дн.`.
- Morning report source: `getMorningReportData` in `src/lib/services/morning-report.ts`; DB-first source for future Google Sheet filling.

## Data Needed

- Financial: `realization_reports`, `paid_storage`, products, references, ad stats, `wb_orders` for `Заказано руб.`.
- Plan/fact: `sales_plans`, `sales_plan_items`, `wb_orders`, `wb_sales`, `wb_funnel_stats`.
- Ads: `ad_campaigns`, campaign stats/nm stats/clusters.
- Stocks: latest stock snapshot + recent non-return `wb_sales` for turnover.
- Cards: local products/product sizes.

## Freshness Before Report

Check selected account, period, `SyncDataCoverage`, recent `SyncJobRun`, and domain timestamps before making recommendations.

## Slow Reports

Long-period financial reports and ad allocations can be heavy. Use existing services. Do not manually scan raw tables.

## Create New Report

1. Define business question and period.
2. Reuse existing services/calculators first.
3. If new aggregation is needed, discuss schema/index/summary table.
4. Add docs updates and tests/verification plan.

## Desired Reports

- `daily_wb_report`: sales, ordered rub, ROMI, margin, stock turnover, top risks, freshness.
- `stock_risk_report`: stock coverage, days to OOS, replenishment candidates.
- `plan_fact_report`: daily and cumulative plan/fact deviation.
- `ads_efficiency_report`: spend, orders, carts, CPO, DRR, waste candidates.
- `prices_monitoring_report`: price/margin/conversion risk.
- `cards_quality_report`: conversion, reviews/questions, missing/weak card signals.
- `weekly_owner_summary`: concise actions for owner.

## Exports

XLSX is supported for financial reports, sales plans, dashboard exports and advertising stats. CSV/PDF were not found as first-class supported exports.
