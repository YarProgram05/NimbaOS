# Bugs And Incidents

## BUG-013: Stock risk classification did not show normal stock state

Status:
Fixed

Symptoms:
On `/stocks`, filtering by normal stock state (`В норме`) could return no products, while stock states looked too pessimistic or not useful for operational reading.

Affected area:
Stock analytics in `src/lib/services/stocks.ts` and `/stocks` labels.

Investigation:
The old calculation used only `wb_sales` for recent demand. If that source had incomplete coverage while financial reports were fresher, average daily sales was understated. The old risk logic also marked every zero-stock product as `Нет остатка`, even with no recent demand, and treated coverage above 60 days as `Излишек`, which was too aggressive for low-volume apparel stock.

Fix:
Risk now uses local DB sources only: recent non-return `wb_sales` and sale quantities from `realization_reports`, taking the stronger 30-day signal by `nmId`. Size rows use financial-report barcode sales when available. `Нет остатка` means zero total sellable stock; `В норме` is positive stock with 14-120 days of coverage; `Излишек` requires more than 120 days and at least 10 units; positive stock without recent demand is `Нет продаж`. `/stocks` also supports multi-select category filtering.

Verification:
`npm run type-check` passed.

Related files:
`src/lib/services/stocks.ts`, `src/app/(dashboard)/stocks/stocks-client.tsx`, `src/lib/services/dashboard-export.ts`

## BUG-012: Financial report cost price missing after Finance API migration

Status:
Fixed

Symptoms:
Some sold products showed `Себестоимость = 0` in the financial report even though their cost price existed in the reference table. For 2026-06-02 - 2026-06-03 this affected three Galioni products, including `парео зеленое/вискоз`, and two Nimba products.

Affected area:
Financial report reference matching in `src/lib/services/report-calculator.ts`.

Investigation:
WB Finance API returned `vendorCode` in lowercase, for example `парео зеленое/вискоз`, while `cost_prices` preserved the product card casing, for example `Парео зеленое/вискоз`. Report calculation used exact case-sensitive map keys, so cost price and other vendor-code references were not found. The same mismatch affected three sold Galioni articles and two sold Nimba articles for the checked period.

Fix:
Reference lookups now normalize vendor codes with trim, Unicode NFKC normalization and Russian-aware lowercase matching. The normalization applies to cost prices, self-purchases, external advertising, article overrides and product-to-vendor lookup. Normalized duplicate codes are deduplicated, and the most recently updated cost wins if equivalent normalized cost entries exist.

Verification:
For 2026-06-02 - 2026-06-03, both accounts now have zero sold report rows with missing cost price. `парео зеленое/вискоз` correctly shows `1478.00` for two bought units at `739.00` each. DB-only report calculation for 2026-01-01 - 2026-06-03 found no net-bought product without a linked cost price.

Related files:
`src/lib/services/report-calculator.ts`

## BUG-011: Scheduled automation skipped the first same-day run

Status:
Fixed

Symptoms:
After setting `Утренний отчет WB` to a near-future Moscow time such as `14:03`, the UI later showed the next run on the following day, but no scheduled run was created at `14:03`.

Affected area:
BullMQ job scheduler setup for automation and sync schedules.

Investigation:
The workflow was saved at `14:01` MSK with time `14:03`. The BullMQ scheduler had pattern `0 3 14 * * *`, `tz: Europe/Moscow`, and `startDate` equal to the exact first intended occurrence. BullMQ treated that occurrence as the lower boundary and scheduled the next one for the following day. Completed jobs confirmed there was no scheduled `14:03` run. A temporary scheduler test without `startDate` for a near-future Moscow time scheduled the same-day occurrence correctly.

Fix:
Removed `startDate` from BullMQ cron scheduler setup in automation and sync schedules. The cron pattern plus `tz: Europe/Moscow` now controls the next occurrence.

Verification:
`npm run type-check` and `npm run lint` passed. Temporary BullMQ scheduler test for `14:08` MSK created a delayed job for the same day with about 72 seconds delay.

Related files:
`src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`

## BUG-010: Morning WB workflow did external sync and could hang

Status:
Fixed

Symptoms:
Scheduled `Утренний отчет WB` could stay `RUNNING` for a long time even though the expected workflow is only DB-to-Google-Sheet filling. Runtime varied heavily between runs.

Affected area:
Morning WB automation source preparation and report calculation.

Investigation:
The workflow called sync services when coverage was missing: realization report, paid storage, orders, sales-plan/orders/sales, advertising campaigns/stats and current stocks. `getMorningReportData` also used report calculation options that preferred live WB advertising cost totals, so daily Google Sheet row calculation could call WB Advertising API even after coverage checks. The latest scheduled run was stale in DB: BullMQ had already completed/skipped the job, but `AutomationRun` remained `RUNNING`.

Fix:
Morning workflow is now DB-only. It checks report/ad coverage and latest stock snapshot, then fails fast with an explicit message if data is missing or stale; it no longer calls WB sync services. Sales-plan coverage/sync was removed from this workflow because the Google Sheet does not use sales plans. Morning report calculation now uses persisted ad stats only (`preferLiveAdCostTotals: false`). The stale `AutomationRun` `fb1825f9-a865-491f-8720-6dc951dac1e0` was marked `FAILED` after confirming the BullMQ job was already completed/skipped.

Verification:
`npm run type-check` and `npm run lint` passed. Checked BullMQ automation queue: no active jobs; one future delayed repeat job remains. Checked local coverage for 2026-05-01 - 2026-05-25: report and advertising coverage exist for both accounts; sales-plan coverage was intentionally not required.

Related files:
`src/lib/services/morning-wb-report-workflow.ts`, `src/lib/services/morning-report.ts`

## BUG-009: Automation next run displayed outside Moscow time

Status:
Fixed

Symptoms:
On `/automations`, a workflow configured for `13:28` MSK displayed `Следующий запуск: 26 мая 10:28`.

Affected area:
Automation and sync schedule UI next-run formatting.

Investigation:
There were two timezone issues. First, the client formatted `nextRunAt` in the browser/runtime local timezone instead of `Europe/Moscow`. Second, backend `getNextRunAt` manually added/subtracted 3 hours using the host timezone offset, which double-shifted the result on a Moscow-time host.

Fix:
`formatNextRun` in `/automations` and `/sync` now formats with `Intl.DateTimeFormat` using `timeZone: 'Europe/Moscow'`. Backend schedule helpers now use `src/lib/time/moscow.ts` to calculate next run and lateness from Moscow calendar parts without depending on the server local timezone.

Verification:
`npm run type-check` and `npm run lint` passed. A local `getNextMoscowRunAt('13:28', 2026-05-26T09:00:00.000Z)` check returned `2026-05-26T10:28:00.000Z`, which formats as `26 мая, 13:28` in Moscow time. Lint still reports pre-existing `<img>` warnings outside this change.

Related files:
`src/lib/time/moscow.ts`, `src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`, `src/lib/queue/automation-processor.ts`, `src/lib/queue/sync-processor.ts`, `src/app/(dashboard)/automations/automations-client.tsx`, `src/app/(dashboard)/sync/sync-client.tsx`

## BUG-008: Morning WB automation fill edge cases after first live run

Status:
Fixed

Symptoms:
First live `Утренний отчет WB` runs exposed three issues: on 2026-05-25 the daily block filled only through 2026-05-23 instead of the previous day 2026-05-24; the summary cells for `Отработано`, `Всего дней`, `Осталось` were not filled in `A43:C43`; separate manual runs took very different times, with `WB Galioni` around 142 seconds and `WB Nimba` around 988 seconds.

Affected area:
Morning WB automation workflow and Google Sheet fill contract.

Steps to reproduce:
Configure Google Sheets service-account access, run `Утренний отчет WB` manually for one account, then run it for the second account shortly after the first run completes.

Investigation:
Target-date calculation mixed Moscow local midnight with UTC formatting, so on a Moscow-time host the previous-day target could become one day earlier in ISO format. The workflow also did not write the month progress cells in `A43:C43`. The Nimba slowdown needs live timing confirmation, but the workflow could perform duplicate `orders` sync for the same monthly range when both report and sales-plan coverage were missing.

Fix:
`getTargetDate` now derives the Moscow calendar date through `Intl.DateTimeFormat(..., timeZone: 'Europe/Moscow')` and subtracts one UTC calendar day, so 2026-05-25 morning targets 2026-05-24. The writer fills `A43:C43` with worked days, total month days and remaining days. Source preparation keeps the DB-first rule: it checks local coverage first, calls WB sync services only for missing coverage, skips duplicate `orders` sync for the same range, limits forced orders backfill to <=31 days, and records per-step timings in `AutomationRun.result`.

Verification:
`npm run type-check` passed.

Related files:
`src/lib/services/morning-wb-report-workflow.ts`, `src/lib/services/morning-report.ts`, `src/lib/queue/automation-processor.ts`, `docs/core/SCHEDULED_AUTOMATION.md`

## 2026-05-25 - BullMQ missing lock on report sync job 316

### Context
Manual Galioni `REPORTS_PERIOD` sync for `2026-01-01` - `2026-05-24` displayed as running for about 40 minutes. Terminal showed `Missing lock for job 316. moveToDelayed`.

### Cause
The report sync had been changed to force a full `wb_orders` backfill. For a long period this made the job much heavier on the WB Statistics endpoint, and BullMQ lost the active job lock during delayed/retry handling. Redis job state and local `SyncJobRun` diverged.

### Fix
Increased sync worker lock duration/stalled interval and limited forced orders backfill to periods up to 31 days. Stuck run `316` was marked failed; prior successful run `315` had already populated ordered rubles.

### Verification
`npm run type-check` passed. `calculateReport` for Galioni `2026-01-01` - `2026-05-24` returned `Заказано руб.` = 1846684.89, `Продажа` = 1571692.94, coverage ready.

Формат новых записей:

```md
## BUG-XXX: title

Status:
Open / Investigating / Fixed / Won't fix

Symptoms:
...

Affected area:
...

Steps to reproduce:
...

Investigation:
...

Fix:
...

Related files:
...
```

## BUG-007: Advertising period stayed partial after account-wide stats sync

Status:
Fixed

Symptoms:
Advertising analytics period could stay partial after sync.

Affected area:
Advertising sync coverage and dashboard analytics.

Investigation:
Account-wide coverage should be marked only after all campaign stats complete.

Fix:
Handled in advertising sync hardening before this documentation rebuild.

Related files:
`src/lib/services/sync-ad-stats.ts`, `src/lib/sync/coverage.ts`

## BUG-006: Advertising stats/clusters failed for null stats and >30-day cluster periods

Status:
Fixed

Symptoms:
Worker failed on null `fullstats`; cluster sync failed on periods above WB API limits.

Affected area:
Advertising worker sync.

Fix:
Null stats treated as empty; cluster requests chunked to <=30-day periods and aggregated locally.

Related files:
`src/lib/services/sync-ad-stats.ts`, `src/lib/services/sync-ad-clusters.ts`

## BUG-005: Product card sync can leave prices blank after WB price rate limits

Status:
Open

Symptoms:
Product cards may have missing prices if price API is rate-limited.

Affected area:
Product sync and cards UI.

Investigation:
Needs live verification and retry/refresh policy.

Fix:
Not finalized.

Related files:
`src/lib/services/sync-products.ts`, `src/lib/wb-api/products.ts`

## BUG-004: Phase 8 sync jobs still need full smoke verification

Status:
Investigating

Symptoms:
Some job types were diagnosed/fixed, but all read-only jobs have not been verified as a matrix.

Affected area:
BullMQ sync worker.

Related files:
`src/lib/queue/sync-processor.ts`, `scripts/sync-worker.ts`, `/sync`

## BUG-003: Legacy docs were too large for startup context

Status:
Fixed

Symptoms:
Agents were tempted to read too many `.md` files at startup.

Affected area:
Documentation memory.

Fix:
3-zone documentation split and new startup rule.

Related files:
`AGENTS.md`, `docs/DOCS_INDEX.md`

## BUG-002: `next dev` may hang at Starting

Status:
Open

Symptoms:
Old docs mention local dev server can hang at `Starting...`.

Affected area:
Local development.

Investigation:
Needs environment-specific repro.

Related files:
`docs/development/TROUBLESHOOTING.md`

## BUG-001: WB advert API long 429 retry

Status:
Open

Symptoms:
WB advert API can return long rate-limit windows.

Affected area:
Advertising live verification and sync.

Fix:
Fail fast/log/retry later policy is documented; live verification still needed.

Related files:
`src/lib/wb-api/advertising.ts`, `src/lib/wb-api/client.ts`
