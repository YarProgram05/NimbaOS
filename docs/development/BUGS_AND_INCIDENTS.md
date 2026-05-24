# Bugs And Incidents

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

