# Handoff

## Current objective

NimbaOS находится после Phase 8 background sync на уровне кода. Поддерживать документацию как систему памяти и дальше двигаться к Phase 9 polish или к live verification по явному запросу.

## Latest session summary

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

2026-05-08 — Post-Phase-9 UI refresh and advertising worker hardening.
