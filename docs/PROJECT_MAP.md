# Project Map

## Root

- `docs/AGENTS.md`: короткие правила Codex.
- `docs/SPECIFICATION.md`: стабильная продуктовая спецификация.
- `README.md`: human-facing quick start.
- `PROMPTS_GUIDE.md`: legacy archive of old Claude prompt plan.
- `docs/`: project memory and operational documentation.
- `prisma/`: Prisma schema, config and seed.
- `scripts/`: debug/helper scripts.
- `src/`: application source.

## App routes

- `src/app/(dashboard)`: authenticated dashboard routes.
- `src/app/(dashboard)/cards`: product cards.
- `src/app/(dashboard)/reports`: financial reports.
- `src/app/(dashboard)/sales-plan`: sales plan.
- `src/app/(dashboard)/references`: reference data.
- `src/app/(dashboard)/advertising`: advertising campaigns.
- `src/app/(dashboard)/sync`: background sync status and safe manual enqueue.
- `src/app/(dashboard)/settings`: account/profile settings.
- `src/app/(dashboard)/admin/users`: user administration.

## Shared UI

- `src/components/ui`: shadcn/ui components.
- `src/components/layout`: dashboard layout components.
- `src/components/providers`: React providers such as account context.
- `src/components/date-range-picker.tsx`: shared date range picker.
- `src/components/wb-article-link.tsx`: WB article link with photo hover.

## Server-side layers

- `src/lib/actions`: Server Actions for app mutations and reads.
- `src/lib/services`: sync services and calculators.
- `src/lib/wb-api`: WB API client and endpoint wrappers.
- `src/lib/db`: Prisma client setup.
- `src/lib/auth`: auth options and role checks.
- `src/lib/reports`: report aggregation helpers.
- `src/lib/queue`: Bull MQ background sync queue, job types, enqueue helpers and worker processor.

## Types

- `src/types/reports.ts`: financial report types.
- `src/types/sales-plan.ts`: sales plan and WB order/sale/funnel types.
- `src/types/advertising.ts`: advertising WB/internal types.
- `src/types/references.ts`: reference data types.

## Data model

Prisma schema is in `prisma/schema.prisma`. Read `docs/DATABASE_ACCESS_GUIDE.md` before direct DB work.

## Debug scripts

- `scripts/debug-report.ts`: realization report debug check.
- `scripts/debug-advertising.ts`: advertising live endpoint smoke check. Do not run if avoiding WB API calls.

## Documentation

Start with `docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`.
