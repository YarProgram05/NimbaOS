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
