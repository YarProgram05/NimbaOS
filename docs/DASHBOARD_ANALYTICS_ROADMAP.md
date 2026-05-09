# Dashboard And Analytics Roadmap

## Implementation Status

Last updated: 2026-05-09.

Implemented:

- Phase 0 is implemented.
  - Added the typed `DashboardSummary` contract in `src/types/dashboard.ts`.
  - Added supported period presets: today, yesterday, last 7 days, current month, previous month, custom range.
  - Added default comparison behavior: previous equal-length period. The current-month preset is month-to-date to avoid marking future dates as missing.
  - Dashboard loading follows the selected `?account`, falls back from invalid account ids to an active cabinet, and mirrors the selected cabinet into a cookie for server renders.
  - First implementation computes on demand through `src/lib/services/dashboard-summary.ts`, with a short in-memory summary cache and skips full report calculation when the period has no report rows and no coverage.
  - Missing and partial data are explicit via `ready`, `partial`, `missing`, and `not_applicable` statuses.
  - Added a server action in `src/lib/actions/dashboard.ts`.
- Phase 1 is implemented as the current dashboard foundation.
  - The home screen now loads one `DashboardSummary` object.
  - Added a period selector and custom date range form.
  - Added KPI cards for revenue, operating profit, marginality, DRR, orders, and buyouts.
  - Added plan/fact, advertising, product leaders, product risks, freshness, and focus blocks.
  - Added empty states for missing report, plan, advertising, and product data.
  - Removed live WB reads from dashboard/report render paths by preferring persisted advertising stats.
  - Mobile layout now keeps the problem center before lower analytics and uses the page scroll instead of a nested dashboard scroll trap.
- Phase 2 is implemented as the dashboard problem-center layer.
  - Extended freshness tracking across products, reports, sales plan, advertising campaigns, advertising stats, advertising clusters, and future stocks/reviews/questions domains.
  - Added normalized severity (`info`, `warning`, `critical`) and problem categories in `src/types/dashboard.ts`.
  - Added `src/lib/services/dashboard-problem-center.ts` to convert freshness/report/product issues into actionable dashboard insights.
  - The home screen "Focus" block now reads `summary.problemCenter.insights`, and every insight has an action link.
  - Failed sync jobs are surfaced as issues with the latest stored error when available, without blocking the rest of the dashboard summary.
  - Freshness issues now include stale-but-covered sources, so an old successful sync is not hidden just because period coverage exists.

Important changes from the original plan:

- The top KPI strip now treats the financial report calculator as the source of truth for revenue, operating profit, marginality, DRR, orders, and buyouts. This keeps the dashboard aligned with `/reports` for the same account and period.
- The home screen uses buyouts (`boughtWithReturns`) instead of returns in the executive KPI strip; returns remain available in the detailed financial report and product-risk analytics.
- The dashboard "orders" KPI uses `RealizationReport` calculator output (`delivered`) instead of `WbOrder`, because `WbOrder` can be incomplete for periods where only realization data is available.
- The existing report calculator may use its already implemented advertising spend flow. No new WB API domains or sync sources were added in Phase 0-1.
- The `preferPersistedAdStats` option remains available in the report calculator for future DB-only dashboard work, but the current dashboard KPI path prioritizes consistency with the financial report.
- The home screen focus/action block is now fed by `summary.problemCenter.insights`; page-local focus heuristics are deprecated in favor of the server-side problem center.
- Phase 2 tracks future stocks, reviews, and questions as explicit freshness domains, but they are placeholders until the matching persisted modules exist. They do not create operational issues yet.

Outdated or deferred parts:

- Phase 1 wording that implies `WbOrder` should drive the executive "orders" KPI is outdated. `WbOrder` remains useful for sales-plan analytics, but executive KPI consistency is tied to the financial report.
- Any dashboard implementation that rebuilds action/focus items directly in `src/app/(dashboard)/page.tsx` is outdated; new rules should go into `src/lib/services/dashboard-problem-center.ts`.
- Phase 2 issue categories for low stock, out of stock, product without stock data, and unanswered review/question are contract-ready but deferred until Phase 3-4 data sources are implemented.
- A fully DB-only advertising-spend source for the dashboard is deferred. To make the dashboard both DB-only and report-consistent, the advertising payment history used by the report calculator should be persisted in a later phase.
- Inventory, reviews, questions, forecasts, recommendation engine, and dashboard exports remain future phases.

## Purpose

This document is an implementation brief for expanding NimbaOS from a set of operational modules into a stronger Wildberries command center.

The goal is not only to redesign the home screen. The goal is to add the missing product, inventory, review, question, forecast, recommendation, and executive analytics layers that can feed a useful dashboard.

Use this document when planning or implementing the next product phases. Keep implementation incremental: each phase should leave the app usable, verified, and documented.

## Current Baseline

Already implemented at code level:

- Auth, roles, invitations, WB accounts, encrypted API keys.
- Product cards sync from WB content/prices APIs.
- References: cost prices, self-purchases, external ads, article overrides.
- Financial reports: realization report, paid storage, P&L formulas, Excel export.
- Sales plan: CRUD, article plan, orders/sales/funnel sync, daily grid, Excel export.
- Advertising: campaigns, stats, clusters, breakdowns, action log, Excel export, selected WB actions.
- Background sync: Bull MQ, worker, schedules, `SyncJobRun`, `/sync` screen.
- Old-money restrained UI refresh for shell and key pages.

Historical baseline before Phase 0-1:

- product count;
- realization row count;
- sales plan count;
- active sync job count;
- selected account and last sync timestamp.

The Phase 0-1 implementation replaced this shallow home screen with a period-aware `DashboardSummary`-driven dashboard. The next phases should extend that foundation with new persisted data domains, not decorative blocks.

## Core Principles

- Database is the source of truth for analytics screens. WB API updates local data; pages should not depend on live WB reads during render.
- Every new WB data source needs: API client, sync service, queue job kind, database model, freshness tracking, UI state, error handling, and docs.
- Avoid large silent historical syncs. For wide periods, ask for explicit user intent or use cautious queued jobs.
- Respect WB rate limits. Reuse the existing retry/backoff pattern in the sync worker.
- Prefer period-based metrics. Every dashboard value should say what period it represents.
- Build business decisions, not vanity metrics. A block is useful only if it helps answer what to do next.
- Keep the UI restrained, dense, and operational. Avoid decorative empty space.

## Target Dashboard

The final home screen should answer these questions quickly:

- How much did we sell, earn, and spend in the selected period?
- Are we on track against plan?
- Which products drive profit, and which products hurt it?
- Which products will run out soon?
- Which products are stuck in stock?
- What happened with advertising efficiency?
- Are there urgent reviews or questions?
- Is the data fresh enough to trust?
- What should the manager do first today?

Recommended dashboard sections:

- Executive KPI strip: revenue, operating profit, margin, DRR, orders, buyout.
- Period trend: revenue/profit/orders/ad spend over time.
- Plan/fact panel: current plan progress and forecast to period end.
- Stock risk panel: out of stock, low stock, overstock, days until zero.
- Product leaders: top profit, top revenue, top growth.
- Product risks: negative margin, high DRR, high returns, no cost price, no stock.
- Advertising summary: spend, DRR, CTR, CPC, campaigns to check.
- Reviews/questions queue: new negative reviews, unanswered questions, average rating.
- Sync freshness panel: data sources, last sync, coverage, failed jobs.
- Action center: prioritized recommendations with links to the exact module.

## Visual Reference

Reference image:

`D:\VScode my projects\Nimba_digitization\ig_02275537349281df0169fe492c9ff8819182ebe09f52ca7a47.png`

Use this image as the visual direction for the final dashboard, not as a pixel-perfect requirement.

The home screen should look like a restrained old-money business command center: calm ivory background, dark green sidebar, thin warm-gray borders, compact cards, precise spacing, and quiet typography. The first desktop viewport should feel filled with useful operational content: KPI strip at the top, a meaningful trend/chart area, an action/focus panel, and lower analytical blocks for plan/fact, stocks, advertising, reviews/questions, product leaders, and product risks. Avoid large decorative empty zones; every large block should either show real data, a useful empty state, or a clear next action.

## Phase 0 - Product And Data Contract

Goal: define the dashboard contract before implementing UI blocks.

Tasks:

- Create a typed dashboard data contract, for example `DashboardSummary`.
- Define supported periods: today, yesterday, last 7 days, current month, previous month, custom range.
- Define comparison period behavior: previous equal-length period by default.
- Define account behavior: all dashboard data must follow selected `?account`.
- Decide whether the first implementation computes on demand or uses cached aggregates.
- Map each dashboard widget to a data source and fallback state.

Suggested output:

- `src/types/dashboard.ts`
- `src/lib/services/dashboard-summary.ts`
- server action for loading dashboard summary

Acceptance:

- A future UI can request one dashboard summary object for one account and period.
- Missing data returns explicit status, not misleading zeros.
- The contract distinguishes "0 value" from "not synced".

## Phase 1 - Dashboard Foundation

Goal: make the current home screen data-driven and period-aware using already implemented data.

Use existing sources first:

- `RealizationReport`
- `PaidStorage`
- `CostPrice`
- `SelfPurchase`
- `ExternalAd`
- `AdCampaignStat`
- `AdCampaignNmStat`
- `SalesPlan`
- `WbOrder`
- `WbSale`
- `WbFunnelStat`
- `SyncJobRun`
- `SyncDataCoverage`

Tasks:

- Add period selector to the dashboard.
- Add KPI cards for revenue, operating profit, marginality, DRR, orders, buyouts.
- Add compact plan/fact summary from active sales plans.
- Add advertising summary from cached ad stats.
- Add top/anti-top products using existing report calculator output.
- Add freshness summary from sync job history and coverage.
- Add empty states that explain which sync is needed.

Acceptance:

- Dashboard remains useful even before inventory/reviews are implemented.
- No full page vertical scroll caused by one oversized widget.
- Desktop has no large unused blanks; widgets use consistent height and density.
- Mobile layout stacks cleanly and keeps actions reachable.

## Phase 2 - Data Freshness And Problem Center

Goal: create a unified operational status layer.

Tasks:

- Extend freshness tracking per data domain:
  - products;
  - reports;
  - sales plan;
  - advertising campaigns;
  - advertising stats;
  - advertising clusters;
  - future stocks;
  - future reviews;
  - future questions.
- Add a service that converts raw issues into actionable dashboard items.
- Normalize problem severity: `info`, `warning`, `critical`.
- Store or compute problem categories:
  - sync failed;
  - data stale;
  - missing cost price;
  - no recent report data;
  - high DRR;
  - negative margin;
  - product without stock data;
  - unanswered review/question;
  - low stock;
  - out of stock.

Suggested models or types:

- `DashboardInsight`
- `DashboardIssue`
- `DataFreshnessStatus`

Acceptance:

- Main screen can show "what needs attention today".
- Every issue links to a page where the user can act.
- Failed sync jobs do not block the whole dashboard.

## Phase 3 - Stocks And Inventory

Goal: add real WB stock data, not only product cards.

Important: before implementation, verify the current official WB stock/statistics API shape and limits. Do not rely on stale endpoint assumptions.

Data to collect:

- current stock by product;
- stock by warehouse;
- size/barcode/chrtId when available;
- quantity available for sale;
- quantity in transit if WB exposes it;
- last stock sync timestamp.

Suggested database models:

- `Warehouse`
- `StockSnapshot`
- `StockItem`
- optional `StockHistoryDaily`

Suggested sync jobs:

- `STOCKS_CURRENT`
- optional `STOCKS_HISTORY`

Analytics:

- total stock units;
- stock value by cost price;
- days until zero;
- low-stock products;
- out-of-stock products;
- overstock products;
- stock by warehouse;
- products with sales but no stock;
- products with stock but no sales.

UI:

- new `/stocks` section;
- stock table with filters by brand, category, warehouse, risk;
- dashboard stock-risk widget;
- product-level stock card or drawer.

Acceptance:

- Sales plan "add from stock" uses real stocked products, not all product cards.
- Dashboard can show low stock and out-of-stock counts.
- Each stock value has a clear "synced at" timestamp.

## Phase 4 - Reviews And Questions

Goal: add customer feedback operations and quality analytics.

Important: before implementation, verify current official WB feedbacks/questions API shape, pagination, permissions, and answer rules.

Data to collect for reviews:

- review id;
- nmId/vendor code relation;
- rating;
- text;
- pros/cons when available;
- photos/videos if available;
- created date;
- answer status;
- answer text;
- product metadata snapshot.

Data to collect for questions:

- question id;
- nmId/vendor code relation;
- text;
- created date;
- answer status;
- answer text;
- product metadata snapshot.

Suggested database models:

- `ProductReview`
- `ProductQuestion`
- optional `ReviewReply`
- optional `QuestionReply`

Suggested sync jobs:

- `REVIEWS_REFRESH`
- `QUESTIONS_REFRESH`

Analytics:

- average rating;
- new reviews;
- negative reviews;
- unanswered reviews;
- unanswered questions;
- products with rating decline;
- products with repeated complaint themes.

UI:

- new `/reviews` section with tabs for reviews and questions;
- filters by rating, answer status, product, date;
- dashboard widget for urgent feedback;
- quick link from review/question to product and reports.

Acceptance:

- Dashboard shows review/question workload.
- Negative reviews and unanswered questions are visible without opening the module.
- No WB write action is performed without explicit user intent.

## Phase 5 - Existing Analytics Upgrade

Goal: extract more dashboard value from modules that already exist.

Financial analytics:

- period revenue;
- transfer to seller;
- operating profit;
- marginality;
- rentability;
- taxes;
- logistics;
- storage;
- penalties;
- acceptance;
- paid storage;
- self-purchases;
- external ads;
- WB ads;
- return impact.

Product analytics:

- top products by revenue;
- top products by operating profit;
- products with negative operating profit;
- products with high logistics share;
- products with high storage share;
- products with missing cost price;
- products with high return rate.

Sales analytics:

- orders;
- sales;
- returns;
- cancellations;
- buyout percent;
- average price;
- conversion funnel where available.

Advertising analytics:

- total spend;
- DRR;
- CTR;
- CPC;
- orders from ads;
- cart adds from ads;
- inefficient campaigns;
- campaigns without recent stats;
- campaigns with spend but no orders.

Acceptance:

- Dashboard can rank products and campaigns by business impact.
- Existing report formulas are reused; do not duplicate incompatible formulas.
- Metrics match the financial report for the same account and period.

## Phase 6 - Forecasts And Planning

Goal: add forward-looking analytics.

Forecasts:

- revenue forecast to end of period;
- operating profit forecast to end of period;
- sales plan completion forecast;
- stock depletion forecast;
- advertising spend forecast.

Planning helpers:

- recommended daily sales pace;
- how many units need to sell to reach plan;
- estimated stock needed for the next period;
- products requiring plan adjustment.

Acceptance:

- Dashboard shows not only what happened, but whether the month is likely to hit target.
- Forecasts clearly mark assumptions and avoid fake precision.
- Forecast blocks degrade gracefully when not enough data exists.

## Phase 7 - Recommendation Engine

Goal: produce prioritized daily actions.

Recommended action types:

- sync missing data;
- fill missing cost price;
- review negative-margin products;
- reduce or inspect high-DRR campaigns;
- replenish low-stock products;
- stop over-investing in products with stock but no demand;
- answer urgent reviews/questions;
- check products with rating decline;
- check products with high returns.

Implementation approach:

- Start with deterministic rules.
- Give every rule a severity, reason, metric, and target link.
- Keep recommendations explainable.
- Avoid automated destructive WB actions.

Suggested type:

- `ActionRecommendation`

Fields:

- `id`
- `severity`
- `category`
- `title`
- `description`
- `metric`
- `href`
- `createdAt`

Acceptance:

- Dashboard has a "Focus today" or "Action center" block.
- Every recommendation has a clear reason and destination.
- User can understand why it appeared.

## Phase 8 - Exports And Management Reports

Goal: make dashboard insights portable.

Exports:

- dashboard summary Excel;
- product risk Excel;
- stock risk Excel;
- review/question workload Excel;
- optional PDF executive report.

Rules:

- Reuse shared XLSX helpers.
- Export the same values shown on screen.
- Include account, period, sync freshness, and generation time.

Acceptance:

- A manager can send a compact weekly/monthly summary without manually copying data.
- Exported numbers match dashboard numbers.

## Phase 9 - Final Dashboard UI/UX

Goal: assemble the new home screen after data foundations exist.

Layout guidance:

- Keep first screen dense and useful.
- Use compact metric cards, tables, charts, and action lists.
- Avoid empty decorative space.
- Avoid nested cards.
- Avoid oversized hero sections.
- Use old-money business style: restrained colors, clean borders, calm typography, precise spacing.
- Make dashboard responsive for desktop, tablet, and mobile.

Suggested desktop structure:

- top command bar: period, account, sync status;
- KPI strip;
- two-column middle area:
  - trend chart;
  - action center;
- lower grid:
  - plan/fact;
  - stock risk;
  - advertising;
  - reviews/questions;
  - product leaders/risks.

Suggested mobile structure:

- period/account controls;
- KPI carousel or two-column compact grid;
- action center first;
- collapsible analytics sections.

Acceptance:

- No full-page scroll trap from tables.
- Every large block has real data or a useful empty state.
- Account switching updates dashboard data everywhere.
- Main screen feels like a working cockpit, not a landing page.

## Phase 10 - Verification And Documentation

Goal: keep the project stable after the expansion.

Verification:

- type-check;
- lint/build where available;
- focused service tests if test infra exists;
- manual dashboard smoke with at least one account;
- browser check for desktop and mobile;
- sync smoke per new read-only job type, respecting rate limits.

Documentation updates:

- `docs/PROJECT_STATE.md` after each completed phase;
- `docs/CURRENT_TASKS.md` for active/blocked work;
- `docs/BUGS_AND_INCIDENTS.md` for sync/API failures;
- `docs/DECISIONS.md` for major architecture decisions;
- `docs/DOCS_INDEX.md` when adding/removing docs.

Acceptance:

- A future Codex session can understand the new modules from docs without reading the whole codebase.
- The dashboard source of truth is clear.
- Known limitations are documented.

## Suggested Implementation Order

1. Build `DashboardSummary` on existing data.
2. Add period-aware dashboard UI.
3. Add data freshness/problem center.
4. Implement stocks module.
5. Connect stock risk to dashboard.
6. Implement reviews/questions module.
7. Connect customer feedback workload to dashboard.
8. Add forecasts and recommendations.
9. Add dashboard exports.
10. Polish dashboard UI and verify responsive behavior.

## Out Of Scope Unless Explicitly Requested

- Other marketplaces besides Wildberries.
- Automatic destructive WB actions.
- AI-generated replies to customers without human approval.
- Public SaaS onboarding.
- Large historical syncs without confirmation.
- Replacing existing financial formulas without reconciliation.
