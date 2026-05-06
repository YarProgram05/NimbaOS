# Commands

Команды описаны с точки зрения безопасности для локальной разработки. Не выводить секреты и не читать `.env`.

## Safe inspection

- `git status --short` — посмотреть рабочее дерево.
- `git diff -- <path>` — посмотреть изменения.
- `Get-ChildItem -Recurse -File -Filter *.md` — инвентаризация docs.
- `npm run type-check` — TypeScript check без сборки.
- `npx prisma validate` — проверить Prisma schema без применения к БД.

## Local development

- `npm run dev` — локальный Next.js dev server. Если зависает на `Starting...`, см. `docs/BUGS_AND_INCIDENTS.md`.
- `npm run docker:dev` — поднять local PostgreSQL + Redis. Требует понимания текущего окружения.
- `npm run docker:dev:down` — остановить local Docker dev services.

## Production VPS artifacts

- `docker compose --env-file .env.production -f docker-compose.prod.yml config` — проверить production compose без запуска контейнеров.
- `docker compose --env-file .env.production -f docker-compose.prod.yml build app worker` — собрать production image локально/на VPS без запуска WB sync.
- `docker compose --env-file .env.production -f docker-compose.prod.yml --profile migrate run --rm migrate` — применить Prisma migrations через `migrate deploy`; запускать только при явном production rollout.
- `docker compose --env-file .env.production -f docker-compose.prod.yml up -d app worker` — поднять приложение и worker после миграций.
- `docker compose --env-file .env.production -f docker-compose.prod.yml --profile scheduler run --rm scheduler` — вручную применить BullMQ расписание для активных кабинетов.
- `GET /api/health` — public healthcheck, не раскрывает секреты.

## Database commands

- `npx prisma generate` — обновить Prisma Client. Не запускать без необходимости; может менять generated files under dependencies/cache.
- `npm run db:push` / `npx prisma db push` — применить schema к dev DB. Требует явного намерения, не запускать в documentation-only задачах.
- `npm run db:migrate` — dev migration. Требует подтверждения и понимания schema diff.
- `npm run db:studio` — открыть Prisma Studio; не использовать для destructive edits без подтверждения.
- `npm run db:seed` — создать/обновить seed admin; caution.

## Debug scripts

- `npx tsx scripts/debug-report.ts` — читает БД для сверки report formulas. Не читает WB API.
- `npx tsx scripts/debug-advertising.ts` — делает live reads WB advert API. Запускать только при явном запросе на live verification.

## WB sync/actions

Любые команды или UI-действия, которые запускают WB sync или меняют WB данные, требуют явного пользовательского запроса.

Examples requiring confirmation:
- full historical realization sync;
- paid storage historical sync;
- products/cards sync on large scope;
- orders/sales/funnel historical sync;
- advertising campaign sync if WB rate limits matter;
- price updates;
- card updates;
- advertising bid/budget/status changes.

## Forbidden without explicit approval

- Production migrations.
- Destructive DB commands.
- Commands that print `.env`, tokens or decrypted API keys.
- Full historical re-syncs.
- WB price/card/advert changes.
- `git reset --hard`, forced checkout/revert of user changes.

## Phase 8 background sync

- `npm run worker:sync` — starts the Bull MQ worker for read-only WB sync jobs. Requires Redis, PostgreSQL and the Phase 8 DB schema to be applied.
- `npm run sync:schedule` — upserts the default daily `Europe/Moscow` BullMQ Job Schedulers for active WB accounts.
- `/sync` — dashboard screen for recent `SyncJobRun` records and safe manual current-period job enqueue.
- Do not use these commands to run historical/full sync without explicit confirmation.
