# Bugs and Incidents

## BUG-007: Advertising period stayed partial after account-wide stats sync

Status:
Fixed

Symptoms:
Dashboard/data freshness could still show incomplete advertising coverage after a full selected-period advertising stats sync.

Affected area:
Background sync coverage, dashboard freshness, advertising analytics.

Investigation:
The worker wrote campaign stats but did not mark `SyncDataCoverage` for account-wide `advertising.stats` jobs. Single-campaign syncs also needed to stay excluded from account-wide coverage.

Fix:
Account-wide advertising stats jobs now mark coverage only after all campaign stats finish without errors. Single-campaign syncs update rows but do not mark the full account period as complete.

Related files:
`src/lib/queue/sync-processor.ts`, `src/lib/services/dashboard-summary.ts`, `src/app/(dashboard)/analytics/advertising/page.tsx`

## BUG-006: Advertising stats/clusters failed in worker for null stats and >30-day cluster periods

Status:
Fixed at code level

Symptoms:
`/sync` history showed failed advertising jobs. Observed messages included `Cannot read properties of null (reading 'flatMap')` for advertising stats and WB API 400 `date range must not exceed 30 days` for advertising clusters.

Affected area:
Background sync worker, advertising stats service, advertising clusters service, WB advert API wrapper.

Investigation:
The worker was running and processing jobs. Failures came from service-level assumptions: WB may return `null` for fullstats with no data, and the cluster endpoint rejects periods longer than 30 days.

Fix:
Fullstats `null` is normalized to an empty dataset. Cluster sync now chunks long selected periods into <=30-day WB API requests, aggregates the responses, and persists the aggregate under the selected period.

Related files:
`src/lib/services/sync-ad-stats.ts`, `src/lib/services/sync-ad-clusters.ts`, `src/lib/wb-api/advertising.ts`, `src/lib/services/report-calculator.ts`

## BUG-004: Phase 8 sync jobs still show WB/API and Prisma failures

Status:
Partially fixed

Symptoms:
`/sync` history can show failed or queued jobs for reports, advertising campaigns and advertising stats. Observed messages include WB API rate-limit errors and `Invalid prisma.adCampaignNmStat...` from advertising stats persistence.

Affected area:
Background sync worker, BullMQ retry handling, advertising stats write path, WB rate-limit handling.

Investigation:
Phase 8 moved read-only sync into BullMQ. This exposed two classes of problems: WB domains can return long `429` retry windows, and some sync services previously hid internal failures inside result objects. Worker handling was tightened so internal `errors > 0` no longer becomes a false success. `WB API rate limit exceeded on domain ...` means WB temporarily throttled requests for that API domain; it is expected during heavy sync bursts and should be retried after the WB-provided retry window.

Fix:
Partially fixed. Queue now avoids duplicate active jobs and requeues long WB rate-limit failures according to WB retry timing. On 2026-05-05 the `adCampaignNmStat` numeric overflow was fixed at code level by normalizing non-finite, over-precision, and out-of-range advertising metrics before Prisma upserts. The `/sync` screen can delete non-running queue/history items. Remaining work is live read-only verification after WB rate limits clear.

Related files:
`src/lib/queue/sync-processor.ts`, `src/lib/queue/sync-jobs.ts`, `src/lib/services/sync-ad-stats.ts`, `src/app/(dashboard)/sync`

## BUG-005: Product card sync can leave prices blank after WB price rate limits

Status:
Fixed at code level

Symptoms:
The `/cards` table shows products, but many rows have `—` in the price column. In the database these rows have `product_sizes.price = null`.

Affected area:
Product sync, WB prices domain, `/cards` price display.

Investigation:
Cards and prices are fetched from different WB domains. Cards can sync successfully while the `prices` domain returns `WB API rate limit exceeded on domain "prices"` with a long retry window. The previous product sync also replaced size rows before the price refresh, so a card refresh could erase previously known prices if the price endpoint was unavailable or omitted a product from the batch response.

Fix:
Product sync now preserves existing size prices while refreshing card sizes, falls back from batch price loading to single-article price loading for missing articles, and rethrows WB price rate limits so the queue can delay/retry the job instead of turning the rate limit into a partial internal error.

Related files:
`src/lib/services/sync-products.ts`, `src/lib/wb-api/products.ts`, `src/app/(dashboard)/cards`

## BUG-001: WB advert API long 429 retry

Status:
Investigating

Symptoms:
Live advertising debug check returns `WbRateLimitError` / HTTP `429` with `x-ratelimit-retry` around 40+ minutes.

Affected area:
Advertising campaign sync, `fullstats`, clusters, log checks, Phase 7 live verification.

Steps to reproduce:
Run advertising live-check or request WB advert campaign list while the account is rate-limited.

Investigation:
WB advert API responded with a long retry window. The WB API client was adjusted in the previous code task to avoid waiting for very long retry windows interactively.

Fix:
Short retry windows may be retried automatically. Long retry windows should fail fast with a clear rate-limit error. Full live verification must be repeated later.

Related files:
`src/lib/wb-api/client.ts`, `scripts/debug-advertising.ts`, `docs/CURRENT_TASKS.md`

## BUG-002: `next dev` hangs at Starting

Status:
Monitoring

Symptoms:
Local `next dev` opened port `3000`, but HTTP requests timed out and log stayed at `Starting...`.

Affected area:
Local development server verification.

Steps to reproduce:
Start local dev server and request `http://localhost:3000` or `/advertising`.

Investigation:
Observed during Phase 7 final check. Process was stopped to avoid leaving a hanging server. On 2026-05-05 a fresh `next dev` check on port 3010 reached `Ready` in about 3 seconds and `/login` returned HTTP 200, so the hang was not reproduced.

Fix:
No code fix needed in this pass because the issue did not reproduce. On recurrence, inspect dev server logs, running Node processes, port ownership, `.next` cache state, and environment loading without printing secrets.

Related files:
`docs/COMMANDS.md`, `.next` logs if generated locally

## BUG-003: Legacy docs were too large for startup context

Status:
Fixed

Symptoms:
Old `AGENTS.md` and `CLAUDE.md` mixed startup rules, project status, phase history, commands, bugs, WB facts, and implementation notes. Future agents would over-read and duplicate context.

Affected area:
Codex session startup and project memory.

Steps to reproduce:
Start a new session and ask the agent to read old `AGENTS.md` and old root `SPECIFICATION.md`; context becomes noisy.

Investigation:
Documentation was reorganized into short startup files plus task-specific docs.

Fix:
`docs/AGENTS.md` shortened and moved into `docs`; `docs/DOCS_INDEX.md`, `docs/HANDOFF.md`, and related docs created.

Related files:
`docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md`
