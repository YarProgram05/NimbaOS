# Dev Current Tasks

## Active

- ID: TASK-AGNIA-INITIAL-HISTORICAL-SYNC
  Status: Running
  Priority: High
  Description: Initial production fill for `WB AGNIA`: cards and advertising campaigns completed; advertising stats, reports/storage, current WB stocks, reviews and questions were queued for `2026-01-01` through `2026-08-20` where the sync kind supports a period.
  Next step: Monitor the production sync queue until all seven runs finish, then verify coverage and row counts. Do not enqueue the same historical range again while these runs are active.
  Related files: `src/lib/queue/sync-processor.ts`, `src/lib/services/sync-*`, `/sync`.
  Risks: Advertising and report history is rate-limited by WB; the single production worker intentionally processes jobs sequentially.

## Next

- ID: TASK-P7-P8-LIVE-VERIFY
  Status: Pending
  Priority: High
  Description: Провести safe smoke verification read-only WB sync jobs после rate-limit окон.
  Next step: Согласовать кабинеты, период и допустимые live API calls.
  Related files: `src/lib/services/sync-*`, `src/lib/queue/sync-processor.ts`, `/sync`.
  Risks: WB 429, long retries, incomplete ad stats.

## Blocked

- ID: TASK-PUBLIC-INGRESS-NON-CLOUDFLARE
  Status: Blocked by ISP/public-ingress choice
  Priority: High
  Description: `app.nimbaos.ru` is not reliable for Russian IPv4 users while responses pass through Cloudflare. Small HTML/API responses complete, but larger Next.js JavaScript files are truncated after roughly 16-24 KB, so the login form does not hydrate.
  Next step: Obtain a public/static IPv4 from the ISP, configure direct HTTPS on the mini-PC and switch `app.nimbaos.ru` to DNS-only. Until then use `https://win-sk69nvld6f0.tailc11887.ts.net` on trusted Tailscale devices or the laptop SSH tunnel at `http://127.0.0.1:13000`.
  Related files: `docker-compose.prod.yml`, `deploy/nginx/nimbaos.conf`, `docs/development/BUGS_AND_INCIDENTS.md`.
  Risks: Cloudflare Tunnel, Workers and proxied DNS all keep Cloudflare in the response path and therefore do not solve this client-side throttling. Never expose PostgreSQL, Redis or SSH publicly.

## Done Recently

- ID: BUG-032-AUTOMATIONS-CI-PRERENDER
  Status: Fixed locally, CI confirmation pending
  Priority: High
  Description: CI build attempted to prerender the database-backed `/automations` page without PostgreSQL and failed with Prisma `ECONNREFUSED`. Both automation routes are now explicitly dynamic.
  Next step: Commit/push the fix and confirm the new GitHub Actions CI run succeeds.
  Related files: `src/app/(dashboard)/automations/page.tsx`, `src/app/(dashboard)/automations/[kind]/page.tsx`, `docs/development/BUGS_AND_INCIDENTS.md`.
  Risks: None known; request-time behavior is unchanged.

- ID: TASK-FBS-MOVEMENT-SHEET-WORKFLOW
  Status: Done locally
  Priority: High
  Description: Implemented the second automation end to end: workflow kind and migration, catalog/detail UI, queue processor, DB-first event projection, retry-safe Google Sheet upsert, pre-handoff cancellations, explicit accepted returns, daily reconciliation and readback. Added canonical tuple alias `nimba:297175085:452136209 → туника леопард/пятна`.
  Next step: Deploy code and migration through the normal production procedure and smoke-test the production worker. The local workflow is enabled/applied at 23:30 MSK; production scheduling was not changed.
  Related files: `src/lib/services/fbs-movement-sheet-workflow.ts`, `src/lib/automations/fbs-sheet.ts`, `src/app/(dashboard)/automations/[kind]/`, `prisma/migrations/20260901120000_fbs_movement_sheet_automation/`.
  Risks: Do not enable before the production migration and worker deployment. Unknown product tuples fail visibly instead of guessing; accepted returns require an explicit inventory movement.

- ID: TASK-AUTOMATIONS-CATALOG-FLEXIBLE-SCHEDULES
  Status: Done
  Priority: High
  Description: Replaced the single-workflow `/automations` settings page with a catalog and separate detail route. Added readable workflow metadata, a flexible schedule editor (multiple exact times, daily intervals, weekdays, every N weeks, month days), backward-compatible JSON persistence, BullMQ multi-scheduler registration, and automation-name display/filter/sort in the complete run history.
  Next step: Deploy normally before changing any production schedule.
  Related files: `src/app/(dashboard)/automations/`, `src/lib/automations/catalog.ts`, `src/lib/automations/schedule.ts`, `src/lib/automations/workflows.ts`, `src/lib/queue/automation-processor.ts`.
  Risks: Saving an enabled workflow reapplies its BullMQ schedulers. Every-N-weeks uses weekly cron registration plus an application-side anchor-week gate; production behavior should be smoke-checked after deployment without duplicating live schedules.

- ID: BUG-031-LOCAL-NEXT-DEV-CSS-404
  Status: Done
  Priority: Medium
  Description: Restored localhost styling after a concurrent production build replaced `.next` artifacts used by the running dev server. Restarted only the verified local `next dev`; the stylesheet again returns HTTP 200 and normal layout is visible in the authenticated in-app browser.
  Next step: Do not run `npm run build` concurrently with `npm run dev` in the same checkout; restart dev after any required build before visual QA.
  Related files: `docs/development/BUGS_AND_INCIDENTS.md`, `docs/core/COMMANDS.md`, `docs/development/TROUBLESHOOTING.md`.
  Risks: This is a local generated-artifact collision, not a source CSS regression. Database, workers, queues and production were not touched.

- ID: TASK-RUN-HISTORY-PAGINATION
  Status: Done
  Priority: High
  Description: Replaced the 50-row `/sync` and `/automations` history limit with server-side pagination across the complete `sync_job_runs` and `automation_runs` tables. Added exact totals, 25/50/100 page sizes, previous/next navigation, server-side sorting and compact filters. Both histories use the existing shared two-month calendar with quick presets as their single run-date filter; redundant period text and duplicate date inputs were removed after UI review.
  Next step: After deployment, verify both histories with multiple pages and confirm that active-run polling preserves the selected page, calendar range and filters.
  Related files: `src/lib/sync/job-runs.ts`, `src/lib/automations/runs.ts`, `src/app/(dashboard)/sync/sync-client.tsx`, `src/app/(dashboard)/automations/automations-client.tsx`, `src/components/run-history-table.tsx`.
  Risks: Sorting is intentionally offered for stored/indexable fields; derived display-only duration, period and result summaries remain filter/display fields rather than database sort keys.

- ID: TASK-MINI-PC-RUNBOOK
  Status: Done
  Priority: Medium
  Description: Added `docs/core/MINI_PC_RUNBOOK.md` as the canonical topology and safety guide for production mini-PC work. It distinguishes local dev from production, requires host/path/compose/database identity checks, documents private access and Windows session constraints, and separates read-only inspection from owner-approved mutation.
  Next step: Route every future mini-PC, SSH/Tailscale, Docker runtime, deploy, backup/restore or production-diagnostics task through the runbook and keep volatile release facts in state/handoff docs.
  Related files: `AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/core/MINI_PC_RUNBOOK.md`.
  Risks: Endpoint IPs and current runtime state can change; agents must verify them rather than treating the document as authorization to mutate production.

- ID: TASK-REFRESH-LOCAL-DEV-DATABASE
  Status: Done
  Priority: High
  Description: Refreshed the laptop-only `wb_cabinet` twice on 2026-08-31 from validated current production snapshots; the second pass captured same-day FBS changes that arrived after the first snapshot. Each restore was verified in an isolated local database before switching. All 13 repository migrations match, the expected historical rollback is retained, and final core counts are 2 users, 3 WB accounts, 171 products, 14,247 orders and 78,225 realization-report rows. Final FBS counts include 613 orders, 958 order events, 604 KIZ units, 4,197 KIZ events and 541 compliance tasks. Production remained read-only and healthy, Redis was not copied, and no local worker, scheduler, sync or WB write action was started.
  Next step: Continue local development through `http://127.0.0.1:3000`; start sync or automation workers only for a separately approved test that explicitly requires them.
  Related files: `docker-compose.dev.yml`, `prisma/migrations/`, `docs/core/DATABASE_ACCESS_GUIDE.md`.
  Risks: The snapshot includes encrypted production fields but not production encryption secrets. Use the existing local development environment and do not treat unreadable encrypted values as a reason to copy production secrets.

- ID: TASK-MINI-PC-CONTROLLED-DEPLOY
  Status: Done
  Priority: High
  Description: Added automatic GitHub CI and a manually confirmed production deployment to the Windows mini-PC through a repository self-hosted runner. The deployment builds one versioned image while the old app stays online, creates and validates a PostgreSQL backup, runs `prisma migrate deploy`, recreates the app and both workers, restores BullMQ schedules, verifies health, and records the last successful commit for application rollback.
  Next step: For future releases, push to `main`, wait for CI, then manually run `Deploy production` in GitHub Actions with the confirmation checkbox. Keep Docker Desktop running in the logged-in `n8929` Windows session.
  Related files: `.github/workflows/ci.yml`, `.github/workflows/deploy-production.yml`, `deploy/windows/deploy-production.ps1`, `deploy/windows/install-github-runner.ps1`, `docker-compose.prod.yml`.
  Risks: The Windows self-hosted runner depends on an interactive user session and Docker Desktop. Database rollback remains a separate, explicitly authorized recovery operation; ordinary code rollback never restores a database dump automatically.

- ID: TASK-PROD-DEPLOY
  Status: Done
  Priority: High
  Description: Production services are deployed on the mini-PC: PostgreSQL, Redis, Next.js, sync worker and automation worker are operational. Private access through Tailscale is fast and complete. Public `app.nimbaos.ru` is routed directly to the native Cloudflare Tunnel again, but it is not production-ready for Russian IPv4 clients because large response bodies are truncated before Next.js can hydrate.
  Next step: Keep validating the production runtime through Tailscale. Complete `TASK-PUBLIC-INGRESS-NON-CLOUDFLARE` before giving employees the public domain.
  Related files: `infra/cloudflare/nimbaos-proxy/src/index.js`, `infra/cloudflare/nimbaos-proxy/wrangler.jsonc`, `docs/development/BUGS_AND_INCIDENTS.md`.
  Risks: A healthy Cloudflare connector and successful small health checks do not prove that browsers can download the full application bundle. The obsolete Worker custom domain has been removed and must not be reattached as a workaround.

- ID: TASK-RETEST-CLOUDFLARE-OVER-ETHERNET
  Status: Done
  Priority: High
  Description: Reconnected the mini-PC to Keenetic over Ethernet, assigned permanent LAN IP `192.168.2.82`, restored all production containers, retested HTTP2 and QUIC ingress, and confirmed that the upstream WISP/double-NAT/CGNAT failure persists independently of the mini-PC Wi-Fi. Added delayed startup and 5/15/30-second recovery restarts to the Cloudflared Windows service, set the active Keenetic WISP uplink to always-on, and updated `cloudflared` to `2026.8.2`.
  Next step: Keep using Tailscale/private access until the provider path is changed; do not advertise the public hostname as reliable.
  Related files: `docs/development/BUGS_AND_INCIDENTS.md`, `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_LOG.md`.
  Risks: Cloudflare can briefly return 200 immediately after a connector restart, then degrade again; a single successful check is not evidence of recovery.

- ID: TASK-FIX-SCHEDULED-SYNC-QUEUE-GRACE
  Status: Done
  Priority: High
  Description: Replaced the 10-minute queue-delay guard with a shared 18-hour policy capped below one day, deployed it to both production workers, restored Galioni advertising coverage through 2026-08-21, and live-verified the 2026-08-20 morning report for both accounts with zero failures.
  Next step: Confirm the next normal scheduled advertising sync and morning report in the UI; no corrective run is currently pending.
  Related files: `src/lib/queue/scheduled-job-policy.ts`, `src/lib/queue/sync-processor.ts`, `src/lib/queue/automation-processor.ts`, `docker-compose.prod.yml`.
  Risks: Keep the grace below 1440 minutes and worker concurrency at 1 unless WB rate-limit behavior is revalidated.

- ID: TASK-MINI-PC-AUTOMATION-RUNTIME
  Status: Done
  Priority: High
  Description: Added the production `automation-worker`, securely injected the Google service-account credential, re-applied the one enabled automation schedule, and verified that the worker starts with no waiting or active jobs. The one-shot scheduler container was removed after registration.
  Next step: Confirm the next normal scheduled run through `/automations`; the owner-authorized 2026-08-20 recovery run already succeeded for both mapped sheets.
  Related files: `docker-compose.prod.yml`, `scripts/automation-worker.ts`, `scripts/schedule-automations.ts`, `src/lib/queue/automation.ts`.
  Risks: The workflow writes to Google Sheets and requires complete local report/advertising coverage; live output is now verified for both accounts.

- ID: TASK-MINI-PC-SYNC-SCHEDULE-RESTORE
  Status: Done
  Priority: High
  Description: Restored all production BullMQ sync schedules after finding that PostgreSQL contained the enabled schedule settings but Redis had no registered schedulers. Registered 16 enabled schedulers for two cabinets and successfully ran the missed `PRODUCTS_REFRESH` jobs for both cabinets with zero errors.
  Next step: Confirm a normal scheduled run in `/sync`; after any Redis data-volume recreation, re-apply schedules before relying on nightly sync.
  Related files: `src/lib/sync/schedules.ts`, `scripts/schedule-sync.ts`, `docker-compose.prod.yml`, `docs/core/COMMANDS.md`.
  Risks: PostgreSQL schedule rows alone do not execute jobs; BullMQ scheduler metadata must also exist in the persistent Redis volume.

- ID: TASK-MINI-PC-REMOTE-ACCESS
  Status: Done
  Priority: High
  Description: Installed and verified Tailscale on the trusted development laptop and mini-PC. Key-based OpenSSH access works remotely as `n8929@100.107.244.75`; AnyDesk remains a graphical fallback. The laptop task `NimbaOS Temporary Tunnel` provides working private browser access at `http://127.0.0.1:13000`.
  Next step: Prefer Ethernet to Keenetic, or make only `Keenetic-7780` automatic on the mini-PC. Optionally configure Tailscale Serve for private employee access while public ingress is repaired.
  Related files: `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_LOG.md`, `docs/core/COMMANDS.md`.
  Risks: Tailnet membership grants private-network reachability; invite only trusted users and keep database/Redis ports unexposed. Docker Desktop still requires a logged-in Windows user after reboot.

- ID: TASK-MINI-PC-APP-UPDATE-20260821
  Status: Done
  Priority: High
  Description: Backed up production, updated the mini-PC checkout to `15e9100`, built and deployed new app/worker images, and verified health and retained data. Production already had all 13 migrations, including FBS operations.
  Next step: Perform authenticated UI smoke checks for `/fbs` and other newly added sections without running broad syncs or WB write actions.
  Related files: `docker-compose.prod.yml`, `Dockerfile`, `prisma/migrations/20260730120000_fbs_operations/migration.sql`.
  Risks: Public domain ingress remains blocked independently; FBS schedules and WB write gates remain disabled.

- ID: BUG-025-FBS-LATE-WITHDRAWAL-AFTER-CANCEL
  Status: Done
  Priority: High
  Description: Prevented historical post-handoff cancellation/defect orders from creating or remaining in an unconfirmed withdrawal queue. Pending withdrawals are canceled and kept in circulation; confirmed withdrawals retain the normal return-to-circulation path after physical receipt. Reconciled both local cabinets.
  Next step: Do not upload the obsolete 28-row Nimba file. For Galioni, regenerate a fresh file before any CRPT upload; old files include tasks that are now canceled locally.
  Related files: `src/lib/fbs/state-machine.ts`, `src/lib/services/sync-fbs.ts`, `src/lib/services/fbs-operations.ts`, `src/lib/fbs/state-machine.test.ts`.
  Risks: WB cancellation means return expected, not physically received. The KIZ must not become sellable stock until scanned/inspected; confirmed CRPT withdrawals still need explicit return to circulation.

- ID: TASK-FBS-SERVER-HISTORY-AND-KPI-EXTENSION
  Status: Done
  Priority: High
  Description: Replaced the temporary client-only 100-row history with account-scoped server search/filter/sort and 25/50/100-row pagination for orders, KIZ, CRPT tasks, supplies and WB actions. Added a common history period and analytics totals/article columns for profitability and buyout percentage.
  Next step: After deployment, use a known old order/KIZ to verify archive navigation and compare the four analytics summary KPIs for one period.
  Related files: `src/lib/services/fbs-history.ts`, `src/lib/actions/fbs.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`, `src/lib/fbs/analytics.ts`.
  Risks: Encrypted KIZ text search decrypts only inside the trusted server process after account/date/status scoping; it cannot use a plain SQL text index without weakening at-rest protection.

- ID: TASK-FBS-HISTORY-SORT-ANALYTICS
  Status: Done
  Priority: High
  Description: Preserved the complete FBS database history while bounding heavy page payloads to the latest 100 records, adding 25-row pagination, exact total counters and click-header sorting across all FBS tables. Replaced analytics date inputs with the shared calendar and added article orders, cancellations, direct FBS OP and margin. Removed the standalone unknown-circulation explanation and applied one audited user-authorized KIZ state correction.
  Next step: After deployment, visually verify sorting/pagination and compare one article's direct FBS OP with its realization rows and cost reference for the same period.
  Related files: `src/app/(dashboard)/fbs/fbs-client.tsx`, `src/lib/services/fbs-workspace.ts`, `src/lib/fbs/analytics.ts`, `src/types/fbs.ts`.
  Risks: Sorting applies to the latest loaded page window, while the UI separately shows the exact all-history total. Direct FBS OP excludes shared advertising because it has no reliable fulfillment-method allocation.

- ID: TASK-FBS-CRPT-WITHDRAWAL-PRICE
  Status: Done
  Priority: High
  Description: Added the mandatory numeric `Цена за единицу с НДС` to future CRPT withdrawal XLSX files using the linked WB order price (`convertedPriceRaw / 100`) with no VAT markup; return-to-circulation exports remain code-only. Rebuilt four historical withdrawal downloads as separate corrected copies.
  Next step: Upload a corrected `_с_ценами.xlsx` file to a draft CRPT withdrawal document and verify that CRPT accepts both columns before signing.
  Related files: `src/lib/fbs/compliance-export.ts`, `src/lib/fbs/compliance-export.test.ts`, `src/lib/services/fbs-operations.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`, `outputs/fbs_kiz_price_repair_2026-08-13/`.
  Risks: Price comes from the WB seller-currency order field. A task with missing/zero price is intentionally rejected instead of generating an incomplete file.

- ID: BUG-024-FBS-KIZ-POST-HANDOFF-LINK
  Status: Done
  Priority: High
  Description: Pickup cancellation and defect no longer detach KIZ; authorized tables show CRPT identification codes, ambiguous UNKNOWN wording was clarified, and search/status filters were added throughout FBS.
  Next step: After deployment, run a normal bounded operational sync and visually verify affected historical orders; do not run a broad historical resync without approval.
  Related files: `src/lib/fbs/state-machine.ts`, `src/lib/services/sync-fbs.ts`, `src/lib/services/fbs-workspace.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`.
  Risks: An old order with neither a saved KIZ event/task nor current WB SGTIN metadata cannot be reconstructed automatically.

- ID: TASK-FBS-RUSSIAN-STATUS-LABELS
  Status: Done
  Priority: Medium
  Description: Replaced raw KIZ queue statuses, WB action statuses and WB action codes in `/fbs` with understandable Russian labels. Clarified KIZ circulation wording while preserving internal enum values in storage and application logic.
  Next step: Refresh `/fbs` and verify the labels in «Честный знак», the KIZ table and «Последние записи в WB».
  Related files: `src/lib/fbs/status-labels.ts`, `src/lib/fbs/status-labels.test.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`.
  Risks: Future unknown values intentionally display a Russian «Неизвестный статус/действие» fallback instead of leaking an English technical code into the visible label.

- ID: TASK-FBS-KIZ-BULK-FILE-WORKFLOW
  Status: Done
  Priority: High
  Description: Added separate CRPT-compatible XLSX exports for KIZ withdrawal and return to circulation, plus mass confirmation of all tasks from one exported batch using a single Chestny Znak document number/date. Exported codes contain only the identification part (`01 + GTIN + 21 + serial`), without AIs 91/92.
  Next step: In `/fbs?tab=compliance`, upload each generated file to the matching Chestny Znak document and confirm the whole file in NimbaOS only after CRPT accepts it.
  Related files: `src/lib/fbs/compliance-export.ts`, `src/lib/fbs/kiz.ts`, `src/lib/services/fbs-operations.ts`, `src/lib/services/fbs-workspace.ts`, `src/lib/actions/fbs.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`.
  Risks: NimbaOS stores a local audited circulation state; Stage 1 does not query the live Chestny Znak status. An incorrectly confirmed batch would make the local state diverge from CRPT.

- ID: BUG-023-FBS-ANALYTICS-ZERO
  Status: Done
  Priority: High
  Description: Fixed `/fbs` analytics returning zero because WB Finance marks FBS mainly on zero-quantity logistics rows. Sale/return rows are now linked through financial `orderId` to operational `fbs_orders.externalOrderId`. Added orders, cancellations, buyouts, returns, net revenue and net transfer metrics plus article detail.
  Next step: Refresh `/fbs`, choose an account and period, and verify the displayed values against the normal financial-report coverage for that period.
  Related files: `src/lib/fbs/analytics.ts`, `src/lib/services/fbs-workspace.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`, `src/types/fbs.ts`.
  Risks: Orders/cancellations are grouped by order creation date; financial metrics use report operation date. Missing FBS operational sync or Finance coverage can still make one side incomplete.

- ID: BUG-018-NESTED-PNPM-BROKE-NPM-INSTALL
  Status: Done
  Priority: High
  Description: Recovered the local npm dependency tree after bundled pnpm was run from a nested report work folder and moved 38 direct packages into `node_modules/.ignored`. Removed a report-workspace `node_modules` junction that caused 10,000+ apparent Git changes, restored dependencies with `npm ci`, and regenerated Prisma Client.
  Next step: Keep all one-off report dependency tooling in an isolated temporary directory outside this repository; use npm only for the NimbaOS root.
  Related files: `package.json`, `package-lock.json`, `docs/development/BUGS_AND_INCIDENTS.md`.
  Risks: Running pnpm from any descendant folder without its own manifest can resolve the parent npm project; a junction inside `outputs` can make Git/VS Code recursively enumerate external dependencies.

- ID: TASK-MORNING-WB-SHEET-YTD-LAYOUT
  Status: Done
  Priority: High
  Description: Updated `Утренний отчет WB` layout and workflow writer: removed `ROMI`, added `Выкупили, шт`, added `ЧП на 1 ед`, added `Итого с начала года` from Jan 1 through target date, and shifted plan/progress/chart area down.
  Next step: For the next target date, make sure `REPORTS_PERIOD` covers Jan 1 through target date and `ADVERTISING_STATS` covers the current month window through target date.
  Related files: `src/lib/services/morning-wb-report-workflow.ts`, Google Sheet `Утренний отчет WB`.
  Risks: YTD row requires report coverage from Jan 1; advertising freshness is checked for the current month being written.

- ID: TASK-ARTICLE-VERSIONS-CROSS-SECTIONS
  Status: Done
  Priority: High
  Description: Extended dated article-version resolution from financial reports to advertising article stats, sales-plan metrics/detail, analytics comparison chart, and reviews/questions display.
  Next step: In `/references`, manually add known version periods/costs for product model changes under the same WB `nmId`; then refresh affected sections for the selected period.
  Related files: `src/lib/services/article-versions.ts`, `src/lib/actions/advertising.ts`, `src/lib/services/plan-calculator.ts`, `src/lib/actions/sales-plan.ts`, `src/lib/services/feedback.ts`, `src/app/(dashboard)/analytics/chart`.
  Risks: Existing historical transitions are not auto-backfilled; exact change dates and version-specific cost prices must be entered by the user.

- ID: BUG-016-ARTICLE-VERSIONS-HISTORY
  Status: Done
  Priority: High
  Description: Добавлены датированные версии артикулов, чтобы финансовый отчет не смешивал старую и новую физическую модель под одним WB `nmId`. Версия задает период, название в отчете и опциональную себестоимость версии.
  Next step: В `/references?tab=article-versions` вручную завести реальные смены моделей/принтов с точными датами и себестоимостью; например разделить старое `Парео синяя ракушка` и новое `парео синяя разводы`.
  Related files: `prisma/schema.prisma`, `prisma/migrations/20260619120000_article_versions/migration.sql`, `src/lib/services/report-calculator.ts`, `src/lib/actions/references.ts`, `src/app/(dashboard)/references/article-version-tab.tsx`.
  Risks: Если версии не заведены вручную, отчеты будут вести себя как раньше. Периоды версий одного `nmId` не должны пересекаться; server actions это проверяют.

- ID: BUG-015-FINANCE-ORDERED-RUB-LONG-PERIOD
  Status: Done in code
  Priority: High
  Description: Fixed long-period financial-report `Заказано руб.` undercount caused by report sync reusing incremental order cursors from partial `wb_orders` ranges.
  Next step: In the normal app environment, run `reports.period` for `WB Nimba` and `WB Galioni`, 2026-01-01 - 2026-06-17, then verify `/reports` totals.
  Related files: `src/lib/queue/sync-processor.ts`, `src/lib/services/sync-orders.ts`, `src/lib/services/report-calculator.ts`.
  Risks: Wide order backfills use the WB Statistics API and can be slow/rate-limited; do not start unrelated full historical syncs.

- ID: BUG-014-AD-COMBINED-CARD-STATS
  Status: Done
  Priority: High
  Description: Fixed advertising campaign detail so campaigns with multiple WB combined-card groups use the primary `imtID`, show only meaningful nm rows, normalize basket-only order rows, and use advertising `sum_price` for order sum. Existing product `imtId` and ad `orderSum` rows were backfilled for active accounts/campaign periods.
  Next step: Refresh advertising campaign detail pages; `Кампания от 10.06.2026` is expected to show 6 articles, 31 baskets, 8 ad orders, 16680.00 ad order sum for 2026-06-10 - 2026-06-14.
  Related files: `src/lib/actions/advertising.ts`, `src/lib/services/sync-ad-stats.ts`, `src/lib/services/sync-products.ts`, `prisma/schema.prisma`, `prisma/migrations/20260616120000_product_imt_id/migration.sql`, `prisma/migrations/20260616123000_ad_order_sum/migration.sql`, `prisma/migrations/20260616124500_product_imt_id_bigint/migration.sql`.
  Risks: New future campaigns still depend on normal product/ad stats sync to persist `imtId` and `orderSum`; WB fullstats can still rate-limit broad historical checks.

- ID: BUG-013-STOCK-RISK-CLASSIFICATION
  Status: Done
  Priority: High
  Description: Reworked `/stocks` risk classification so `Нет остатка` means zero total sellable stock, `В норме` is reachable for 14-120 days of coverage, and multiple categories can be selected in the filter.
  Next step: Refresh `/stocks`; if many rows remain `Нет продаж`, check recent `wb_sales`/`realization_reports` coverage for the 30 completed days before the latest stock snapshot.
  Related files: `src/lib/services/stocks.ts`, `src/app/(dashboard)/stocks/stocks-client.tsx`, `src/lib/services/dashboard-export.ts`, `docs/marketplace/KPI_DEFINITIONS.md`.
  Risks: Size-level risk uses `realization_reports` barcode data when available; if report coverage is stale, size risks can still fall back to article-level demand.

- ID: BUG-012-FINANCE-COST-PRICE-MATCH
  Status: Done
  Priority: High
  Description: Fixed missing financial-report cost prices caused by Finance API lowercasing `vendorCode` while reference tables preserved product-card casing.
  Next step: Monitor financial reports for genuinely missing cost references; normalized vendor-code matching now covers cost prices and related references.
  Related files: `src/lib/services/report-calculator.ts`, `docs/development/BUGS_AND_INCIDENTS.md`.
  Risks: Equivalent normalized cost-price duplicates with different values use the most recently updated entry.

- ID: TASK-WB-FINANCE-REPORTS-MIGRATION
  Status: Done
  Priority: High
  Description: Migrated financial report sync to Finance API `POST /api/finance/v1/sales-reports/detailed`; verified a successful live Galioni sync reaching 2026-06-03 and inserting 244 rows for 2026-06-02 - 2026-06-03.
  Next step: Monitor future `REPORTS_PERIOD` results; `report.sourceApi` now records the exact domain/method/path.
  Related files: `src/lib/wb-api/reports.ts`, `src/lib/services/sync-reports.ts`, `src/lib/wb-api/constants.ts`, `src/types/reports.ts`, `docs/core/WB_API_MAP.md`.
  Risks: `204 No data` can still mean WB has not formed the report yet; avoid broad historical resyncs without confirmation.

- ID: TASK-AUTOMATION-SAME-DAY-SCHEDULE
  Status: Done
  Priority: High
  Description: Fixed BullMQ scheduler setup so saving a near-future Moscow time does not skip the first same-day run.
  Next step: Set `/automations` to a future time a few minutes ahead and save; BullMQ should create a same-day delayed job.
  Related files: `src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`.
  Risks: Existing scheduler already moved to tomorrow if today's time has passed; save a future time to verify same-day behavior.

- ID: TASK-MORNING-WB-DB-ONLY
  Status: Done
  Priority: High
  Description: Hardened `Утренний отчет WB` so it only reads local DB data and writes Google Sheets. It no longer runs report/orders/sales-plan/ads/stocks sync services or live advertising API calls.
  Next step: Refresh `/automations`; if a run fails for missing coverage, run the relevant sync separately and rerun the workflow.
  Related files: `src/lib/services/morning-wb-report-workflow.ts`, `src/lib/services/morning-report.ts`.
  Risks: Workflow now fails fast instead of auto-syncing; this is intentional to keep runtime predictable.

- ID: TASK-AUTOMATION-NEXT-RUN-MSK
  Status: Done
  Priority: High
  Description: Fixed schedule next-run calculation and UI so `/automations` and `/sync` use Moscow calendar time end-to-end instead of browser/runtime or host local time.
  Next step: Refresh `/automations`; a `13:28` workflow should display `Следующий запуск` at `13:28` MSK.
  Related files: `src/lib/time/moscow.ts`, `src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`, `src/lib/queue/automation-processor.ts`, `src/lib/queue/sync-processor.ts`, `src/app/(dashboard)/automations/automations-client.tsx`, `src/app/(dashboard)/sync/sync-client.tsx`.
  Risks: None known; scheduling itself already used `Europe/Moscow`.

- ID: TASK-FBS-SHEET-WB-STOCK
  Status: Done locally, Pending production rollout
  Priority: High
  Description: `Остаток WB` now comes from the fresh read-only FBS stock snapshot, not from the movement ledger. The workflow upserts 53 stable tuple rows, verifies Summary per product/account, and reports missing local replenishments as warnings rather than failures.
  Next step: Review the 11 current replenishment warnings, deploy the committed migration/code when approved, then explicitly apply/enable the production workflow and automation worker/scheduler. Local scheduling is already enabled/applied.
  Related files: `src/lib/services/fbs-movement-sheet-workflow.ts`, `src/lib/automations/fbs-sheet.ts`, `src/lib/automations/fbs-sheet.test.ts`, `src/lib/automations/runs.ts`.
  Risks: The stock snapshot must be no older than 30 minutes; unmapped positive WB tuples remain a hard error because silently assigning stock to the wrong physical product would corrupt the Summary.

- ID: TASK-MORNING-WB-LIVE-RUN-FIXES
  Status: Done
  Priority: High
  Description: Fixed first live `Утренний отчет WB` issues: previous-day target date now uses the Moscow calendar date, summary cells `A43:C43` are filled, duplicate monthly `orders` sync is skipped when report sync already refreshed the same range, and per-step timings are saved in run results.
  Next step: On the next real manual run, inspect `AutomationRun.result.accounts[].steps` for Nimba/Galioni timing; API calls should appear only for missing coverage.
  Related files: `src/lib/services/morning-wb-report-workflow.ts`, `docs/development/BUGS_AND_INCIDENTS.md`.
  Risks: Google Sheet writes affect live report; WB API rate limits can still slow runs when coverage is missing.

- ID: TASK-AUTOMATIONS-MORNING-WB
  Status: Done
  Priority: High
  Description: Added `/automations` and the first configurable workflow for daily Google Sheet filling of `Утренний отчет WB`.
  Next step: Configure `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, share the Sheet with the service account, restart the app/automation worker, then run `npm run worker:automation` and `npm run automation:schedule` in the target environment.
  Related files: `src/app/(dashboard)/automations`, `src/lib/services/morning-wb-report-workflow.ts`, `src/lib/queue/automation.ts`, `prisma/schema.prisma`.
  Risks: Google Sheets credentials/sharing are currently the blocker for real writes; WB 429 during freshness sync; no automatic archive of previous months in v1.

- ID: TASK-ORDERED-RUB-INCLUDE-CANCELS
  Status: Done
  Priority: High
  Description: Changed financial report `Заказано руб.` to sum all WB orders, including cancelled rows.
  Next step: Refresh `/reports` and verify older periods now align with buyout ratio expectations.
  Related files: `src/lib/services/report-calculator.ts`, `src/app/(dashboard)/reports/columns.tsx`, `src/types/reports.ts`.
  Risks: Plan/funnel metrics may still intentionally exclude cancellations; do not conflate them with this report metric.

- ID: TASK-BULLMQ-LOCK-316
  Status: Done
  Priority: High
  Description: Fixed stuck `REPORTS_PERIOD` run after BullMQ lost lock on job `316`; increased worker lock and limited forced orders backfill for long report periods.
  Next step: Refresh `/reports`; rerun sync only if a new period is needed.
  Related files: `src/lib/queue/index.ts`, `src/lib/queue/sync-processor.ts`.
  Risks: WB Statistics API rate limits still make very wide syncs slow.

- ID: TASK-ORDERED-RUB-SYNC-FIX
  Status: Done
  Priority: High
  Description: Fixed `Заказано руб.` synchronization by syncing `wb_orders` during report sync and upserting changed WB order rows.
  Next step: Run a normal report sync for the target Galioni period, then verify `Заказано руб.` from `wb_orders.finishedPrice`.
  Related files: `src/lib/services/sync-orders.ts`, `src/lib/queue/sync-processor.ts`, `src/lib/services/report-calculator.ts`.
  Risks: WB Statistics orders endpoint has a 60s rate limit; avoid broad historical backfills without confirmation.

- ID: TASK-MORNING-WB-METRICS
  Status: Done
  Priority: High
  Description: Добавить `Заказано руб.`, `ROMI %` и `Оборачиваемость, дн.` для подготовки утреннего WB-отчета.
  Next step: Перед заполнением Google Sheet перечитать лист `WB Galioni` и сопоставить живые заголовки.
  Related files: `src/lib/services/report-calculator.ts`, `src/lib/services/stocks.ts`, `src/lib/services/morning-report.ts`.
  Risks: Google Sheets read ранее уперся в 429; не заполнять таблицу без повторного readback.

- ID: TASK-DOCS-3-ZONES
  Status: Done
  Priority: High
  Description: Пересобрать Markdown-документацию под core/development/marketplace.
  Next step: Использовать новую структуру в следующих сессиях.
  Related files: `AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/core`, `docs/development`, `docs/marketplace`.
  Risks: Старые docs сохранены как legacy redirects.

- ID: TASK-DASHBOARD-ANALYTICS
  Status: Done
  Priority: High
  Description: Dashboard summary, problem center, recommendations and exports implemented at code level.
  Next step: Monitor performance on real data.
  Related files: `src/lib/services/dashboard-summary.ts`, `dashboard-export.ts`.
  Risks: May need aggregates later.

- ID: TASK-FBS-STAGE-1
  Status: Done (code), Pending rollout
  Priority: High
  Description: Implemented separate FBS workplace, seller stock/reservations, orders/supplies/stickers, serialized KIZ lifecycle, manual Chestny Znak XLSX flow, FBS finance enrichment and audited WB write gates. Order statuses/actions are Russian and the assortment selector is searchable and viewport-safe.
  Next step: Review the locally created withdrawal tasks (including the 9 repaired Nimba July 28 mappings) and define who confirms their Chestny Znak documents. Separately review and approve the production migration; keep all warehouse write gates off until opening balances are reconciled and a live write is explicitly approved. PDF import is optional for pre-packing code-pool accounting.
  Related files: `prisma/schema.prisma`, `prisma/migrations/20260730120000_fbs_operations`, `src/app/(dashboard)/fbs`, `src/lib/services/sync-fbs.ts`, `src/lib/services/fbs-operations.ts`, `src/lib/actions/fbs.ts`.
  Risks: Only codes actually scanned/attached in WB can be read back; codes with invalid format, order reuse, unavailable local state or GTIN mismatch are not silently reassigned and require operator review; local opening physical balances remain an explicit reconciliation task; PDF import is not implemented; no production migration or WB write was performed; True API is deferred.
2026-08-13 - Galioni historical CRPT files corrected: completed. Two corrected XLSX copies contain 11 and 173 active withdrawal rows; 11 canceled-order rows were removed, prices preserved, no duplicates across files.
