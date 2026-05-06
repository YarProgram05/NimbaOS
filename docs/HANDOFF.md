# Handoff

## Current objective

NimbaOS находится после Phase 8 background sync на уровне кода. Поддерживать документацию как систему памяти и дальше двигаться к Phase 9 polish или к live verification по явному запросу.

## Latest session summary

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

Если нужно продолжать Phase 8 live-проверку: сначала поднять PostgreSQL + Redis, затем применить schema к dev DB (`npm run db:push` или migration) только после явного подтверждения, запустить `npm run worker:sync`, затем поставить один read-only job через `/sync`.

Если live-проверка не нужна: перейти к Phase 9 polish.

## Active risks

- Новая таблица `sync_job_runs` есть в Prisma schema, но DB schema не применялась в этой сессии.
- Historical/full sync не запускать автоматически и не запускать без явного подтверждения.
- WB advert API может возвращать долгий `429`; фоновые jobs должны фиксировать ошибку и retry, а UI не должен ждать десятки минут.
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

2026-05-05 — Phase 8 background sync implemented at code level.
