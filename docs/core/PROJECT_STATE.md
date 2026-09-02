# Project State

Текущий snapshot реализации NimbaOS без хронологического журнала. История прежнего файла сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/PROJECT_STATE.md`; implementation history — в role logs.

Last updated: 2026-09-02.

## Current Phase

Основной MVP и последующие dashboard/FBS/automation расширения реализованы. Mini-PC production работает через Docker и доступен по trusted Tailscale path. В локальном `main` есть объединенный release delta от 2026-09-01/02, который еще требует owner-confirmed production rollout.

## Implemented

- Auth/users: NextAuth Credentials, roles, invitations и admin user management.
- WB accounts: encrypted API keys, tax/seller metadata, active state и account-aware navigation.
- Products/references: cards, prices, cost prices, overrides, self-purchases, external ads, reply templates и dated article versions.
- Financial reports: Finance API data, paid storage, advertising allocation, ordered rubles, profitability metrics и XLSX export.
- Sales plan: CRUD, article/day plan-fact, orders/sales/funnel data и export.
- Advertising: campaigns, statistics, clusters, logs, export и explicitly gated write actions.
- Dashboard/analytics: summary, freshness, problem center, risks, forecasts, deterministic recommendations и exports.
- WB stocks and feedback: current stock snapshots, turnover/risk, reviews/questions and guarded replies.
- Background processing: PostgreSQL + Redis/BullMQ sync jobs, persisted run history, schedules and automation catalog.
- FBS Stage 1: seller warehouses, assortment, orders, supplies/stickers, local inventory movements, encrypted KIZ lifecycle, manual CRPT XLSX batches and audited WB write gates.
- Google Sheets workflows: DB-only morning report and local FBS movement-sheet workflow.
- Production operations: Docker Compose on Windows mini-PC, healthcheck, workers, GitHub Actions owner-confirmed release path, backup/restore runbook and Tailscale administration.
- Documentation memory: compact canonical current layer plus explicit historical archive; startup context is role-routed through `AGENTS.md` and `docs/DOCS_INDEX.md`.
- Development tooling: Graphify 0.9.53 with SQL parsing is installed through `uv`, connected as a Codex project-scoped skill under `.codex/skills/graphify`, and initialized in deep mode under `graphify-out/`. Current graph counts belong in `graphify-out/GRAPH_REPORT.md` rather than this snapshot. A DB-first navigation audit links the financial report's local tables to `calculateReport()` and its KPI formulas while preserving the explicit live-ad-cost exception.

## Local Changes Awaiting Production Rollout

- Token expiry display and admin warning.
- Self-service email/password changes with `User.sessionVersion`; migration `20260902120000_user_session_version`.
- Phone-responsive UI and adaptive dashboard height.
- Flexible `/sync` schedules; migration `20260901143000_flexible_sync_schedules`.
- Shared Google Sheet template editor and app-service credential mapping.
- FBS movement-sheet workflow; migration `20260901120000_fbs_movement_sheet_automation`.
- Exact FBS physical-product tuple aliases and mapping audit tooling.

## Partially Implemented

- Full bounded live verification is not complete for every WB sync kind/account combination.
- Public employee access remains unreliable through Cloudflare for affected Russian IPv4 clients; Tailscale is the trusted path.
- Monitoring/alerting beyond persisted run histories is limited.
- Direct Chestny Znak True API integration is deferred.
- FBS opening physical balances/replenishment warnings still require operator reconciliation; WB write gates remain disabled unless explicitly approved.
- Persisted materialized aggregate layer is not implemented; reporting currently aggregates through services.

## Not Implemented

- Automatic destructive WB actions.
- Automatic broad historical resynchronization.
- Direct CRPT certificate/signature integration.
- General-purpose external BI/data warehouse.

## Canonical Current Sources

- Development delta: `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_CURRENT_TASKS.md`.
- Marketplace delta: `docs/marketplace/MARKETPLACE_HANDOFF.md`, `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`.
- Production: `docs/core/MINI_PC_RUNBOOK.md`.
- Architecture/data: `docs/core/ARCHITECTURE.md`, `docs/core/DATA_MODEL.md`, `docs/core/DATABASE_ACCESS_GUIDE.md`.
- Decisions: `DECISIONS.md`.

## Important Risks

- Production migrations, deploys, restores, full historical sync and WB writes require explicit approval.
- Analytics must check local coverage/freshness before drawing conclusions.
- WB API rate limits and response drift remain operational risks.
- New FBS product identities must not be inferred from similar text alone.
