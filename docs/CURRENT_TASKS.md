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
