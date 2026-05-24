# Architecture

Общая архитектура NimbaOS. Last updated: 2026-05-24.

## Shape

NimbaOS — монолитное Next.js 14 App Router приложение с серверными actions, Prisma/PostgreSQL для данных, Redis/BullMQ для фоновых sync jobs и модульным WB API слоем.

Правильный поток данных:

```text
WB API -> sync service -> database -> normalized data -> aggregates/views/report services -> analytics/report/UI/agent
```

Неправильный поток:

```text
WB API -> ad-hoc script -> report
```

## Layers

- UI: `src/app/(dashboard)` и компоненты в `src/components`.
- Server Actions: `src/lib/actions/*` — мост UI к БД, sync queue и бизнес-сервисам.
- Services: `src/lib/services/*` — расчеты, sync, dashboard summary, stock/feedback/report logic.
- WB API: `src/lib/wb-api/*` — HTTP-клиент, rate limits, read/write endpoint wrappers.
- Queue: `src/lib/queue/*`, `scripts/sync-worker.ts` — BullMQ processing.
- Sync state: `src/lib/sync/*`, таблицы `sync_job_runs`, `sync_schedule_settings`, `sync_data_coverages`.
- Database: Prisma models in `prisma/schema.prisma`.

## Frontend And Backend Boundary

Frontend pages usually call Server Actions. API Routes are minimal and currently used for health/auth. Internal mutations are not public REST endpoints by default.

## Business Logic

- Financial report formulas: `src/lib/services/report-calculator.ts`.
- Plan/fact metrics: `src/lib/services/plan-calculator.ts`.
- Dashboard summary/recommendations: `src/lib/services/dashboard-summary.ts`.
- Stock analytics: `src/lib/services/stocks.ts`.
- Feedback analytics: `src/lib/services/feedback.ts`.
- Report row aggregation: `src/lib/reports/aggregate-report-rows.ts`.

## Sync Logic

Sync services read WB API and write local tables:
- products: `sync-products.ts`;
- reports and paid storage: `sync-reports.ts`, `sync-paid-storage.ts`;
- orders/sales/funnel: `sync-orders.ts`, `sync-sales.ts`, `sync-funnel.ts`;
- ads: `sync-ad-campaigns.ts`, `sync-ad-stats.ts`, `sync-ad-clusters.ts`;
- stocks: `sync-stocks.ts`;
- reviews/questions: `sync-feedback.ts`.

UI-triggered sync should enqueue through `src/lib/actions/sync.ts` where possible.

## Fast Reports

Regular analytics should call calculators/services/actions, not manually scan raw tables. Views/materialized views and persisted summary tables were not found in the current schema. Aggregation is service-level today.

