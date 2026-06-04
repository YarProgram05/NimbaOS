# Dev Current Tasks

## Active

No active development task is currently assigned. Pick from `Next` after reading `DEV_HANDOFF.md`.

## Next

- ID: TASK-P7-P8-LIVE-VERIFY
  Status: Pending
  Priority: High
  Description: Провести safe smoke verification read-only WB sync jobs после rate-limit окон.
  Next step: Согласовать кабинеты, период и допустимые live API calls.
  Related files: `src/lib/services/sync-*`, `src/lib/queue/sync-processor.ts`, `/sync`.
  Risks: WB 429, long retries, incomplete ad stats.

- ID: TASK-PRODUCTION-RUNBOOK
  Status: Pending
  Priority: Medium
  Description: Подготовить/проверить production rollout runbook.
  Next step: Уточнить VPS target, backup policy, migration window.
  Related files: `docker-compose.prod.yml`, `Dockerfile`, `deploy/nginx/nimbaos.conf`.
  Risks: Production migrations require explicit confirmation.

## Blocked

- ID: TASK-PROD-DEPLOY
  Status: Blocked
  Priority: Medium
  Description: Реальный production deploy.
  Next step: Получить явное подтверждение и production environment details.
  Related files: production Docker/VPS artifacts.
  Risks: Secrets, migrations, data safety.

## Done Recently

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
