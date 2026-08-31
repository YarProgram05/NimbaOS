# Data Freshness Policy

Политика актуальности данных. Last updated: 2026-06-04.

## Financial Report API Verification

2026-06-04: `REPORTS_PERIOD` / financial report freshness depends on `syncRealizationReport` using live-verified WB Finance API `POST /api/finance/v1/sales-reports/detailed`.

Operational rules:
- Treat missing same-day/yesterday financial report data carefully; `204 No data` can mean WB has not formed the report yet.
- Do not perform broad historical resyncs just to test the new endpoint without explicit confirmation.
- Preserve DB-first analytics: the Finance API only refreshes `realization_reports`; reports, dashboard and automations still read from the database.
- Inspect `report.sourceApi` in future `SyncJobRun.result` when endpoint audit evidence is needed.

## Main Principle

База данных является основным источником данных для аналитики, отчетов и работы агента. WB API используется как механизм синхронизации данных в базу.

## Historical Data

- Исторические отчеты и данные синхронизируются один раз.
- После этого они используются из базы.
- Не запрашивать исторические периоды через WB API, если данные уже есть в базе.
- Если история неполная или ошибочная, зафиксировать проблему и запросить подтверждение перед пересинхронизацией.
- Перезапись исторических данных требует явного подтверждения.

## Current Data

Свежие данные обновляются:
- по расписанию;
- кнопкой пользователя в интерфейсе;
- при явной задаче пользователя;
- если агент обнаружил, что нужный период отсутствует или устарел.

## Before Analytics

Проверить:
1. Какие кабинеты нужны.
2. Какой период нужен.
3. Есть ли период в базе.
4. Когда была последняя синхронизация.
5. Есть ли пропущенные даты.
6. Нужен ли incremental sync.
7. Какой штатный sync-сервис использовать.

## Freshness Signals

- `WbAccount.lastSyncAt` — общий timestamp для части report sync.
- `SyncJobRun` — очередь, статус, ошибки, attempts.
- `SyncDataCoverage` — покрытие account/kind/date range.
- `SyncScheduleSetting` — включенность и rolling days расписаний.
- Domain timestamps: `fetchedAt`, `syncedAt`, `lastChangeDate`, dates in raw tables.

## Data Domains

- Products/cards: `products`, `product_sizes`; refresh through products sync.
- Financial reports: `realization_reports`, `paid_storage`, references, products, ad stats, plus `wb_orders` for `Заказано руб.`; `reports.period` sync refreshes orders for the selected period. The `realization_reports` source is Finance API `sales-reports/detailed`.
- For `Заказано руб.`, `reports.period` forces full orders backfill only for periods up to 31 days. Wider periods use incremental orders sync to avoid long WB Statistics API lock/rate-limit stalls.
- Sales plan/orders: `wb_orders`, `wb_sales`, `wb_funnel_stats`, `sales_plans`. `sales-plan.period` may run account-wide for orders/sales even without active sales plans.
- Advertising: `ad_campaigns`, `ad_campaign_stats`, `ad_campaign_nm_stats`, `ad_campaign_clusters`.
- Stocks: latest `stock_snapshots`, `stock_items`, `warehouses`; turnover also depends on recent non-return `wb_sales` and can fall back to local `realization_reports` sale quantities for article/size demand.
- Reviews/questions: `product_reviews`, `product_questions`.
- FBS operational: `fbs_orders`, `fbs_order_events`, `fbs_supplies`; target interval 5 minutes.
- FBS stock reconciliation: `fbs_assortment_items.wbStock/wbStockSyncedAt`; the current operator cadence is 60 minutes for stocks, orders and marking. Each run refreshes seller warehouses and checks all locally known product-size `chrtId` values so positive FBS positions can be discovered independently of orders. The FBS accounting-Sheet workflow accepts only relevant tuple timestamps no older than 75 minutes, allowing normal hourly-cycle jitter while detecting a missed cycle. Local `onHand/reserved` changes are immediate and are not replaced by sync; a lower local ledger produces a replenishment warning rather than invalidating the WB snapshot.
- FBS marking: WB excise/marking report and order metadata; target interval 60 minutes.
- FBS finance: enriched `realization_reports` with `deliveryMethod/orderId/KIZ`; normal finance coverage rules apply.
- A complete FBS analytic period needs both operational `fbs_orders` coverage (orders, cancellations and order identity) and Finance coverage (buyouts, returns, revenue and transfer). `deliveryMethod=FBS` alone is not a completeness signal because WB may place it only on logistics rows.

## API Rule

- Не вызывать WB API напрямую для анализа, если данные уже есть в базе.
- Если данных нет или они устарели, использовать существующие sync methods.
- Не писать ad-hoc API scripts, если есть штатный механизм.
- Аналитика строится из базы после завершения sync.

## Dangerous Operations

- Full historical resync.
- Перезапись существующей истории.
- Удаление данных.
- Изменение WB цен, скидок, карточек, рекламы, ставок, бюджетов, остатков.
- Массовые write operations.
- FBS stock publication, KIZ attachment, order/supply status writes and enabling a warehouse write gate.

Initial FBS history is a one-time bounded range `2026-07-20` - `2026-07-30`. The script is dry-run unless exact execution confirmation is passed. Do not widen or rerun it silently.
