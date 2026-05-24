# NimbaOS — Product Specification

`SPECIFICATION.md` describes stable product intent and business rules. It is not a development diary. Current implementation status lives in `docs/core/PROJECT_STATE.md`; decisions live in `DECISIONS.md`.

## Product goal

NimbaOS is an internal web platform for digitizing and managing Wildberries seller cabinets. It centralizes operational data, financial analytics, sales planning, reference data, and advertising campaign control for the seller team.

The product should help the team answer:
- what products are selling and at what margin;
- what WB fees, logistics, storage, taxes, self-purchases, and ads do to profit;
- whether a sales plan is on track by article and day;
- which advertising campaigns spend money effectively;
- what source data is fresh enough for a decision.

## Users

Primary users are the internal seller team.

Roles:
- `ADMIN`: full access, users, WB accounts, settings, all data and actions.
- `MANAGER`: operational access to reports, sales plans, advertising, references.
- `VIEWER`: read-only access to reports/cards where allowed.

The platform is closed and invitation-only. It is not a public SaaS.

## Supported marketplace scope

MVP supports Wildberries seller cabinets only.

Out of MVP:
- Ozon, Yandex Market, marketplaces other than WB;
- public multi-tenant SaaS onboarding;
- automated WB destructive actions without explicit user confirmation.

## MVP boundaries

In MVP, NimbaOS includes:
- authentication and role-based access;
- WB cabinet settings and encrypted API keys;
- WB product cards and price visibility;
- references: cost price, self-purchases, external ads, article overrides;
- financial reports with WB realization and paid storage data;
- sales plan with orders, sales, funnel metrics, daily grid, Excel export;
- advertising campaigns with campaign list, stats, clusters, breakdown, log, budget/bid/status actions;
- stock snapshots, reviews/questions, dashboard summaries and XLSX exports;
- BullMQ background sync scheduling and sync job history;
- basic local/dev Docker setup and VPS Docker artifacts.

Post-MVP / later phases:
- production rollout execution;
- broader operational monitoring and alerting;
- deeper marketplace automation with explicit approval flows.

## Success criteria

The product is successful when:
- analytics are calculated from local DB data, not live WB reads per screen render;
- managers can sync needed WB data safely and see when data is stale;
- financial reports reconcile key WB figures and show per-article profitability;
- sales plans show plan/fact per article and per day;
- advertising expenses can be analyzed and included in reports;
- risky WB-changing actions require deliberate user action;
- a new Codex session can restore project context from the documentation system without reading every file.

## Main modules

### Authentication and users

NextAuth Credentials auth with roles `ADMIN`, `MANAGER`, `VIEWER`. User management is available to admins.

### WB accounts and settings

WB accounts store encrypted API keys, tax rate, seller metadata, active status, and sync timestamps. The selected account is carried through dashboard URLs using `?account=id`.

### Product cards

Products are synchronized from WB content/prices APIs and stored locally. Cards include `nmId`, vendor code, brand, category, title, photo, sizes, prices, discounts, and derived price fields.

### References

Reference data enriches analytics:
- cost prices by vendor code;
- self-purchases and cashback distributions;
- external advertising spend;
- local article/material/name overrides.

### Financial reports

Financial reports are calculated from local DB data:
- realization report rows;
- paid storage rows;
- products for vendor code fallback and metadata;
- references;
- WB advertising stats where available.

Key business rules:
- WB `reportDetailByPeriod` may return empty `vendor_code`; fallback comes from `Product.nmId -> vendorCode`.
- `ppvzForPay` for returns comes positive; net transfer is sales for pay minus returns for pay.
- Sale amount uses WB SPP from realization rows: `retailPriceWithDisc * (1 - sppPercent / 100)`.
- Buyout percent uses bought-with-returns over delivered count.
- Marginality is operating profit divided by sales.
- Paid storage should use WB task-based paid storage API and per-article data when available.

### Sales plan

Sales plan supports creating plans for a WB account and date range, adding articles, setting planned quantity, price and buyout percent, syncing orders/sales/funnel data, showing daily article metrics, and exporting Excel.

Key data sources:
- WB Statistics orders/sales APIs;
- WB Analytics sales funnel history;
- local realization reports for autofill where appropriate.

### Advertising campaigns

Advertising supports:
- campaign list and status filters;
- campaign detail page;
- stats, search/recommendation breakdown, clusters, action log;
- bid changes, budget deposits, start, pause, stop actions;
- local storage of stats by campaign/date/source and per-article ad spend where WB data provides it.

Advertising actions are dangerous and require explicit user intent.

## Data freshness principle

The database is the source of truth for analytics. WB API is the mechanism for updating the database, not the primary source for every report request.

See `docs/core/DATA_FRESHNESS_POLICY.md` for operational rules.

## Security rules

API keys are encrypted at rest. Agents and tools must not read or print `.env` or decrypted tokens. Risky commands and WB-changing actions require explicit confirmation.

See `docs/core/SAFETY_RULES.md`.

## Non-goals

NimbaOS should not:
- expose WB tokens in logs or UI;
- rely on ad-hoc live WB API reads for analytics;
- silently run historical full syncs;
- silently change WB prices, cards, campaign bids/budgets/statuses;
- duplicate project memory across many files.
