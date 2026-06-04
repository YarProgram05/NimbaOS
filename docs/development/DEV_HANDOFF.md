# Dev Handoff

## Current Development Objective

Поддерживать реализованный MVP NimbaOS, довести Phase 7/8 live WB verification и future production rollout без нарушения safety rules.

## Last Development Session Summary

2026-06-04: completed live verification of `TASK-WB-FINANCE-REPORTS-MIGRATION`. Manual `REPORTS_PERIOD` run `bd702e2a-c703-4aad-8faf-b76d15f29b65` for `WB Galioni (WB_2)` started at 2026-06-04 16:01:59 MSK using code loaded after the endpoint migration. It succeeded with 1 attempt, 1738 report rows read, 244 new rows inserted for 2026-06-02 - 2026-06-03, `maxReportDate: 2026-06-03`, and coverage advanced through 2026-06-03. Key financial fields were non-zero where expected and comparable to prior-period rows. Future report sync results now record `sourceApi` with exact domain/method/path.

2026-06-04: implemented `TASK-WB-FINANCE-REPORTS-MIGRATION` at code level. `fetchRealizationReportPage` now calls Finance API `POST /api/finance/v1/sales-reports/detailed`, requests only fields used by `realization_reports`, paginates with `rrdId`, and normalizes renamed camelCase/string-money fields into the existing internal row mapper. Finance API throttle is now 1 request/minute. `npm run type-check` passed; `npm run lint` passed with two pre-existing `<img>` warnings. Live WB smoke verification was not run because an account and short period were not explicitly selected.

2026-06-01: documented WB Finance API migration priority. At that time report sync used deprecated `GET /api/v5/supplier/reportDetailByPeriod`; the target was `POST /api/finance/v1/sales-reports/detailed` on `finance-api.wildberries.ru`. Main implementation risks identified were Finance token scope, POST JSON request body, `rrdId` pagination, 1 req/min rate limit, `204 No data` when report is not formed, and camelCase response fields that must map into the existing `realization_reports` schema.

2026-05-26: fixed `BUG-011` scheduled automation first-run skip. BullMQ cron schedulers no longer pass `startDate` equal to the first occurrence; cron pattern with `tz: Europe/Moscow` now picks the nearest future run. Temporary scheduler test confirmed same-day near-future scheduling works.

2026-05-26: fixed `BUG-010` for `Утренний отчет WB` runtime. The workflow is now DB-only: it checks report/ad coverage and stock snapshot freshness, then writes the sheet or fails fast; it no longer calls sync services or live WB advertising APIs, and sales-plan coverage is not required. Stale `AutomationRun` `fb1825f9-a865-491f-8720-6dc951dac1e0` was marked `FAILED` after BullMQ showed no active automation job.

2026-05-26: fixed `BUG-009` next-run display for schedules. `/automations` and `/sync` now format `nextRunAt` explicitly in `Europe/Moscow`, and backend schedule helpers calculate next run/lateness from Moscow calendar parts instead of manual `+3/-3` hour shifts. `13:28` MSK now resolves to `10:28Z` and displays as `13:28`. `npm run type-check` and `npm run lint` passed.

2026-05-26: fixed `BUG-008` in `Утренний отчет WB`. Default target date now uses the Moscow calendar date, `A43:C43` progress cells are filled, duplicate monthly `orders` sync is skipped after report sync refreshed the same range, and automation results include per-account/per-step timing diagnostics. `npm run type-check` passed.

2026-05-25: implemented `/automations` and the first automation workflow `Утренний отчет WB`. Added Prisma automation settings/account/run tables, a separate BullMQ automation queue/worker/scheduler, Google Sheets service-account runtime, daily month rollover logic for `A2:P32`, and UI for spreadsheet/account/sheet mapping plus run history.

2026-05-25: corrected `Заказано руб.` calculation to include cancelled WB orders. The metric now sums all `wb_orders.finishedPrice` rows for the selected period.

2026-05-25: fixed a stuck BullMQ `REPORTS_PERIOD` run after `Missing lock for job 316. moveToDelayed`. Long report syncs no longer force full orders backfill beyond 31 days; worker lock duration was increased. The stuck Galioni run was marked failed, and the prior successful run populated `Заказано руб.`.

2026-05-25: fixed `Заказано руб.` sync gap. `reports.period` now syncs `wb_orders` for the selected period, and orders sync upserts existing rows so WB changes to `finishedPrice` / `isCancel` are reflected locally.

2026-05-25: для подготовки `Утренний отчет WB` добавлены `Заказано руб.` и `ROMI %` в финансовый отчет, `Оборачиваемость, дн.` в остатки, account-wide orders/sales sync через `sales-plan.period`, и локальный сервис `morning-report`. Google Sheet не заполнялся.

## Current Safe Next Step

Для новой development-задачи открыть `AGENTS.md`, `docs/DOCS_INDEX.md`, затем этот файл и `docs/development/DEV_CURRENT_TASKS.md`. Первоочередная миграция Finance API завершена и live-verified.

## Active Development Risks

- Financial report sync uses live-verified Finance API `sales-reports/detailed`; continue monitoring `204 No data` and exact `report.sourceApi` in future job results.
- Very long `reports.period` ranges can still be slow because WB Statistics API is rate-limited; prefer shorter periods for forced orders backfill.
- `reports.period` now also calls WB orders sync; respect the Statistics API rate limit and avoid wide historical ranges without confirmation.

- Не запускать production migrations и full historical sync без подтверждения.
- WB advertising live API может возвращать 429/rate limits.
- Raw report/ad tables могут быть тяжелыми без account/date filters.
- `sales-plan.period` теперь может синхронизировать orders/sales без активного плана; не запускать широкий исторический диапазон без подтверждения.
- `Утренний отчет WB` requires `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` and the target Sheet shared with the service-account email before real writes can run.
- `Утренний отчет WB` is DB-only: it must not call WB API or sync services. Missing coverage/stale stocks should fail fast and be fixed via separate sync jobs.
- Automation worker/scheduler are separate from sync worker; production enablement requires Redis/PostgreSQL and explicit rollout setup.
- Старые flat `docs/*.md` теперь legacy redirects/archives.

## Read Next If Needed

- `docs/core/ARCHITECTURE.md`
- `docs/core/DATA_MODEL.md`
- `docs/core/WB_API_MAP.md`
- `docs/core/DATABASE_ACCESS_GUIDE.md`
- `docs/development/BUGS_AND_INCIDENTS.md`
- `DECISIONS.md`

## Do Not Do

- Не читать `.env`.
- Не менять WB prices/cards/ads/feedback answers без подтверждения.
- Не запускать migrations/sync worker/scheduler без причины и разрешения.
- Не читать все docs подряд.

## Last Updated

2026-06-04 - implemented and live-verified WB Finance API migration.
