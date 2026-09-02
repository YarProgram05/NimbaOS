# Project Map

Карта проекта NimbaOS для быстрого поиска нужного слоя. Last updated: 2026-09-02.

## Root

- `package.json` — npm scripts и зависимости.
- `README.md` — короткая human-facing точка входа.
- `AGENTS.md` — короткий старт для Codex-агентов.
- `SPECIFICATION.md` — стабильная продуктовая спецификация.
- `DECISIONS.md` — канонический журнал решений.
- `docs/archive` — historical/superseded memory; не читать как current truth.
- `.env.example` — пример переменных окружения без реальных секретов.
- `docker-compose.dev.yml` — локальные PostgreSQL и Redis.
- `docker-compose.prod.yml`, `Dockerfile`, `deploy/nginx/nimbaos.conf` — production/VPS артефакты, не запускать без подтверждения.

## App

- `src/app` — Next.js App Router.
- `src/app/(auth)` — login/register.
- `src/app/(dashboard)` — закрытая рабочая зона: dashboard, cards, reports, sales-plan, advertising, stocks, reviews, references, sync, settings.
- `src/app/api/health/route.ts` — public healthcheck.
- `src/middleware.ts` — защита маршрутов.

## Shared UI

- `src/components/layout` — dashboard shell, sidebar, header, account selector.
- `src/components/ui` — shadcn/base UI primitives.
- `src/components/shared/data-table.tsx` — общая таблица.

## Server Side Layers

- `src/lib/actions` — Server Actions для UI-facing чтения и мутаций.
- `src/lib/services` — бизнес-логика, расчет отчетов, sync-сервисы, dashboard summary.
- `src/lib/wb-api` — клиент и методы WB API.
- `src/lib/queue` — BullMQ queue/worker processor.
- `src/lib/sync` — coverage, schedules, job run helpers.
- `src/lib/automations` — workflow registry, schedules and Google Sheet contracts.
- `src/lib/fbs` — FBS state-machine and KIZ helpers.
- `src/lib/reports` — агрегация и preferences отчетов.
- `src/lib/db/index.ts` — Prisma Client через adapter.
- `src/lib/encryption` — шифрование WB API keys.

## Data

- `prisma/schema.prisma` — модели, связи и индексы.
- `prisma/migrations` — фактическая история схемы.
- `prisma/seed.ts` — seed admin, запускать только осознанно.

## Scripts

- `scripts/sync-worker.ts` — запуск BullMQ worker.
- `scripts/schedule-sync.ts` — применение расписаний.
- `scripts/debug-report.ts` — DB-only сверка отчетных формул.
- `scripts/debug-advertising.ts` — live WB advert API reads; запускать только по явному запросу.

## Ignore As Architecture Source

- `node_modules`, `.next`, `build`, `dist`, `tsconfig.tsbuildinfo`, изображения и временные файлы.

## Fast Lookup

- WB API: `src/lib/wb-api`, подробнее `docs/core/WB_API_MAP.md`.
- Синхронизация: `src/lib/services/sync-*`, `src/lib/actions/sync.ts`, `src/lib/queue`, `src/lib/sync`.
- Отчеты: `src/lib/services/report-calculator.ts`, `src/lib/actions/reports.ts`, `src/app/(dashboard)/reports`.
- План/факт: `src/lib/services/plan-calculator.ts`, `src/lib/actions/sales-plan.ts`.
- Dashboard analytics: `src/lib/services/dashboard-summary.ts`, `dashboard-problem-center.ts`, `dashboard-export.ts`.
- Быстрый доступ к данным: `docs/core/DATABASE_ACCESS_GUIDE.md`.
- FBS: `src/app/(dashboard)/fbs`, `src/lib/services/fbs-*`, `src/lib/fbs`.
- Automations: `src/app/(dashboard)/automations`, `src/lib/automations`, `src/lib/queue/automation*`.
