# NimbaOS

NimbaOS is a private full-stack web service for digitizing Wildberries seller operations: products, stocks, financial reports, sales planning, advertising, reviews, reference data, background synchronization, and daily operational reporting.

This repository is not a landing page and not a toy demo. It is a working internal product built around a real marketplace workflow: collect data safely, normalize it in a local database, calculate business metrics, and give the owner a clear interface for daily decisions.

## What Problem It Solves

Marketplace work often turns into scattered Excel files, manual report checks, repeated cabinet logins, and risky one-off calculations. NimbaOS turns that into one controlled system:

- seller cabinets and API keys are managed in one place;
- WB data is synchronized into PostgreSQL before analysis;
- reports are calculated from local data, not from ad-hoc API calls;
- financial, stock, advertising, and plan/fact metrics live in one interface;
- background jobs track what was synced, when, and for which period;
- daily Google Sheets reporting can run from the database without hitting live WB APIs during the report step.

## Product Areas

- **Authentication and access**: NextAuth credentials flow, roles, invitations, account selector.
- **WB accounts**: encrypted API keys, seller metadata, tax settings, active/inactive cabinet control.
- **Products and references**: product cards, prices, cost prices, article overrides, self-buyouts, external ads, reply templates, dated article versions.
- **Financial reports**: realization reports, paid storage, ordered ruble volume, cost allocation, ROMI, buyout metrics, sticky table, XLSX export.
- **Sales planning**: plan CRUD, article-level plan/fact, daily grid, funnel/order/sales sync, add-from-stock workflow, export.
- **Advertising**: campaign list, campaign detail, nm stats, clusters, spend history, advertising-attributed order sum, XLSX export.
- **Stocks and inventory**: warehouse stock snapshots, turnover days, size-level risk, no-stock/no-demand/excess classification.
- **Reviews and questions**: read-only sync, workload analytics, reply templates and guarded write paths.
- **Dashboard analytics**: summary metrics, freshness checks, problem center, product and stock risks, deterministic recommendations, forecasts and exports.
- **Automations**: BullMQ-backed workflows, sync schedules, run history, and a DB-only morning WB report workflow for Google Sheets.

## Engineering Highlights

The project follows a DB-first pipeline:

```text
WB API -> sync services -> PostgreSQL -> calculation services -> UI / XLSX / Google Sheets
```

That choice is deliberate. It keeps analytics reproducible, avoids mixing live API responses with report calculations, and makes freshness/coverage visible.

Notable implementation work:

- Next.js 14 App Router monolith with TypeScript, server actions, Prisma, and PostgreSQL.
- BullMQ/Redis workers for manual and scheduled sync jobs.
- Explicit sync coverage and run tracking for period-based data.
- WB Finance API migration with pagination, selected fields, money normalization, and throttling.
- Historical article versions so reports do not mix old and new physical products under the same WB `nmId`.
- Advertising detail hardening for combined WB cards and primary `imtID` groups.
- Safety boundaries around WB write actions: prices, ads, feedback answers, cards, and historical resyncs require explicit intent.
- Project documentation split into core, development, and marketplace zones for handoff-friendly work.

## Tech Stack

- **Frontend/backend**: Next.js 14 App Router, TypeScript, React, Tailwind CSS, shadcn/ui
- **Auth**: NextAuth
- **Database**: PostgreSQL, Prisma 7
- **Jobs**: Redis, BullMQ
- **Integrations**: Wildberries APIs, Google Sheets API
- **Exports**: XLSX
- **Deployment artifacts**: Dockerfile, Docker Compose, nginx example

## Branch Map

Development originally happened on one linear branch, so the repository also keeps milestone branches that point to meaningful points in the same preserved history:

- `history/00-bootstrap-auth` - project bootstrap, auth, basic app structure.
- `history/01-wb-products-references` - WB account setup, product cards, references.
- `history/02-financial-reports` - report sync, formulas, UI, grouping, export.
- `history/03-sales-plan` - plan/fact module, orders/sales sync, funnel analytics.
- `history/04-advertising-sync` - advertising campaigns, background sync, queue hardening.
- `history/05-dashboard-inventory-feedback` - dashboard analytics, stocks, reviews/questions, exports.
- `history/06-docs-automations` - documentation split and morning WB automation.
- `history/07-current-hardening` - Finance API migration, stock/ad/report fixes, article versions.

`main` contains the current complete state.

## Repository Safety

This repo intentionally does not store real secrets, production `.env` files, decrypted WB API keys, or live credentials. Example env files are templates only.

Dangerous operations are documented and guarded in the project docs:

- production migrations;
- destructive database or filesystem actions;
- full historical WB resync;
- WB write actions for prices, cards, ads, budgets, stocks, and feedback answers.

## Local Orientation

For a quick technical overview:

- `AGENTS.md` - operating rules for Codex agents;
- `docs/DOCS_INDEX.md` - documentation navigator;
- `docs/core/PROJECT_STATE.md` - current implementation state;
- `docs/core/ARCHITECTURE.md` - architecture and data flow;
- `docs/core/COMMANDS.md` - safe command guide;
- `docs/core/SAFETY_RULES.md` - production and data safety rules.

Usually safe local checks:

```bash
npm run type-check
npx prisma validate
```

Commands that touch production data, live WB writes, historical resyncs, or migrations require explicit confirmation.
