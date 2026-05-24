# Troubleshooting

Типовые проверки для development-задач. Last updated: 2026-05-24.

## First Checks

- Прочитать `docs/development/BUGS_AND_INCIDENTS.md`.
- Проверить рабочее дерево: `git status --short`.
- Проверить, не является ли проблема stale data: `docs/core/DATA_FRESHNESS_POLICY.md`.
- Проверить safety before commands: `docs/core/SAFETY_RULES.md`.

## npm / Next.js

- Если dev server не стартует, проверить Node version, install state, порт 3000, `.next` only as build artifact.
- `npm run type-check` безопаснее build для первичной проверки.
- `npm run build` запускать, когда нужно проверить production compile.

## Prisma / Database

- Проверить `DATABASE_URL` имя переменной только через `.env.example`, не читать `.env`.
- `npx prisma validate` проверяет schema без применения.
- Не запускать `db:push`, `db:migrate`, `db:seed` без явного намерения.
- Prisma 7 требует adapter; использовать существующий `src/lib/db/index.ts`.

## WB API

- 401/403: проверить настройки кабинета через UI/DB metadata, не печатать токены.
- 429: зафиксировать rate limit, не крутить бесконечные retries в UI.
- Empty/null responses: проверить, ожидаемо ли это для домена и периода.
- Live debug scripts запускать только по явному запросу.

## Sync

- Проверить `SyncJobRun`: kind/status/error/attempts/result.
- Проверить `SyncDataCoverage` для периода.
- Проверить schedule settings if job is scheduled.
- Worker does not hot-reload; после code changes нужен restart.

## Empty Reports

- Проверить selected `wbAccountId`.
- Проверить период и coverage.
- Проверить `realization_reports`, `paid_storage`, products/references availability through existing services.
- Не вызывать WB API ad-hoc, пока не ясно, что данных нет в базе.

## Slow Queries

- Ограничить account and date.
- Использовать report/dashboard/stock/plan services.
- Избегать raw scans.
- Если slow path повторяется, добавить вопрос об aggregate/index в `docs/core/OPEN_QUESTIONS.md`.

