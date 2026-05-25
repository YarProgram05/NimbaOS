# Commands

Команды проекта с точки зрения безопасности. Last updated: 2026-05-25.

## Safe Inspection

- `git status --short` — проверить рабочее дерево.
- `git diff -- <path>` — посмотреть изменения.
- `rg --files -g '!node_modules/**' -g '!.next/**'` — инвентаризация файлов.
- `rg -n "<pattern>" <path>` — поиск по исходникам.
- `npx prisma validate` — проверить Prisma schema без применения к БД.
- `npm run type-check` — TypeScript check без запуска приложения.

## Local Development

- `npm run dev` — Next.js dev server.
- `npm run build` — production build; может быть долгим, не нужен для documentation-only.
- `npm run start` — запуск собранного приложения.
- `npm run lint` — Next lint.
- `npm run docker:dev` — поднять локальные PostgreSQL и Redis.
- `npm run docker:dev:down` — остановить локальные dev services.

## Database

- `npm run db:push` — применить Prisma schema к dev DB; требует явной необходимости.
- `npm run db:migrate` — dev migration; не запускать в documentation-only.
- `npm run db:seed` — seed admin; осторожно.
- `npm run db:studio` — Prisma Studio; не использовать для destructive edits.
- `npx prisma generate` — обновить Prisma Client; запускать только если нужно.

## Sync And Workers

- `npm run worker:sync` — BullMQ worker для read-only WB sync jobs; требует Redis/PostgreSQL.
- Sync worker uses a long lock for WB API jobs; after changing queue processor code, restart `npm run worker:sync` so lock settings and backfill limits apply.
- `npm run sync:schedule` — применить default daily `Europe/Moscow` schedules.
- `npm run worker:automation` — BullMQ worker для product/workflow automations; требует Redis/PostgreSQL and configured env for external integrations.
- `npm run automation:schedule` — применить automation schedules such as `Утренний отчет WB`.
- `/sync` — UI screen для `SyncJobRun`, schedules и safe manual current-period jobs.
- `/automations` — UI screen для workflow settings, account-to-sheet mapping and automation run history.

Не запускать sync-команды для полной истории без подтверждения пользователя.

## Debug Scripts

- `npx tsx scripts/debug-report.ts` — DB-only сверка financial report formulas.
- `npx tsx scripts/debug-advertising.ts` — live WB advert API reads; запускать только по явному запросу.

## Production

- `docker compose --env-file .env.production -f docker-compose.prod.yml config` — проверка compose config.
- `docker compose --env-file .env.production -f docker-compose.prod.yml build app worker` — production image build.
- Production `migrate`, `up`, `scheduler` команды требуют явного rollout-подтверждения.

## Forbidden Without Explicit Approval

- Чтение или вывод `.env`, токенов, decrypted keys.
- Production migrations.
- Destructive DB/file commands.
- Full historical resync.
- WB price/card/advertising/budget/status changes.
- Историческая перезапись данных.

## Report Access Instead Of Manual Queries

- Financial report: `src/lib/actions/reports.ts`, `src/lib/services/report-calculator.ts`.
- Dashboard: `src/lib/actions/dashboard.ts`, `src/lib/services/dashboard-summary.ts`.
- Sales plan: `src/lib/actions/sales-plan.ts`, `src/lib/services/plan-calculator.ts`.
- Stocks: `src/lib/services/stocks.ts`, `src/lib/actions/stocks.ts`.
- Advertising: `src/lib/actions/advertising.ts`.
