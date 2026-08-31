# Project State

Update 2026-08-27: `docs/core/MINI_PC_RUNBOOK.md` is now the canonical stable map for production mini-PC operations. It routes agents through local-vs-production identity checks, Tailscale/OpenSSH preflight, Docker/runtime and persistent-state boundaries, read-only diagnostics, controlled releases, backup/restore safeguards, Windows session caveats and approval gates. Volatile release, incident and task details remain in the existing state/handoff/current-task documents.

Update 2026-08-27: the laptop's local development PostgreSQL database was safely refreshed from a validated read-only production snapshot. Restore validation was completed in an isolated local database before switching it into `wb_cabinet`; all 13 committed migrations match, the expected historical rolled-back record remains, and final local counts are 2 users, 3 WB accounts, 171 products, 14,161 orders and 77,276 realization-report rows. Production stayed online and unchanged, Redis was not copied, temporary snapshot files were removed, and local sync/automation workers remain stopped. The local Next.js dev server is healthy at `http://127.0.0.1:3000`.

Update 2026-08-24: controlled GitHub-to-mini-PC deployment is operational. CI verifies every pushed/PR commit; production remains owner-confirmed through the manual `Deploy production` workflow on the self-hosted Windows runner. GitHub Actions run `32679512118` successfully deployed commit `abb5853ddbb0636a98ac86e8f853081d64665b05` as versioned image `nimba-app:abb5853ddbb0`, after a validated PostgreSQL backup and migration check. App, PostgreSQL and Redis are healthy, both workers are running, and local plus Tailscale health return HTTP 200. Code rollout preserved the Docker database volumes and synchronized production data. Reliable private access remains `https://win-sk69nvld6f0.tailc11887.ts.net`; the separate public Cloudflare path remains unresolved.

Update 2026-08-24: production services on the mini-PC and direct Tailscale access are healthy, but public `app.nimbaos.ru` is not suitable for Russian IPv4 clients while responses pass through Cloudflare. A 124,727-byte Next.js chunk repeatedly stopped at about 24,576 bytes from the affected laptop, while it completed locally and through Tailscale; small range requests and NextAuth API calls complete normally. The obsolete Worker custom domain was removed, Tunnel DNS was restored, and Cloudflared runs automatically over QUIC/IPv6. Current reliable access is the trusted Tailscale URL or laptop SSH tunnel. The preferred no-VPS public solution is a public/static ISP IPv4, direct HTTPS on the mini-PC and DNS-only records.

Update 2026-08-21: BUG-029 is resolved and live-verified on production commit `bb139f9`. Scheduled sync and automation processors share an 18-hour queue-wait grace capped below one daily cycle, so the second account is no longer rejected after waiting behind a long concurrency-1 WB job. An approved bounded Galioni advertising sync advanced coverage from 2026-08-12 through 2026-08-21 with zero errors. The morning report for 2026-08-20 was then rerun successfully for both accounts: 20 rows per Google Sheet and zero failures. All containers are running, local health is HTTP 200, and Redis contains 14 future sync schedulers plus one future morning-report scheduler.

Update 2026-08-21: the product/workflow automation runtime is deployed on the mini-PC. `nimba-automation-worker-1` runs continuously in the production compose project, the Google service-account credential is supplied through untracked `.env.production`, and the enabled morning-report schedule is registered in Redis. Initial startup avoided an uncovered report; after `BUG-029` recovery, live Google Sheet output was verified for both mapped accounts.

Update 2026-08-21: production sync scheduling is operational on the mini-PC. PostgreSQL had preserved the two enabled 02:00 Moscow product-card schedules, but Redis had no BullMQ scheduler metadata, so no nightly jobs were emitted. All schedule settings were re-applied: 16 enabled schedulers are now registered for two cabinets. The missed card refreshes were run manually and both succeeded with zero errors (Nimba: 87 cards/131 price rows; Galioni: 63 cards/63 price rows).

Update 2026-08-21: production on the Windows 11 mini-PC now runs `main` commit `15e9100`. A validated custom-format backup was created before rollout, the new `nimba-app` and `nimba-worker` images were built and deployed, and local `/api/health` returns 200. Prisma found no pending migrations because the restored production database already contains all 13 repository migrations, including FBS operations. PostgreSQL/Redis remained online and basic user/account counts were retained. Tailscale plus key-based OpenSSH now provides working remote administration at `n8929@100.107.244.75`; AnyDesk remains a fallback. The trusted laptop has a restarting logon task that exposes the app privately at `http://127.0.0.1:13000`. The earlier application outage followed a Windows Update reboot: Docker Desktop requires an interactive Windows login, while a normal session lock does not stop it. Public `app.nimbaos.ru` availability is still blocked by the separate Cloudflare Tunnel/CGNAT issue.

Update 2026-08-14: the Windows 11 mini-PC production runtime is operational locally. PostgreSQL, Redis, the Next.js app and sync worker are running under Docker, the restored database is intact, and local `/api/health` returns 200. Public ingress is blocked by BUG-026: the current route is double NAT through Keenetic and ZTE before MGTS CGNAT, and Cloudflare Tunnel becomes externally unreachable despite locally established port-7844 connections. AnyDesk is installed as an automatic LocalSystem service and AC sleep/hibernation are disabled; its unattended password still needs local setup and an external-network test. LAN SSH is not reachable from another network until a secure VPN/overlay is added. Public/static IPv4 activation or a VPS/direct-HTTPS fallback is required before production rollout can be considered complete.

Update 2026-06-04: WB financial report sync was migrated and live-verified from deprecated `GET /api/v5/supplier/reportDetailByPeriod` to `POST /api/finance/v1/sales-reports/detailed`. The successful Galioni run inserted 244 new rows for 2026-06-02 - 2026-06-03 and advanced coverage through 2026-06-03. The implementation uses POST JSON, `rrdId` pagination, selected fields, camelCase/string-money normalization, a 1 request/minute Finance throttle, and records exact `sourceApi` metadata in future job results.

Update 2026-06-04: fixed financial report cost-price matching after Finance API lowercased `vendorCode`. Reference matching is now normalized and case-insensitive; `парео зеленое/вискоз` and four other affected sold articles now receive their configured cost price.

Update 2026-05-26: `Утренний отчет WB` automation is DB-only after `BUG-010`. It no longer performs WB sync/API calls during sheet filling; missing coverage must be fixed via separate sync jobs.

Update 2026-05-26: `Утренний отчет WB` automation bug `BUG-008` is fixed at code level: previous-day targeting uses the Moscow calendar date, `A43:C43` month progress cells are filled, duplicate orders sync is skipped for the same range, and run results include per-step timings.

Update 2026-05-25: `/automations` and the first workflow `Утренний отчет WB` are implemented at code level with a separate BullMQ automation queue, Google Sheets service-account runtime, and configurable account-to-sheet mapping.

Update 2026-05-25: `Заказано руб.` now sums all WB order rows, including cancelled orders, to represent ordered ruble volume.

Update 2026-05-25: `Заказано руб.` sync was repaired. `reports.period` now refreshes `wb_orders` for the selected report period, and orders are upserted so changed WB order sums/cancellations update local data.

Update 2026-07-30: FBS workplace is implemented at code level: seller warehouses/assortment, local inventory/reservations, orders/status/meta, supplies/stickers, KIZ lifecycle, manual Chestny Znak queue, FBS finance enrichment/analytics, interval sync and guarded WB writes. Operational sync securely imports the exact WB `orderId -> sgtin[]` mapping before redacting metadata. Initial live runs created/assigned 20 current codes; BUG-022 then repaired 9 Nimba mappings from 2026-07-28 and replaced two stale workers with one current worker. WB metadata readiness is separate from Chestny Znak circulation. No production migration, schedule enablement, bounded historical backfill or WB write was executed.

Update 2026-08-12: BUG-023 fixed FBS analytics false zeroes by linking Finance sale/return rows to operational FBS orders through account-scoped `orderId`. `/fbs` now shows orders, cancellations, buyouts, returns, net revenue and net transfer. The handoff-time KIZ withdrawal trigger was retained and documented against current light-industry distance-sale rules.

Update 2026-08-12: FBS Stage 1 Chestny Znak processing now supports separate withdrawal/return XLSX files and mass confirmation of a complete exported batch. Local KIZ circulation changes only after operator confirmation of the accepted CRPT document; direct live CRPT verification remains Stage 2.

Update 2026-08-12: BUG-024 fixed post-handoff KIZ detachment. Pickup cancellation and defect keep the order-to-KIZ association, including late shipment-status reconciliation; historical events/tasks are used for current UI recovery. Authorized FBS tables show the CRPT identification code without AIs 91/92, `UNKNOWN` is explained as «Статус в ЧЗ не указан», and all FBS tabs now have local search/status filters. No production or WB mutation was performed.

Update 2026-08-13: FBS page growth is bounded without deleting history: heavy lists load an operationally prioritised window of up to 100 rows, paginate locally and show exact database totals; all FBS tables sort from column headers. Analytics uses the shared range calendar and adds article orders/cancellations plus direct FBS OP/margin, explicitly excluding unallocated shared advertising. One exact user-authorized sold-order KIZ was changed locally from `IN_CIRCULATION` to `WITHDRAWN` with an audit event; no WB/CRPT write or sync occurred.

Update 2026-08-13: the temporary local 100-row FBS archive limit was superseded by server-side full-history search/filter/sort and 25/50/100-row pages for orders, KIZ, CRPT tasks, supplies and WB actions, with a shared optional history date range. Analytics now includes total and article profitability/buyout percentage alongside direct OP/margin. Encrypted KIZ values remain protected at rest and are not bulk-returned to the browser.

Update 2026-08-13: BUG-025 prevents late historical pickup-cancellation/defect records from generating an unconfirmed withdrawal followed immediately by return to circulation. Pending withdrawals are canceled and remain locally in circulation while physical state stays return-expected; confirmed withdrawals retain the explicit return-to-circulation path. Reconciled 28 Nimba and 40 Galioni tasks with audit events; final open canceled-order withdrawal count is zero in both cabinets. No WB/CRPT call was made.

Update 2026-08-13: BUG-025 added the CRPT-required numeric unit price to withdrawal XLSX files using the linked WB order `convertedPriceRaw / 100`, without VAT markup for the current 0% VAT seller. Four historical downloads were rebuilt as corrected copies. A read-only audit tied all 57 apparent `IN_STOCK + UNKNOWN` units to historical post-handoff pickup-cancellation/defect orders; no live sync or data mutation was performed.

Текущее состояние NimbaOS. Last updated: 2026-08-27.

## Current Phase

Фазы 0-9 реализованы на уровне кода. После Phase 9 добавлены dashboard analytics, stock inventory, reviews/questions, рекомендации, Excel exports, seller-size drilldown и hardening рекламы/отчетов. Phase 7/8 все еще требуют широкой live WB verification после rate-limit окон. Текущий `main` развернут на mini-PC и доступен локально/Tailscale, но публичный домен заблокирован нестабильным ingress через Cloudflare Tunnel за double NAT/CGNAT.

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
- FBS: seller-owned stock, assortment per warehouse/chrtId, operational orders, supplies/stickers, automatic encrypted order-to-KIZ ingestion from WB metadata, manual Chestny Znak XLSX flow, audited per-warehouse WB write gate.
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
- Stock history charts.
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
- The FBS migration is applied to both local development and production databases. Production received it through the restored source database before the 2026-08-21 rollout. Interval schedules and the `2026-07-20` - `2026-07-30` backfill were not run. All FBS schedule defaults and warehouse write gates remain disabled.
- Historical WB data must not be overwritten without explicit confirmation.
- WB-changing actions exist in code for prices, feedback answers and advertising; they require clear user intent.
- Large raw tables can become slow if queried without `wbAccountId` and period filters.
- Fresh `Заказано руб.` depends on `wb_orders`; reports may be fresher than orders/sales if `sales-plan.period` has not run.
- `Утренний отчет WB` writes to Google Sheets only when the service account is configured and the Sheet is shared; it is DB-only and must fail fast instead of calling WB sync/API services.
- `ad_campaign_nm_stats` can be incomplete depending on WB `fullstats`; reports use corrected spend history logic where implemented.
- Some old docs may contain historical context but should not be treated as current operating instructions unless indexed as such.
