# Project State

Update 2026-06-04: WB financial report sync was migrated and live-verified from deprecated `GET /api/v5/supplier/reportDetailByPeriod` to `POST /api/finance/v1/sales-reports/detailed`. The successful Galioni run inserted 244 new rows for 2026-06-02 - 2026-06-03 and advanced coverage through 2026-06-03. The implementation uses POST JSON, `rrdId` pagination, selected fields, camelCase/string-money normalization, a 1 request/minute Finance throttle, and records exact `sourceApi` metadata in future job results.

Update 2026-05-26: `Утренний отчет WB` automation is DB-only after `BUG-010`. It no longer performs WB sync/API calls during sheet filling; missing coverage must be fixed via separate sync jobs.

Update 2026-05-26: `Утренний отчет WB` automation bug `BUG-008` is fixed at code level: previous-day targeting uses the Moscow calendar date, `A43:C43` month progress cells are filled, duplicate orders sync is skipped for the same range, and run results include per-step timings.

Update 2026-05-25: `/automations` and the first workflow `Утренний отчет WB` are implemented at code level with a separate BullMQ automation queue, Google Sheets service-account runtime, and configurable account-to-sheet mapping.

Update 2026-05-25: `Заказано руб.` now sums all WB order rows, including cancelled orders, to represent ordered ruble volume.

Update 2026-05-25: `Заказано руб.` sync was repaired. `reports.period` now refreshes `wb_orders` for the selected report period, and orders are upserted so changed WB order sums/cancellations update local data.

Текущее состояние NimbaOS. Last updated: 2026-06-04.

## Current Phase

Фазы 0-9 реализованы на уровне кода. После Phase 9 добавлены dashboard analytics, stock inventory, reviews/questions, рекомендации, Excel exports, seller-size drilldown и hardening рекламы/отчетов. Phase 7/8 все еще требуют широкой live WB verification после rate-limit окон. Production rollout требует отдельного подтверждения.

## Implemented

- Auth/users: NextAuth Credentials, роли `ADMIN`, `MANAGER`, `VIEWER`, invitations, admin users.
- WB accounts: encrypted API keys, tax rate, seller metadata, active status, account selector через `?account=id`.
- Product cards: sync карточек/цен, карточная таблица, price refresh/update flow.
- References: себестоимость, самовыкупы, внешняя реклама, article overrides, reply templates.
- Financial reports: realization, paid storage, references, products, ad spend allocation, ordered rub, ROMI, XLSX export, sticky report table, user column order.
- Sales plan: CRUD, article detail, account-wide orders/sales sync, funnel sync for plan items, daily metrics, add from stock, XLSX export.
- Advertising: campaigns, stats, nm stats, clusters, logs, XLSX export, bid/budget/status actions.
- Background sync: BullMQ jobs, `SyncJobRun`, schedules, `/sync`, manual enqueue actions.
- Automations: `/automations`, `AutomationWorkflowSetting`, `AutomationWorkflowAccount`, `AutomationRun`, separate automation queue, `Утренний отчет WB` Google Sheet workflow.
- Dashboard analytics: summary, freshness, problem center, product risk, stock risk, feedback workload, forecasts, deterministic recommendations, dashboard exports.
- Inventory: WB warehouse stock snapshots, current stock screen and turnover days.
- Reviews/questions: read-only sync and dashboard workload.
- Production artifacts: Dockerfile, compose files, healthcheck, nginx example.
- Documentation memory split: `core`, `development`, `marketplace`.

## Partially Implemented

- Live WB verification is incomplete for all read-only sync job types.
- Advertising live behavior around WB 429/rate limits still needs careful checks.
- Monitoring beyond `/sync` and `SyncJobRun` is limited.
- No persisted aggregate/materialized summary layer was found beyond service-level aggregation.

## Not Implemented Yet

- Full monitoring/alerting pipeline.
- Stock history charts and FBS/seller warehouse inventory.
- Automatic marketplace recommendations that perform WB write actions; current recommendations are advisory.
- Scheduled owner reports as a production automation.
- Production-enabled Google Sheet automation is not configured until service-account credentials, Sheet sharing, worker and scheduler are set up in the target environment.

## Deprecated

- `PROMPTS_GUIDE.md` is a legacy prompt archive.
- Old flat `docs/*.md` files are legacy redirects or archives after the 3-zone split.
- Do not rely on live WB API reads as analytics source.
- Do not read every `.md` at session startup.

## Important Risks

- Financial report sync uses live-verified `POST /api/finance/v1/sales-reports/detailed`; broad historical refreshes still require confirmation.
- Historical WB data must not be overwritten without explicit confirmation.
- WB-changing actions exist in code for prices, feedback answers and advertising; they require clear user intent.
- Large raw tables can become slow if queried without `wbAccountId` and period filters.
- Fresh `Заказано руб.` depends on `wb_orders`; reports may be fresher than orders/sales if `sales-plan.period` has not run.
- `Утренний отчет WB` writes to Google Sheets only when the service account is configured and the Sheet is shared; it is DB-only and must fail fast instead of calling WB sync/API services.
- `ad_campaign_nm_stats` can be incomplete depending on WB `fullstats`; reports use corrected spend history logic where implemented.
- Some old docs may contain historical context but should not be treated as current operating instructions unless indexed as such.
