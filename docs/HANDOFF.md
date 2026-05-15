# Handoff

## Current objective

NimbaOS находится после dashboard analytics Phase 8 exports на уровне кода. Поддерживать документацию как систему памяти и дальше двигаться к optional PDF/verification, Phase 9 UI polish, или live WB verification по явному запросу.

## Latest session summary

Dashboard analytics Phase 8 on 2026-05-15:
- implemented dashboard management Excel exports from the existing `DashboardSummary`;
- added workbooks for dashboard summary, product risks, stock risks, and review/question workload;
- included account, period, comparison period, sync freshness, and generation context in every workbook;
- added the dashboard server export action and an Excel menu on the home dashboard;
- verified `npm run type-check`.

No live WB sync, DB migration, production command, or PDF generation was run. Optional PDF executive report remains deferred.

Dashboard analytics Phase 3 on 2026-05-14:
- implemented WB warehouse inventory v1 using the current seller analytics stock endpoint, not deprecated statistics stocks;
- added Prisma models for warehouses, stock snapshots and stock items, plus `ProductSize.chrtId`;
- added `stocks.current` / `STOCKS_CURRENT` sync kind, worker handling, `/sync` manual button and default schedule;
- added `/stocks` with KPI cards, filters, latest snapshot timestamp, risk badges and empty state sync action;
- connected stock summary to the home dashboard, data freshness and problem center issues for missing stock data, low stock and out of stock;
- changed sales-plan add-from-stock to use only products with positive quantity in the latest stock snapshot;
- verified `npx prisma validate`, `npx prisma generate`, `npm run type-check`, and `npm run build`.

No live WB stock sync, DB migration apply, DB push or production migration was run.

Financial reports follow-up on 2026-05-14:
- fixed `/reports` layout so the page header is compact, controls stay visible, page-level scroll is removed, table headers and totals are sticky, and only the table scrolls internally;
- added persisted per-user report column order via `UserPreference`;
- fixed report period switching so it refreshes the displayed report quickly instead of waiting on the heavy live fullstats path;
- corrected advertising allocation: `Реклама (все)` uses WB ad update/spend history totals, and `Реклама (баланс)` is distributed from the same allocation map;
- verified `WB Galioni (WB_2)` for `16.03.2026-12.05.2026`: balance `14 779`, all `15 997`, with article rows matching the reference service;
- adjusted scheduled sync handling so scheduled jobs are skipped if they start outside the configured time window.

Post-Phase-9 UI and sync hardening on 2026-05-08:
- redesigned the dashboard shell/home/cards/reports/sales-plan surfaces into a restrained old-money business style;
- restored the desktop hamburger/sidebar toggle and made the NimbaOS mark link to home with the selected `?account`;
- made home dashboard stats/account cards read the selected account from URL;
- confirmed the worker was running, diagnosed advertising sync failures, and hardened ad stats/clusters for null WB fullstats and cluster periods longer than 30 days;
- restarted `npm run worker:sync` locally after the worker fixes.

Phase 9 code-level implementation on 2026-05-06:
- added VPS production artifacts: `Dockerfile`, `docker-compose.prod.yml`, `.env.production.example`, `deploy/nginx/nimbaos.conf`;
- enabled Next.js standalone output and added public `/api/health`;
- added Prisma baseline migration under `prisma/migrations` for future `prisma migrate deploy`;
- refactored XLSX export creation into `src/lib/xlsx/export.ts` and polished report/plan workbook metadata;
- improved responsive behavior for dashboard shell, action bars and wide tables;
- updated project docs and closed the production target open question as VPS Docker Compose.

No live WB sync, WB-changing action, DB push or production migration was run.

Known bug pass on 2026-05-05:
- fixed the `adCampaignNmStat` numeric overflow at code level by sanitizing advertising metrics before Prisma upserts;
- added deletion for non-running `/sync` queue/history items; deletion removes the BullMQ job when it is still present in Redis and then deletes the `SyncJobRun` row;
- verified `npm run type-check`, `npx prisma validate`, and `npm run build`;
- checked `next dev` on port 3010: it reached `Ready`, `/login` returned HTTP 200, and the temporary server was stopped;
- did not run live WB sync, production commands, DB pushes, or migrations.

Product price follow-up on 2026-05-06:
- investigated blank prices on `/cards` for `WB Galioni (WB_2)`;
- confirmed DB has 58 of 59 products without `product_sizes.price`;
- confirmed WB `prices` domain currently returns rate limit with retry around 34 minutes;
- fixed product sync at code level to preserve existing prices during card-size refresh, fallback to single-article price fetches when batch price response omits items, and requeue on WB price rate limits instead of treating them as partial internal errors.

## Last session summary

Phase 8 реализована поверх существующего dirty worktree без откатов Phase 7/docs изменений:
- добавлена Prisma-модель `SyncJobRun` и enum-статусы/типы фоновых sync jobs;
- `src/lib/queue` переведён на ленивую Bull MQ очередь `sync`, типы payloads, enqueue helpers и worker processor;
- добавлены `scripts/sync-worker.ts` и `scripts/schedule-sync.ts`, npm scripts `worker:sync` и `sync:schedule`;
- существующие read-only sync-кнопки карточек, отчётов, плана продаж и рекламы теперь ставят фоновые jobs;
- добавлен мини-экран `/sync` для статусов и безопасного ручного запуска;
- WB-changing actions (цены, ставки, бюджеты, статусы рекламы) не автоматизированы.

Проверки выполнены: `npx prisma validate`, `npx prisma generate`, `npm run type-check`, import smoke для worker/scheduler. Live WB sync не запускался.

## Current safe next step

Если нужно продолжать Phase 8 live-проверку: убедиться, что PostgreSQL + Redis + `npm run worker:sync` подняты, затем поставить один read-only job через `/sync` и не запускать дубли до завершения/ошибки.

Если live-проверка не нужна: дорабатывать desktop home empty states по макету/концепту пользователя.

## Active risks

- Новая таблица `sync_job_runs` есть в Prisma schema, но DB schema не применялась в этой сессии.
- Historical/full sync не запускать автоматически и не запускать без явного подтверждения.
- WB advert API может возвращать долгий `429`; фоновые jobs должны фиксировать ошибку и retry, а UI не должен ждать десятки минут.
- Старые failed rows в `/sync` являются историей; после code-level fix проверять новые задачи, а не ожидать изменения старых статусов.
- Не читать и не выводить `.env`, WB tokens или decrypted API keys.
- Dev server ранее зависал на `Starting...`; при повторе см. `docs/BUGS_AND_INCIDENTS.md`.

## Read next if needed

- Текущие задачи: `docs/CURRENT_TASKS.md`.
- Данные и sync: `docs/DATA_FRESHNESS_POLICY.md`.
- Команды: `docs/COMMANDS.md`.
- БД: `docs/DATABASE_ACCESS_GUIDE.md`.
- Safety: `docs/SAFETY_RULES.md`.

## Do not do

- Не читать `.env`.
- Не запускать live WB sync, production/migration или destructive DB commands без явного запроса.
- Не автоматизировать WB-changing actions.

## Last updated

2026-05-15 - Dashboard analytics Phase 8 Excel exports.

2026-05-14 - Financial reports accuracy, sticky report table, and user column preferences.

2026-05-08 — Post-Phase-9 UI refresh and advertising worker hardening.
