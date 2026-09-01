# Commands

Команды проекта с точки зрения безопасности. Last updated: 2026-08-24.

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
- Не запускать `npm run build` одновременно с `npm run dev` в одном checkout: оба используют `.next`, и работающий dev server может начать отдавать 404 для CSS/JS. Остановить dev перед build либо перезапустить его сразу после build.
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
- Manual actions in `/sync` and `/automations` enqueue immediately; they do not wait for the configured schedule. The corresponding worker must be running, and a duplicate active automation of the same kind reuses the existing run instead of starting a second copy.
- `SCHEDULED_START_GRACE_MINUTES=1080` allows daily jobs to wait behind long-running account jobs. The parser caps this value at 1439 minutes; keep sync concurrency at 1 unless WB rate limits are revalidated.

Не запускать sync-команды для полной истории без подтверждения пользователя.

## Debug Scripts

- `npm run audit:fbs-sheet-mappings -- YYYY-MM-DD` — read-only comparison of local FBS orders/assortment, approved aliases and current Google Sheet product identities through the target Moscow date; exits non-zero on mismatch or unresolved mapping.
- `npx tsx scripts/debug-report.ts` — DB-only сверка financial report formulas.
- `npx tsx scripts/debug-advertising.ts` — live WB advert API reads; запускать только по явному запросу.

## Production

### Recommended GitHub release

1. Develop and test locally, then commit and push the intended change to `main`.
2. GitHub automatically runs `.github/workflows/ci.yml`; do not deploy a failed commit.
3. In GitHub open `Actions` -> `Deploy production` -> `Run workflow`, enable `I confirm this production deployment`, and start the workflow.
4. The workflow verifies the commit again, then the mini-PC runner builds a versioned image, validates a PostgreSQL backup, deploys migrations/app/workers/schedules, and checks health.
5. Verify the green workflow result and `https://win-sk69nvld6f0.tailc11887.ts.net/api/health` from a trusted Tailscale device.

- Production is deliberately not updated by an ordinary push alone. The manual confirmation is the protection against releasing unfinished code to the live database.
- The runner task is `NimbaOS GitHub Actions Runner`. Docker Desktop and the logged-in `n8929` Windows session must be active.
- Successful deployment state is recorded in `C:\ProgramData\NimbaOS\deployments\last-successful.json`; validated backups are written under `C:\NimbaOS\backups`.
- Application rollback never automatically restores PostgreSQL. A database restore is a separate destructive recovery procedure requiring explicit authorization.

### Manual fallback

- `docker compose --env-file .env.production -f docker-compose.prod.yml config` — проверка compose config.
- `docker compose --env-file .env.production -f docker-compose.prod.yml build app worker` — production image build.
- On the Windows mini-PC, Docker Desktop builds started from a non-interactive SSH logon may fail because Windows Credential Manager has no interactive logon session. Run the normal build from the logged-in AnyDesk/console session; this is a Docker Desktop credential-helper limitation, not an application or `.env.production` failure.
- `docker compose --env-file .env.production -f docker-compose.prod.yml --profile migrate run --rm migrate` — применить production Prisma migrations; только после резервной копии и явного подтверждения.
- `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate app worker automation-worker` — переключить app и оба worker-контейнера на уже собранные образы, не пересоздавая PostgreSQL/Redis.
- `docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps app npx tsx scripts/schedule-sync.ts` — заново зарегистрировать production BullMQ sync schedules из PostgreSQL в Redis; обязательно после восстановления или пересоздания Redis data volume, только с явным подтверждением.
- `docker compose --env-file .env.production -f docker-compose.prod.yml --profile scheduler run --rm automation-scheduler` — заново зарегистрировать production automation schedules; требуется после восстановления или пересоздания Redis data volume.
- `Invoke-WebRequest http://127.0.0.1:3000/api/health -UseBasicParsing` — локальная health-проверка на mini-PC.
- `ssh -i "$env:USERPROFILE\.ssh\nimba_minipc_codex" n8929@100.107.244.75` — remote shell через Tailscale с доверенного development-ноутбука.
- `Start-ScheduledTask -TaskName 'NimbaOS Temporary Tunnel'` — запустить временный private browser tunnel на laptop; адрес `http://127.0.0.1:13000`.
- `Stop-ScheduledTask -TaskName 'NimbaOS Temporary Tunnel'` — временно остановить browser tunnel.
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
