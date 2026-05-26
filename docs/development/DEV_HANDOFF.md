# Dev Handoff

## Current Development Objective

Поддерживать реализованный MVP NimbaOS, довести Phase 7/8 live WB verification и future production rollout без нарушения safety rules.

## Last Development Session Summary

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

Для новой development-задачи открыть `AGENTS.md`, `docs/DOCS_INDEX.md`, затем этот файл и `docs/development/DEV_CURRENT_TASKS.md`.

## Active Development Risks

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

2026-05-26 - `BUG-011` fixed: scheduled automation no longer skips first same-day run after save.
