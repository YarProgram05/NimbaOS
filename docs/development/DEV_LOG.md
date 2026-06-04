# Development Log

## 2026-06-04 - WB Finance reports migration live-verified

### Summary
Audited the repository for old executable links to `reportDetailByPeriod`, verified the user's latest financial report sync, checked persisted field quality, and added exact source API metadata to future report sync results.

### Verification evidence
Manual `REPORTS_PERIOD` run `bd702e2a-c703-4aad-8faf-b76d15f29b65` for `WB Galioni (WB_2)` started at 2026-06-04 16:01:59 MSK after the migrated source files and dev runtime were loaded. It succeeded on the first attempt, read 1738 report rows, inserted 244 new rows dated 2026-06-02 - 2026-06-03, reached `maxReportDate: 2026-06-03`, and advanced report coverage through 2026-06-03.

The 244 new rows contained expected non-zero values for transfer amount, SPP, logistics, acquiring and commission. No silent zeroing caused by Finance API field renames was found. No executable source reference to the deprecated endpoint remains.

DB-only `calculateReport` for 2026-06-02 - 2026-06-03 completed successfully with covered status, 52 product rows, and non-zero sales, transfer, commission, logistics, storage and acquiring totals.

### Checks run
`npm run type-check`; `npm run lint`; `npx prisma validate`; `git diff --check`; repository/runtime-cache search for the deprecated endpoint; mock Finance POST/pagination/field-mapping check; DB-only report calculation.

### Result
Migration is considered implemented and live-verified. Future `ReportSyncResult` values include `sourceApi.domain`, `sourceApi.method`, and `sourceApi.path`.

## 2026-06-04 - WB Finance reports migration implemented

### Summary
Replaced deprecated financial report request `GET /api/v5/supplier/reportDetailByPeriod` with `POST /api/finance/v1/sales-reports/detailed`. The new Finance API response is normalized into the existing internal realization row format so the Prisma schema and report calculations remain unchanged.

### Files changed
`src/lib/wb-api/reports.ts`, `src/lib/wb-api/constants.ts`, `src/lib/services/sync-reports.ts`, `src/types/reports.ts`, and relevant core/development documentation.

### Commands run
`npm run type-check`; `npm run lint`.

### Result
`npm run type-check` passed. `npm run lint` passed with two pre-existing `<img>` warnings. The new request uses POST JSON body, `rrdId` pagination, selected fields, explicit renamed-field mapping, and a 1 request/minute Finance API throttle. Live smoke verification was not run because an account and short period were not explicitly selected.

## 2026-06-01 - WB Finance reports migration documented

### Summary
Compared the deprecated WB financial report endpoint used by NimbaOS at that time with the new Finance API endpoint. The retired implementation called `GET /api/v5/supplier/reportDetailByPeriod` on the Statistics API and mapped snake_case rows. The new target was `POST /api/finance/v1/sales-reports/detailed` on the Finance API, using a JSON body, `rrdId` pagination and camelCase response fields.

### Files changed
Documentation only: `docs/core/WB_API_MAP.md`, `docs/core/DATA_FRESHNESS_POLICY.md`, `docs/core/DATABASE_ACCESS_GUIDE.md`, `docs/core/PROJECT_STATE.md`, `docs/development/DEV_CURRENT_TASKS.md`, `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_LOG.md`.

### Result
Added `TASK-WB-FINANCE-REPORTS-MIGRATION` as the first high-priority development task. No code was changed.

## 2026-05-26 - Scheduled automation first-run fix

### Summary
Fixed `BUG-011`: saving `Утренний отчет WB` shortly before the configured time could skip the same-day run and schedule only the next day. The cause was passing `startDate` equal to the first intended cron occurrence into BullMQ `upsertJobScheduler`.

### Files changed
`src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`, docs.

### Commands run
`npm run type-check`; `npm run lint`; inspected BullMQ automation schedulers/jobs; created and removed a temporary BullMQ scheduler test.

### Result
Automation and sync cron schedulers no longer pass `startDate`; BullMQ now uses the cron pattern plus `tz: Europe/Moscow` to choose the nearest future occurrence. A temporary test scheduler for `14:08` MSK created a same-day delayed job with about 72 seconds delay.

## 2026-05-26 - Morning WB workflow DB-only hardening

### Summary
Fixed `BUG-010`: `Утренний отчет WB` could run slowly because it performed freshness sync inside the workflow and daily report calculation could call live WB advertising APIs. The workflow is now DB-only: it checks local report/ad coverage and stock snapshot freshness, then either writes from DB or fails fast with a clear sync-needed message.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, `src/lib/services/morning-report.ts`, docs.

### Commands run
`npm run type-check`; `npm run lint`; inspected latest `AutomationRun` rows and BullMQ automation queue without printing secrets.

### Result
Removed workflow calls to report/storage/orders/sales-plan/advertising/stocks sync services. Removed sales-plan coverage from the workflow because the Google Sheet does not use sales plans. Morning report calculation now uses persisted ad stats only. The stale scheduled run `fb1825f9-a865-491f-8720-6dc951dac1e0` was marked `FAILED` after BullMQ showed its job had already completed/skipped and no active automation jobs remained.

## 2026-05-26 - Automation next-run Moscow time display

### Summary
Fixed `BUG-009`: `/automations` displayed `13:28` MSK as `10:28`. The first pass fixed client formatting, then a deeper backend issue was found: `getNextRunAt` manually shifted `+3/-3` hours and double-shifted on a Moscow-time host. Schedule helpers now calculate next run/lateness from Moscow calendar parts without depending on host timezone.

### Files changed
`src/lib/time/moscow.ts`, `src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`, `src/lib/queue/automation-processor.ts`, `src/lib/queue/sync-processor.ts`, `src/app/(dashboard)/automations/automations-client.tsx`, `src/app/(dashboard)/sync/sync-client.tsx`, docs.

### Commands run
`npm run type-check`; `npm run lint`; local `getNextMoscowRunAt('13:28', 2026-05-26T09:00:00.000Z)` check.

### Result
Next-run backend value for `13:28` MSK is `2026-05-26T10:28:00.000Z`, which formats as `26 мая, 13:28` in Moscow time. Lint passed with only pre-existing `<img>` warnings in unrelated files.

## 2026-05-26 - Morning WB workflow bug fixes

### Summary
Fixed `BUG-008` for `Утренний отчет WB`: the default target date now uses the Moscow calendar date before subtracting one day, so a morning run on 2026-05-25 targets 2026-05-24 instead of 2026-05-23. The workflow also writes the progress summary cells `A43:C43`.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, development/core docs.

### Commands run
`npm run type-check`.

### Result
The workflow remains DB-first: report/sales/ad coverage is checked before any WB sync service is called, stock sync runs only when the latest snapshot is stale, and duplicate `orders` sync for the same monthly range is skipped. `AutomationRun.result` now includes per-account duration and per-step timings to diagnose future Nimba/Galioni runtime differences.

## 2026-05-25 - Morning WB first live run bug notes

### Summary
Recorded first live `Утренний отчет WB` issues without fixing them: report filled through 2026-05-23 instead of 2026-05-24 on 2026-05-25, cells `A43:C43` for `Отработано / Всего дней / Осталось` were not filled, and Nimba took about 988 seconds after Galioni completed in about 142 seconds.

### Files changed
Documentation only for these bug notes: `docs/development/BUGS_AND_INCIDENTS.md`, `docs/development/DEV_CURRENT_TASKS.md`.

### Result
Added open follow-up `TASK-MORNING-WB-LIVE-RUN-FIXES` and `BUG-008`. No workflow behavior was changed for these known bugs.

## 2026-05-25 - Automation run error diagnostics

### Summary
Improved diagnostics for `Утренний отчет WB` automation failures. The workflow now checks Google Sheet access before processing accounts, and run history surfaces saved per-account errors instead of only showing the failed-account count.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, `src/lib/automations/runs.ts`, `src/lib/queue/automation-processor.ts`.

### Commands run
`npm run type-check`; checked that `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is not configured without printing any secret values.

### Result
The latest failed manual runs were caused by missing `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`. Next real run requires adding service-account credentials and sharing the target Google Sheet with that service-account email.

## 2026-05-25 - Automations and morning WB report workflow

### Summary
Implemented the new `/automations` section and the first workflow: daily filling of Google Sheet `Утренний отчет WB` at 10:00 Moscow time. The workflow supports multiple WB accounts with per-account sheet tabs, history, manual runs, and month rollover for rows `A2:P32`.

### Files changed
Prisma schema/migration, automation queue/worker/scheduler, Google Sheets runtime, morning report workflow service, `/automations` UI/actions, sidebar, package scripts/dependency, docs.

### Commands run
`npm install googleapis`; `npx prisma generate`; `npm run type-check`; `npm run build`; local dev browser smoke with Playwright CLI.

### Result
The workflow uses service-account Google Sheets access, preserves formulas in `D/K/P`, preserves totals/plans below row 32, writes only daily value columns, and uses existing read-only sync services for missing current-month freshness.

## 2026-05-25 - Ordered rub includes cancelled orders

### Summary
Corrected business definition of `Заказано руб.`: it must include all WB orders, including cancelled orders, because it represents the original ordered ruble volume, not fulfilled/non-cancelled orders.

### Files changed
`src/lib/services/report-calculator.ts`, report column tooltip, docs.

### Verification
For Galioni `2026-01-01` - `2026-05-24`, all orders sum is 2783846.47 vs report sale 1571692.94 (`1.77x`, buyout 58.66%). The previous non-cancelled calculation was only 1846684.89 (`1.17x`).

## 2026-05-25 - BullMQ lock fix for long report sync

### Summary
Investigated stuck `REPORTS_PERIOD` job `316` for Galioni (`2026-01-01` - `2026-05-24`). BullMQ lost the active job lock while trying to move the job to delayed/retry state, leaving `SyncJobRun` stuck as `RUNNING`.

### Files changed
`src/lib/queue/index.ts`, `src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`; checked BullMQ job state and `SyncJobRun`; verified report summary after the successful prior job.

### Result
Worker lock duration is now longer, report sync only forces full orders backfill for periods up to 31 days, stuck run `316` was marked `FAILED`, and worker was restarted. The previous successful run `315` populated orders; after definition correction, report summary for `2026-01-01` - `2026-05-24` should show `Заказано руб.` from all order rows, including cancellations.

## 2026-05-25 - Orders sync repair for ordered rub

### Summary
Fixed `Заказано руб.` freshness: report sync now also syncs WB orders for the selected period, and orders sync can force a full bounded backfill instead of starting from the newest local `lastChangeDate`.

### Files changed
`src/lib/services/sync-orders.ts`, `src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`.

### Result
`wb_orders` rows are now upserted by `(wbAccountId, srid)`, so changed WB order fields such as `finishedPrice` and `isCancel` update existing local rows. Manual/scheduled `reports.period` sync includes orders, so the financial report can refresh `Заказано руб.` with the same button.

Новые записи добавлять сверху. В начале сессии не читать целиком.

## 2026-05-25 — Morning report metrics prep

### Summary
Добавлены недостающие показатели для будущего Google Sheet `Утренний отчет WB`: `Заказано руб.`, `ROMI %` и `Оборачиваемость, дн.`. Таблица Google не заполнялась.

### Files changed
Расчеты финансового отчета, XLSX export, `/reports`, `/stocks`, stock services, sales-plan sync coverage, morning report service, docs.

### Commands run
`npm run type-check`; локальная проверка Galioni за 2026-04-22 — 2026-05-06.

### Result
`Заказано руб.` initially matched `wb_orders.finishedPrice` without cancellations, but this was later corrected: the metric must include cancelled orders too. `ROMI %` считается по итоговым `ОП` и `Реклама все`. Остатки получили оборачиваемость по 30 завершенным дням продаж.

### Issues
Google Sheets read earlier hit 429, поэтому live mapping листа `WB Galioni` нужно повторить перед фактическим заполнением.

## 2026-05-24 — Documentation 3-zone rebuild

### Summary
Пересобрана Markdown-документация под `docs/core`, `docs/development`, `docs/marketplace`. Созданы канонические root `AGENTS.md`, `SPECIFICATION.md`, `DECISIONS.md`; старая документация сохранена как legacy/redirect или архив.

### Files changed
Только `.md` файлы документации.

### Commands run
Read-only inspection: file listing, Markdown headings search, Prisma model/index search, export/function search, migration index search. Также создана структура папок docs.

### Result
Будущая сессия стартует с `AGENTS.md` и `docs/DOCS_INDEX.md`, затем выбирает development или marketplace документы по задаче.

### Issues
Часть старых docs в терминале отображалась с битой кодировкой, но была использована как источник смысла и сохранена.

### Follow-up
После подтверждения можно удалить или оставить старые flat docs; пока они сохранены.
