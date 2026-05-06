# Project State

## Current phase

Phase 9 production/responsive/Excel polish is implemented at code level. Phase 7 and Phase 8 still need live WB verification after API rate-limit windows.

## Implemented

- Phase 0: базовый Next.js проект, Tailwind v4, shadcn/ui, Docker dev, Prisma schema.
- Phase 1: auth, роли, invitations, dashboard layout, admin users.
- Phase 2: WB accounts/settings, AES-256-GCM API key encryption, WB API client, account selector.
- Phase 3: product cards sync, table, filters/sorting, price visibility/editing flow.
- Phase 4: references: cost price, self-purchases, external ads, article overrides.
- Phase 5: financial reports, realization sync, paid storage task flow, 52 columns, formulas, Excel export.
- Phase 6: sales plan CRUD, article management, orders/sales/funnel sync, daily grid, Excel export.
- Phase 7: advertising campaigns UI/API/services/actions, stats, clusters, breakdown, logs, Excel export, pause/start/stop/deposit/bid actions, per-nm ad spend for reports.
- Phase 8: Bull MQ background sync for read-only WB syncs, `SyncJobRun` history, worker, scheduler, `/sync` mini-screen, manual enqueue actions.
- Phase 9: VPS Docker production artifacts, public healthcheck, Prisma baseline migration, responsive table polish, shared XLSX export helper.
- Documentation memory system: short startup docs, index, handoff, task board, state, protocol, safety, command and data guides.

## Partially implemented

- Phase 7 live verification: code is in place, but WB advert API returned long `429`; full live test still pending.
- Phase 8 live verification: code and type checks pass, but the new Prisma schema has not been applied to dev DB in this session and no live WB job was run.
- Production live rollout: artifacts exist, but real VPS deploy/migrate/runbook execution still requires explicit confirmation.

## Not implemented yet

- Full monitoring/alerting beyond the `/sync` mini-screen and `SyncJobRun` error history.
- Product tags in financial reports if still required by future scope.

## Deprecated / do not use

- Do not use `CLAUDE.md`; it was removed in favor of `docs/AGENTS.md` plus `docs/DOCS_INDEX.md`.
- Do not treat `PROMPTS_GUIDE.md` as current operating instructions; it is a legacy prompt archive.
- Do not read all `docs/*.md` at session startup.
- Do not rely on live WB API reads as the source for analytics screens.

## Important modules

- Auth/users: `src/lib/auth`, `src/lib/actions/users.ts`, dashboard auth pages.
- WB API layer: `src/lib/wb-api`.
- Sync services: `src/lib/services`.
- Background sync: `src/lib/queue`, `src/lib/actions/sync.ts`, `scripts/sync-worker.ts`, `scripts/schedule-sync.ts`, `src/app/(dashboard)/sync`.
- Production deploy: `Dockerfile`, `docker-compose.prod.yml`, `.env.production.example`, `deploy/nginx/nimbaos.conf`, `src/app/api/health/route.ts`.
- Server Actions: `src/lib/actions`.
- Financial reports: `src/app/(dashboard)/reports`, `src/lib/services/report-calculator.ts`.
- Sales plan: `src/app/(dashboard)/sales-plan`, `src/lib/services/plan-calculator.ts`.
- Advertising: `src/app/(dashboard)/advertising`, `src/lib/services/sync-ad-stats.ts`, `src/lib/wb-api/advertising.ts`.
- Prisma schema: `prisma/schema.prisma`.

## Data / sync / reports status

- БД — источник истины для аналитики.
- WB realization reports and paid storage are cached locally.
- Sales plan reads orders/sales/funnel from local DB after sync.
- Advertising stats are cached by campaign/date/source and by campaign/date/source/nmId where WB returns article-level stats.
- `WbAccount.lastSyncAt` is used as authoritative report sync timestamp where relevant.
- `SyncJobRun` stores background sync status, payload, result, attempts and errors.
- Historical re-syncs require explicit confirmation.
