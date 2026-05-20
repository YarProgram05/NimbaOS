# Current Tasks

## Active

### TASK-P8-SYNC-ERRORS

Status: Partially fixed; live smoke pending  
Priority: High  
Description: Phase 8 background sync still needs live verification after WB API long rate limits. Fixed code-level issues seen in worker: ad stats numeric overflow, null `fullstats` responses, and advertising cluster periods above WB's 30-day limit. `/sync` supports deleting non-running queue/history items.  
Next step: Run one read-only smoke per job type after WB retry windows clear; old failed history rows can remain as audit history.  
Related files: `docs/BUGS_AND_INCIDENTS.md`, `src/lib/queue/sync-processor.ts`, `src/lib/services/sync-ad-stats.ts`, `src/lib/services/sync-ad-clusters.ts`, `src/lib/sync/job-runs.ts`, `src/app/(dashboard)/sync`  
Risks: Do not spam WB sync buttons while a same-kind job is queued/running; respect retry windows.

### TASK-PRODUCT-PRICE-VERIFY

Status: Waiting on WB prices rate limit  
Priority: High  
Description: Product price sync was fixed at code level to preserve old prices and retry correctly when WB `prices` domain is rate-limited. Live run on 2026-05-06 hit `WB API rate limit exceeded on domain "prices"` with retry around 34 minutes, so blank prices cannot be fully backfilled until WB allows price requests again.  
Next step: After the retry window clears, run one products refresh for `WB Galioni (WB_2)` and verify `/cards` price coverage.  
Related files: `src/lib/services/sync-products.ts`, `docs/BUGS_AND_INCIDENTS.md`  
Risks: Repeated manual retries before the WB retry window clears will extend/noise the rate-limit problem.

Нет активных незаблокированных задач.

## Next

Нет запланированных незаблокированных задач.

## Blocked

### TASK-P7-VERIFY

Status: Blocked by WB API  
Priority: High  
Description: WB advert API вернул `429` с retry около 42 минут при live-check.  
Next step: Повторить позже; если повторяется, записать новый инцидент и проверить лимиты/расписание запросов.  
Related files: `src/lib/wb-api/advertising.ts`, `src/lib/services/sync-ad-stats.ts`, `scripts/debug-advertising.ts`, `docs/BUGS_AND_INCIDENTS.md`, `docs/DATA_FRESHNESS_POLICY.md`  
Risks: Не ждать долгий retry в интерактивном UI; не запускать управляющие рекламные действия без подтверждения.

## Done recently

### TASK-REPORT-DASHBOARD-PARITY

Status: Done
Priority: High
Description: Fixed dashboard and analytics parity with the financial report for report-derived metrics. Dashboard/analytics now reuse the same report calculation options as `/reports`, including WB ad update history totals for `Реклама (все)` and derived DRR/OP/margin values. Added the analytics period picker and adjusted the sales-plan create dialog period spacing.
Next step: No action unless a new external reconciliation mismatch appears.
Related files: `src/lib/services/report-calculator.ts`, `src/lib/services/dashboard-summary.ts`, `src/lib/services/dashboard-analytics-detail.ts`, `src/lib/actions/reports.ts`, `src/app/(dashboard)/analytics`, `src/app/(dashboard)/sales-plan/create-plan-dialog.tsx`
Risks: Storage logic was not changed in this fix.

### TASK-SELLER-SIZE-DRILLDOWN

Status: Done at code level
Priority: High
Description: Reports, product analytics lists, and `/stocks` now expose expandable child rows for multi-size WB articles. Child rows use a virtual `vendorCode + seller size` label; seller size (`techSize`, the "Размер" field in WB cards) has priority over Russian size (`wbSize`).
Next step: Verify with a real WB1/Nimba multi-size article after the next report/stock sync.
Related files: `src/lib/services/report-calculator.ts`, `src/app/(dashboard)/reports`, `src/lib/services/stocks.ts`, `src/app/(dashboard)/stocks`, `src/app/(dashboard)/analytics/analytics-shared.tsx`
Risks: WB advertising is still received by `nmId`, so report child rows distribute ad spend proportionally by sales within the article.

### TASK-DASHBOARD-ANALYTICS-PHASE-9

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phase 9 is implemented as final home-screen UI/UX polish. The dashboard now has a denser command-center layout with top account/period/status context, KPI strip, comparison trend panel, first-screen action center, and compact lower panels for finance, plan/fact, forecast, sales, advertising, stock risk, feedback, and product risks.
Next step: Run browser smoke on desktop and mobile viewports with representative account data, checking that the first viewport is useful and there are no text overlaps.
Related files: `src/app/(dashboard)/page.tsx`, `docs/DASHBOARD_ANALYTICS_ROADMAP.md`, `docs/PROJECT_STATE.md`
Risks: The trend panel intentionally compares current KPI values with the comparison period; daily time-series charts remain a future aggregate/data-contract enhancement.

### TASK-DASHBOARD-ANALYTICS-PHASE-8

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phase 8 is implemented as management Excel exports. The dashboard now exposes an Excel menu for summary, product risks, stock risks, and review/question workload; workbooks are generated from `DashboardSummary` and include account, period, freshness, and generation context.
Next step: Verify downloads visually in the browser with representative account data and compare exported values against the dashboard cards for the same period.
Related files: `src/lib/services/dashboard-export.ts`, `src/lib/actions/dashboard.ts`, `src/app/(dashboard)/dashboard-export-buttons.tsx`, `src/app/(dashboard)/page.tsx`, `docs/DASHBOARD_ANALYTICS_ROADMAP.md`
Risks: PDF executive report is still optional/deferred; Excel exports intentionally use dashboard-level compact lists, not full module-table exports.

### TASK-DASHBOARD-ANALYTICS-PHASE-6-7

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phases 6-7 are implemented as explainable forecasts and deterministic recommendations. The dashboard summary now exposes forecast projections, plan pace, stock depletion helpers, and prioritized action recommendations; the home screen shows a compact forecast/pace panel and Focus uses `summary.recommendations`.
Next step: Verify visually with representative account data, especially current-month active plans, missing reports, stale sync sources, and stock risk cases.
Related files: `src/types/dashboard.ts`, `src/lib/services/dashboard-summary.ts`, `src/app/(dashboard)/page.tsx`, `docs/DASHBOARD_ANALYTICS_ROADMAP.md`
Risks: Forecasts are simple pace projections from local persisted data, not statistical forecasts. Closed or too-short periods intentionally degrade to `not_applicable`.

### TASK-DASHBOARD-ANALYTICS-PHASE-5

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phase 5 is implemented as an existing analytics upgrade: financial breakdown, sales/funnel metrics, expanded product risk slices, advertising campaign impact lists, and new problem-center issue categories.
Next step: Verify dashboard visually with representative account data and compare financial breakdown values against `/reports` for the same period.
Related files: `src/types/dashboard.ts`, `src/lib/services/dashboard-summary.ts`, `src/lib/services/dashboard-problem-center.ts`, `src/app/(dashboard)/page.tsx`, `docs/DASHBOARD_ANALYTICS_ROADMAP.md`
Risks: Advertising campaign rankings depend on persisted `AdCampaignStat`; stale or missing ad stats should be handled by sync freshness/problem-center issues rather than live WB reads.

### TASK-DASHBOARD-ANALYTICS-PHASE-4

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phase 4 is implemented as reviews/questions read-only v1: persisted `ProductReview` and `ProductQuestion`, `reviews.refresh` and `questions.refresh` jobs, `/reviews`, dashboard feedback workload/freshness, and problem-center issues for unanswered or negative feedback.
Next step: Apply the new Prisma migration in the target environment, run one safe read-only reviews/questions sync for a test account, then verify `/reviews` and dashboard feedback workload with real WB data.
Related files: `prisma/schema.prisma`, `src/lib/services/sync-feedback.ts`, `src/lib/services/feedback.ts`, `src/app/(dashboard)/reviews`, `src/lib/services/dashboard-summary.ts`, `src/lib/services/dashboard-problem-center.ts`
Risks: WB feedbacks/questions require a token category with the correct permission; Phase 4 intentionally does not send answers, mark viewed, reject, or edit WB feedback.

### TASK-DASHBOARD-ANALYTICS-PHASE-3

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phase 3 is implemented as WB warehouse inventory v1: persisted stock snapshots, `stocks.current` sync, `/stocks`, dashboard stock-risk widget, stock freshness/problem-center issues, and sales-plan add-from-stock based on positive current stock.
Next step: Apply the new Prisma migration in the target environment, run one stock sync for a test account, and verify `/stocks` plus dashboard stock risk with real WB data.
Related files: `prisma/schema.prisma`, `src/lib/services/sync-stocks.ts`, `src/lib/services/stocks.ts`, `src/app/(dashboard)/stocks`, `src/lib/services/dashboard-summary.ts`, `src/lib/services/dashboard-problem-center.ts`, `src/lib/actions/sales-plan.ts`
Risks: Phase 3 v1 intentionally covers only WB warehouse inventory from seller analytics; FBS/seller warehouses and stock history are deferred.

### TASK-REPORTS-AD-ACCURACY-UX

Status: Done
Priority: High
Description: Financial reports now keep a compact fixed reports header/control area, table-only scrolling, sticky header/totals, persisted per-user column order, and corrected article-level advertising allocation. For the checked WB Galioni period `16.03.2026-12.05.2026`, ad totals match the reference service: balance `14 779`, all `15 997`.
Next step: If another historical mismatch appears, compare the affected period against WB ad update history and extend allocation rules only with concrete reference evidence.
Related files: `src/lib/services/report-calculator.ts`, `src/app/(dashboard)/reports`, `src/lib/actions/reports.ts`, `prisma/schema.prisma`
Risks: WB historical campaign settings can differ from current campaign settings; avoid replacing the spend-history allocation path with raw `fullstats` nm rows.

### TASK-DASHBOARD-ANALYTICS-PHASE-2

Status: Done at code level
Priority: Medium
Description: Dashboard analytics roadmap Phase 2 is implemented: expanded data freshness domains, normalized `info`/`warning`/`critical` problem severities, issue categories, and the dashboard problem center service that turns raw freshness/report/product signals into actionable home-screen insights.
Next step: Continue with Phase 3 stocks/inventory when ready; verify visually with representative account data after the local app is running.
Related files: `src/types/dashboard.ts`, `src/lib/services/dashboard-summary.ts`, `src/lib/services/dashboard-problem-center.ts`, `src/app/(dashboard)/page.tsx`, `docs/DASHBOARD_ANALYTICS_ROADMAP.md`
Risks: Stocks/reviews/questions are represented as future freshness domains only; they do not produce operational issues until those data sources are implemented.

### TASK-UI-OLD-MONEY-REDESIGN

Status: Done at code level  
Priority: Medium  
Description: Dashboard shell, sidebar/header, home, cards, reports and sales-plan screens were restyled into a restrained old-money business UI. Desktop hamburger/sidebar toggle and NimbaOS home link are restored; home dashboard is account-aware through `?account`.  
Next step: Optional visual refinement for desktop home empty areas; concept mockup requested before implementation.  
Related files: `src/app/(dashboard)/page.tsx`, `src/components/layout/*`, `src/app/globals.css`  
Risks: Keep future home additions operational and data-driven, not decorative.

### TASK-P9-POLISH

Status: Done at code level  
Priority: Medium  
Description: Phase 9 реализована: VPS Docker production artifacts, public `/api/health`, Prisma baseline migration, responsive table polish, shared XLSX export helper and updated deployment docs.  
Next step: Real VPS rollout and production migration only after explicit confirmation.  
Related files: `Dockerfile`, `docker-compose.prod.yml`, `.env.production.example`, `deploy/nginx/nimbaos.conf`, `src/lib/xlsx/export.ts`, app UI modules, docs  
Risks: Do not run production migrations or live WB jobs as part of code-level verification.

### TASK-P8-BACKGROUND-SYNC

Status: Done at code level  
Priority: Medium  
Description: Phase 8 реализована: Bull MQ очередь `sync`, история `SyncJobRun`, worker, scheduler, мини-экран `/sync`, ручной запуск read-only WB sync и перевод существующих sync-кнопок на фоновые jobs.  
Next step: Применить schema к dev DB (`db push`/migration) только после явного подтверждения и затем выполнить live smoke для одного read-only job.  
Related files: `src/lib/queue`, `src/lib/actions/sync.ts`, `scripts/sync-worker.ts`, `scripts/schedule-sync.ts`, `src/app/(dashboard)/sync`, `prisma/schema.prisma`  
Risks: Redis/PostgreSQL должны быть подняты; historical/full sync не запускается автоматически.

### TASK-P7-COMPLETE

Status: Done  
Priority: High  
Description: Phase 7 доведена на уровне кода: pause action, per-nm advertising spend, report integration, debug script, WB client long-429 protection.  
Next step: Live verification after rate-limit.  
Related files: `docs/DEV_LOG.md`, `docs/BUGS_AND_INCIDENTS.md`  
Risks: Live data may reveal WB response shape differences.
