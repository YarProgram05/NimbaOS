# Project State

Текущее состояние NimbaOS. Last updated: 2026-05-24.

## Current Phase

Фазы 0-9 реализованы на уровне кода. После Phase 9 добавлены dashboard analytics, stock inventory, reviews/questions, рекомендации, Excel exports, seller-size drilldown и hardening рекламы/отчетов. Phase 7/8 все еще требуют широкой live WB verification после rate-limit окон. Production rollout требует отдельного подтверждения.

## Implemented

- Auth/users: NextAuth Credentials, роли `ADMIN`, `MANAGER`, `VIEWER`, invitations, admin users.
- WB accounts: encrypted API keys, tax rate, seller metadata, active status, account selector через `?account=id`.
- Product cards: sync карточек/цен, карточная таблица, price refresh/update flow.
- References: себестоимость, самовыкупы, внешняя реклама, article overrides, reply templates.
- Financial reports: realization, paid storage, references, products, ad spend allocation, XLSX export, sticky report table, user column order.
- Sales plan: CRUD, article detail, orders/sales/funnel sync, daily metrics, add from stock, XLSX export.
- Advertising: campaigns, stats, nm stats, clusters, logs, XLSX export, bid/budget/status actions.
- Background sync: BullMQ jobs, `SyncJobRun`, schedules, `/sync`, manual enqueue actions.
- Dashboard analytics: summary, freshness, problem center, product risk, stock risk, feedback workload, forecasts, deterministic recommendations, dashboard exports.
- Inventory: WB warehouse stock snapshots and current stock screen.
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

## Deprecated

- `PROMPTS_GUIDE.md` is a legacy prompt archive.
- Old flat `docs/*.md` files are legacy redirects or archives after the 3-zone split.
- Do not rely on live WB API reads as analytics source.
- Do not read every `.md` at session startup.

## Important Risks

- Historical WB data must not be overwritten without explicit confirmation.
- WB-changing actions exist in code for prices, feedback answers and advertising; they require clear user intent.
- Large raw tables can become slow if queried without `wbAccountId` and period filters.
- `ad_campaign_nm_stats` can be incomplete depending on WB `fullstats`; reports use corrected spend history logic where implemented.
- Some old docs may contain historical context but should not be treated as current operating instructions unless indexed as such.

