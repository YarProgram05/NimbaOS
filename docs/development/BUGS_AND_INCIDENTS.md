# Bugs And Incidents

## BUG-033: Main dashboard did not adapt to normal-window and fullscreen heights

Status:
- Fixed locally on 2026-09-01.

Symptoms:
- At 100% browser zoom in the owner's normal Full HD Chrome window, the main dashboard showed a vertical scrollbar.
- An initial fixed-height correction removed that scrollbar for one viewport but left excessive empty space below the dashboard in browser fullscreen.
- An initial elastic-height pass compressed vertically stacked content below the desktop width breakpoint, visibly overlapping the chart, distributions and following cards.

Root cause:
- The page requested a 12 px section gap, but the shared `.dashboard-page` utility won the CSS cascade and applied 16 px.
- The compact dashboard chart used a fixed pixel height and the page did not distribute additional or reduced viewport height among its rows.

Resolution:
- At `xl` desktop width, made the page fill the available main height and the chart/focus row consume remaining space.
- Made the compact chart and distribution cards fill that flexible row only at desktop width; narrower layouts use natural stacked height and a stable compact chart height. The full analytics chart remains unchanged.
- Added a height breakpoint that compacts only gaps and panel padding below 1000 px, preserving every metric and detail row.
- Browser measurements at 1920x952, 1920x1001 and 1920x1080 report equal main `scrollHeight` and `clientHeight`. At 990x909, all adjacent section/panel/chart overlap measurements are zero and vertical scrolling is normal. No tested size has horizontal overflow or console errors.

Prevention:
- Verify responsive dashboard changes at both normal-window and fullscreen heights, including the exact breakpoint, instead of validating one static viewport.
- Also verify the width breakpoint where multi-column desktop panels become a vertical stack; do not retain desktop height constraints across that transition.
- Preserve real vertical scrolling on smaller viewports; do not hide overflow to mask layout bugs.

## BUG-032: CI prerendered the database-backed automations page

Status:
- Fixed and confirmed by GitHub Actions CI run `33450459678` on 2026-09-01.

Symptoms:
- GitHub Actions CI run `33449872826` passed TypeScript, 51 tests and lint, then failed `next build` while generating `/automations`.
- Prisma returned `ECONNREFUSED` for `automationRun.count()` and workflow-setting upserts because the CI runner intentionally has no PostgreSQL service.

Root cause:
- The new database-backed `/automations` route was eligible for static prerendering, so Next.js executed its Prisma reads during build instead of only at request time.

Resolution:
- Added `export const dynamic = 'force-dynamic'` to `/automations` and `/automations/[kind]`.
- The complete local CI command sequence now passes and the route table marks both pages dynamic.
- Follow-up CI run `33450459678` completed successfully in 2m 49s.

Prevention:
- Any new App Router page that performs unconditional request-time database reads must be explicitly dynamic unless its static-build behavior is separately designed and tested.

## BUG-031: Local `next dev` loses CSS after concurrent production build

Status:
- Resolved locally on 2026-08-31; prevention documented.

Symptoms:
- Authenticated localhost pages rendered as unstyled HTML while React content and navigation remained present.
- `/_next/static/css/app/layout.css?...` returned HTTP 404 and `document.styleSheets` contained no loaded application stylesheet.

Root cause:
- `npm run build` was run while `next dev` was already serving the same checkout. Both processes share `.next`; the production build replaced generated dev artifacts while the old dev process still referenced its previous CSS URL.

Resolution:
- Verified that port 3000 belonged to this repository's local `next dev`, stopped only that local process tree and restarted it from the project directory.
- Reloaded the authenticated in-app-browser page. The regenerated stylesheet returned HTTP 200 with 106,095 bytes and exposed 164 CSS rules; the normal sidebar, cards, tables, fonts and colors returned.

Prevention:
- Do not run `npm run build` concurrently with `npm run dev` in the same checkout. Stop dev before build, or restart dev immediately after build before browser QA.

## BUG-030: Public login page did not hydrate and could hang on sign-in

Status:
- Root cause confirmed on 2026-08-24; public Cloudflare path remains unsuitable for Russian IPv4 clients.

Symptoms:
- `app.nimbaos.ru/login` could render without styles or keep loading after the user pressed `Войти`.
- When JavaScript failed to hydrate, the login form behaved like a native browser form instead of the Next.js client form.

Root cause:
- Russian IPv4 paths to Cloudflare are throttled/terminated after roughly the first 16-24 KB of a response. The production login HTML and small auth responses complete, but larger Next.js JavaScript chunks stop mid-transfer, so React never hydrates and the form falls back to native browser submission.
- The failure is independent of credentials, NextAuth, the database and the Cloudflare Tunnel transport. A cached 124,727-byte JavaScript asset repeatedly stopped at 24,576 bytes from the affected client, while four explicit byte ranges completed immediately.
- The mini-PC can fetch the same public asset over IPv6, and the trusted laptop can fetch it directly through Tailscale, proving that the application and origin file are healthy.

Resolution:
- Removed `app.nimbaos.ru` from the obsolete `nimbaos-proxy` Worker custom domains and restored its proxied Tunnel DNS record. This also removed the Worker's unsafe caching of `/api/auth/csrf`; public auth responses again carry `private, no-cache, no-store`, `Set-Cookie` and `cf-cache-status: DYNAMIC`.
- Restored the automatic Windows `Cloudflared` service to `QUIC` over IPv6 after controlled IPv4/HTTP2 comparison. The connector is healthy, but changing connector transport cannot bypass throttling between Cloudflare and the end user.
- Use the direct Tailscale Serve URL or the trusted laptop's local SSH tunnel for current private operation. The durable no-VPS public solution is a public/static IPv4 from the ISP plus direct HTTPS with Cloudflare proxying disabled; otherwise use a non-Cloudflare relay/VPS.

Verification:
- Local origin asset: HTTP 200, 124,727/124,727 bytes in 0.007 seconds.
- Direct Tailscale asset: HTTP 200, 124,727/124,727 bytes in 0.75 seconds.
- Public asset from the affected Russian IPv4 client: HTTP 200 headers followed by a timeout at 24,576/124,727 bytes, including on a Cloudflare cache HIT.
- Public `/api/auth/csrf` is correct and an intentionally invalid credentials request returns HTTP 401 in about 0.3 seconds. The visible login failure occurs earlier because the browser does not receive the client bundle.

Related files:
- `infra/cloudflare/nimbaos-proxy/src/index.js`, `docs/development/DEV_HANDOFF.md`

## BUG-029: Second account advertising sync is skipped after queue wait

Status:
- Resolved and live-verified on the mini-PC on 2026-08-21.

Symptoms:
- The scheduled morning report filled `WB Nimba` but failed `WB Galioni` with missing local advertising coverage for `2026-08-01 - 2026-08-20`.
- Galioni's `ADVERTISING_STATS` coverage remained at `2026-08-12` even though the other nightly jobs ran for both accounts.

Root cause:
- Both accounts schedule `ADVERTISING_STATS` for 05:00 MSK and the sync worker intentionally has concurrency 1.
- Nimba ran first for 14 minutes 52 seconds. Galioni then reached `processSyncJob` 14 minutes late.
- `SCHEDULED_START_GRACE_MINUTES = 10` treats queue wait as stale-schedule lateness, so the Galioni BullMQ job completed as `skippedScheduledJob` before a `SyncJobRun` row was created.
- The 10:00 automation correctly rejected Galioni because its advertising coverage had not advanced.

Resolution:
- Replaced the duplicated 10-minute guards in sync and automation processors with one shared scheduled-job policy. The default grace is now 1080 minutes (18 hours), configurable through `SCHEDULED_START_GRACE_MINUTES` and capped at 1439 minutes so a stale daily occurrence cannot overlap the next day's occurrence.
- Added regression tests for the default boundary, the observed 14-minute queue wait, custom values, invalid values and the below-one-day cap. Type-check, focused lint and compose validation passed.
- Deployed commit `bb139f9`; both production workers report `SCHEDULED_START_GRACE_MINUTES=1080` and started normally.
- With owner approval, ran only Galioni advertising stats for `2026-08-07 - 2026-08-21`. Run `28d4ba91-cea7-4de1-97e7-1c3ba2d23b80` succeeded on the first attempt with zero campaign errors and advanced Galioni coverage through `2026-08-21`.
- Re-ran the morning report for target date `2026-08-20`. Run `a9dfd0a9-dfb7-4464-ace9-a477eeb83e5e` succeeded for both accounts with zero failures and wrote 20 rows to each of `WB Nimba` and `WB Galioni`.

Prevention:
- Keep sync worker concurrency at 1 to respect WB limits; legitimate same-time account jobs can now wait safely in the queue.
- Keep the grace below one daily cycle and verify both account coverage rows before treating a partial report as a Google Sheets failure.

Related files:
- `src/lib/queue/scheduled-job-policy.ts`, `src/lib/queue/sync-processor.ts`, `src/lib/queue/automation-processor.ts`, `docker-compose.prod.yml`

## BUG-028: Production automation schedule has no worker or Google credential

Status:
- Resolved on the mini-PC on 2026-08-21.

Symptoms:
- `Утренний отчет WB` appears scheduled for 10:00 MSK, but it would not execute on the mini-PC.

Root cause:
- The production compose stack runs only the sync worker; the separate BullMQ `automation` queue has no worker process.
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is not injected into the running production app image, so the Google Sheets client cannot authenticate.

Required fix:
- Added and deployed the permanent `automation-worker` service, injected the Google service-account credential through `.env.production` without exposing it, and re-applied the automation schedule.
- The worker starts successfully and the queue had no waiting or active jobs at startup; one future delayed scheduled job remains registered.
- Initial deployment intentionally avoided a report while coverage was incomplete. After `BUG-029` recovery, live run `a9dfd0a9-dfb7-4464-ace9-a477eeb83e5e` verified both mapped sheets successfully.

Prevention:
- Start `automation-worker` with the production stack and re-apply automation schedules after recreating the Redis data volume.
- Keep the real Google credential only in untracked environment files.

Related files:
- `docker-compose.prod.yml`, `scripts/automation-worker.ts`, `scripts/schedule-automations.ts`, `src/lib/google/sheets.ts`

## BUG-027: Restored production schedules existed only in PostgreSQL

Status:
- Resolved on the mini-PC on 2026-08-21.

Symptoms:
- Neither cabinet started the enabled `Карточки` synchronization at 02:00 MSK.
- The sync worker was healthy but had no job activity.

Root cause:
- PostgreSQL contained the enabled `SyncScheduleSetting` rows, but Redis had no BullMQ job schedulers or delayed jobs. Database schedule settings describe the intended schedule; they do not recreate executable Redis scheduler metadata by themselves.

Resolution:
- Re-applied all production sync schedules from the database through `scripts/schedule-sync.ts` using the existing app image.
- Registered 16 enabled schedulers for two active accounts.
- Manually ran both missed product-card jobs; both succeeded on the first attempt with zero errors.

Prevention:
- After restoring/recreating the Redis data volume, run the production schedule application command and verify both `bull:sync:repeat` and `bull:sync:delayed` are populated.

Related files:
- `src/lib/sync/schedules.ts`, `scripts/schedule-sync.ts`, `docker-compose.prod.yml`, `docs/core/COMMANDS.md`

## BUG-026: Cloudflare Tunnel becomes externally unreachable behind MGTS double NAT

Status:
- Open. The connector is currently stable over QUIC/IPv6, but Cloudflare remains unsuitable as the public response path for affected Russian IPv4 clients; see `BUG-030`.

Symptoms:
- The Windows `cloudflared` service registers four connections and its local readiness endpoint reports four ready replicas, but `app.nimbaos.ru` quickly changes from HTTP 200/502 to 530/1033.
- Windows can retain four apparently `Established` TCP connections to Cloudflare port 7844 after Cloudflare no longer routes public requests through them.

Affected area:
- Mini-PC production ingress only. Docker PostgreSQL, Redis, Next.js app and worker remain healthy; local `/api/health` returns 200.

Investigation:
- Reproduced with HTTP2 and QUIC, the installed Windows connector and a newer Docker connector, normal DME edges and forced US `ewr/ord` edges.
- Temporarily lowering/disabling the ZTE firewall and Anti-DoS did not help.
- After moving the mini-PC to Keenetic, the route was `192.168.2.1 -> 192.168.1.1 -> 100.90.0.1`, proving both double NAT and MGTS CGNAT; the ZTE is not a transparent bridge.
- Repeated on 2026-08-23 with Wi-Fi disconnected and the mini-PC attached to Keenetic by 1 Gbps Ethernet. HTTP2 served one request before its control streams closed; QUIC timed out after about five seconds. Local app health remained 200, confirming that Wi-Fi and the Docker origin are not the cause.
- Keenetic inspection showed that this Ethernet cable terminates on the Keenetic LAN, while Keenetic's active internet uplink remains the WISP Wi-Fi profile `local` toward ZTE. Setting that active profile to always-on, assigning permanent client IP `192.168.2.82`, and updating Windows `cloudflared` from `2026.5.2` to `2026.8.2` did not stop the edge-connection flapping.
- The owner updated Keenetic from developer `5.2 Alpha 5` to `5.2 Alpha 6`. After reboot, RMM showed the router online, but a sustained external check returned five HTTP 502 responses and then nineteen HTTP 530 responses; local application health stayed 200 and Cloudflared again logged disconnected control streams.
- The controlled ZTE LAN -> Keenetic Internet/WAN test was completed. Keenetic received `10.49.27.58/21` through `10.49.24.1` instead of the expected ZTE LAN address `192.168.1.x`; Cloudflare DNS was filtered to `172.16.24.100`, and Netcraze, Tailscale and Cloudflared became unreachable. Disconnecting the cable restored the WISP route and remote access. A subsequent Cloudflared restart registered four connections, but public health still alternated among HTTP 200, 530 and timeouts.
- AnyDesk also remained offline after route recovery because its running service retained the poisoned `172.16.24.100` DNS result. Clearing the Windows DNS cache and restarting the AnyDesk service restored a stable public TLS relay connection and incoming remote access.
- A later controlled test used a normal ZTE LAN1 port. Keenetic received `192.168.1.19`, promoted Ethernet to primary, retained WISP as reserve and passed 12/12 remote-access checks. Native Cloudflared still lost its edge streams, proving that the corrected cable and lease alone do not resolve this provider-specific connector failure.

Resolution:
- An interim path through `Cloudflare Worker nimbaos-proxy -> Tailscale Funnel` passed small health checks and some browser checks, but larger static responses remained unreliable. It did not constitute a final resolution.
- On 2026-08-24 the Worker custom domain was removed and the native Tunnel DNS record was restored. Cloudflared now runs automatically over QUIC/IPv6. This is useful for diagnosis but does not make `app.nimbaos.ru` production-ready because `BUG-030` occurs on the Cloudflare-to-user segment.
- Keep the normal ZTE LAN1 Ethernet uplink primary and WISP as reserve. Current reliable access is direct Tailscale or the trusted laptop SSH tunnel. For public access without a VPS, request a public/static IPv4 from MGTS, terminate HTTPS directly on the mini-PC and use DNS-only records.

Related files:
- `infra/cloudflare/nimbaos-proxy/src/index.js`, `infra/cloudflare/nimbaos-proxy/wrangler.jsonc`, `docker-compose.prod.yml`, `Dockerfile`, `docs/development/DEV_HANDOFF.md`

## BUG-025: CRPT withdrawal XLSX omitted required unit price

Status:
- Fixed and historical downloads repaired on 2026-08-13.

Symptoms:
- Chestny Znak accepted the marking-code list but required `Цена за единицу с НДС` for every withdrawal row.
- Existing NimbaOS withdrawal exports contained only `Код маркировки`.

Root cause:
- The initial bulk-file implementation followed the minimal marking-code example and did not include the price field required by the selected CRPT remote-sale withdrawal form.

Fix:
- Added numeric per-unit price from the linked WB FBS order (`convertedPriceRaw / 100`) to withdrawal exports.
- Added no VAT markup; the seller uses VAT 0% and the WB seller-currency price is exported as the final amount.
- Return-to-circulation exports remain code-only. Missing/zero prices now fail the export explicitly.
- Rebuilt four earlier downloads as separate `_с_ценами.xlsx` files while preserving originals.

Verification:
- 9, 16, 163 and 179 rows matched without duplicates or missing prices; all four saved workbooks passed re-import and visual checks.
- `npm test`: 35/35; type-check passed; lint passed with two unrelated existing `<img>` warnings.

Related files:
`src/lib/fbs/compliance-export.ts`, `src/lib/fbs/compliance-export.test.ts`, `src/lib/services/fbs-operations.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`

## BUG-024: Post-handoff cancellation or defect showed a missing KIZ

Status:
- Fixed at code level on 2026-08-12.

Symptoms:
- Orders canceled by the client at pickup or marked defective displayed `Нет КИЗа` / `Нужен КИЗ`.
- KIZ values in FBS tables were masked and formatted differently from the CRPT XLSX.
- `UNKNOWN` circulation state was shown as ambiguous `Не определён`.

Root cause:
- `canceled_by_client` and `defect` were included in the pre-handoff cancellation set. If `shipmentApplied` was observed late, the state machine emitted `UNASSIGN_KIZ`.
- Workspace tables intentionally returned only `maskedCode`, even to authorized operators.
- New/imported WB codes correctly defaulted to local `UNKNOWN`, but the interface did not explain that the source lacked a confirmed CRPT state.

Fix:
- Classified pickup cancellation and defect as post-handoff returns regardless of a late shipment flag; they never release the KIZ assignment.
- Added order-table recovery from the latest withdrawal task or KIZ event for already processed history. The next operational sync can reattach a WB metadata code when WB still returns it.
- Authorized operators receive only `01GTIN21serial`; cryptographic AIs 91/92 remain excluded. Viewers remain masked.
- Renamed and explained `UNKNOWN`, clarified that CRPT primary-document fields without `*` are optional, and changed confirmation input to the number/ID of an already signed CRPT document.
- Added search and relevant filters to all FBS tabs.

Verification:
- `npm test`: 33/33 passed, including late-shipment pickup cancellation and defect tests.
- `npm run type-check`: passed.
- `npm run lint`: passed with two unrelated existing `<img>` warnings.
- 2026-08-13 bounded read-only audit found 57 affected historical units (29 Galioni, 28 Nimba): every unit came from `wb_fbs_metadata`, had a pickup-cancellation/defect order history, and none was a genuinely unassigned manual/scanner warehouse KIZ.

Related files:
`src/lib/fbs/state-machine.ts`, `src/lib/fbs/state-machine.test.ts`, `src/lib/services/fbs-workspace.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`, `src/types/fbs.ts`

## BUG-023: FBS analytics showed zero sales and transfer

Status:
- Fixed and read-only DB-verified on 2026-08-12.

Symptoms:
- Selecting dates in `/fbs` analytics and clicking `Применить` showed zero sales, returns and transfer despite existing FBS activity.
- The screen had no FBS order, cancellation or revenue cards.

Root cause:
- The query required `realization_reports.deliveryMethod` to contain `FBS` on the same row.
- WB Finance populates that field mainly on zero-quantity logistics rows. The connected `Продажа`/`Возврат` rows often have an empty delivery method but share the FBS order ID.

Fix:
- Match sale/return rows through `realization_reports.orderId = fbs_orders.externalOrderId`; retain a directly tagged sale/return row as a fallback.
- Added explicit FBS orders, cancellations, buyouts, returns, net revenue and net transfer metrics and clarified the different order-date/finance-date bases.
- Added isolated tests for order-ID matching, direct-tag fallback, return netting and cancellation classification.

Verification:
- `npm test`: 26/26 passed; `npm run type-check`: passed; `npm run lint`: passed with two unrelated existing `<img>` warnings.
- Read-only local DB calculation for 2026-08-01 - 2026-08-11 returned non-zero metrics for both active cabinets.

Related files:
`src/lib/fbs/analytics.ts`, `src/lib/fbs/analytics.test.ts`, `src/lib/services/fbs-workspace.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`, `src/types/fbs.ts`

## BUG-022: Nimba KIZs from July 28 were not created and metadata looked blocked

Status:
- Fixed and live-verified locally on 2026-07-30.

Symptoms:
- Nine Nimba FBS orders from 2026-07-28 were present as `complete/sorted`, required SGTIN and had no linked KIZ after a successful background sync.
- The order table displayed the generic metadata state `Заблокировано` even after WB returned and NimbaOS linked a KIZ.

Root cause:
- Two sync-worker process trees were still running code loaded before automatic WB SGTIN ingestion was implemented. Their job payload correctly covered 2026-07-26 - 2026-07-30, so the date range was not the cause.
- UI metadata readiness incorrectly required KIZ circulation state `IN_CIRCULATION`. Handed-over codes immediately become `WITHDRAWAL_REQUIRED`, so valid WB metadata was mislabeled as blocked.

Fix:
- Ran the bounded 2026-07-28 Nimba sync through the new implementation, safely stopped both stale worker trees after confirming zero active jobs, and started one current worker.
- Split WB metadata readiness from Chestny Znak circulation state. The table now shows `Получены`, `Нет КИЗа`, `Не подтверждено`, `Конфликт`, `Ошибка WB` or `Не требуются`, with a safe explanatory tooltip.
- Successful manual attachment now stores the same canonical `VALID` validation status as WB metadata readback.

Verification:
- Direct bounded sync created and assigned 9 KIZ units with 0 rejects, conflicts or GTIN mismatches.
- A queued worker job for the same date succeeded and reported 9 already assigned, 0 created and 0 assigned.
- Workspace readback shows 9/9 July 28 orders with KIZ and metadata label `Получены`, with 0 metadata issues.
- `npm test`: 23/23; TypeScript passed.

Related files:
`src/lib/fbs/metadata.ts`, `src/lib/services/fbs-workspace.ts`, `src/lib/services/fbs-operations.ts`, `src/app/(dashboard)/fbs/fbs-client.tsx`

## BUG-021: FBS statuses were untranslated and the assortment selector escaped the viewport

Status:
- Fixed on 2026-07-30.

Symptoms:
- Seller and WB order statuses were displayed as raw API values.
- The long FBS assortment dropdown extended below the visible screen.
- Stock and WB write-gate labels were ambiguous for operators.

Fix:
- Added centralized Russian labels for every documented seller/WB status and Russian action labels.
- Replaced the long catalog select with a searchable popover limited to 60% of viewport height with internal scrolling and collision padding.
- Clarified local stock metrics and renamed the write gate to explicit permission for WB operations.

Verification:
- `npm test`: 14/14.
- `npm run type-check`: passed.
- `npm run lint`: passed with two pre-existing unrelated `<img>` warnings.
- Authenticated visual browser verification remains pending because neither test browser had an active application session.

Related files:
`src/app/(dashboard)/fbs/fbs-client.tsx`, `src/lib/fbs/status-labels.ts`, `src/lib/fbs/status-labels.test.ts`

## BUG-020: FBS live read contracts did not match the current WB API

Status:
- Fixed and read-only verified locally on 2026-07-30.

Symptoms:
- `FBS_MARKING_REPORT` failed with WB API 405 and an `Allow: POST` hint.
- `FBS_OPERATIONAL` failed in `prisma.fbsSellerWarehouse.upsert()` because WB returned numeric `deliveryType` and `cargoType`, while Prisma expected strings.
- A stock job could finish successfully with zero updated rows when the preceding operational job had failed before creating warehouses and assortment.
- The `/fbs` page refreshed immediately after enqueueing a background job, before the job had actually completed.

Cause:
- The marking report wrapper used `GET /api/v1/analytics/excise-report`; the current WB contract requires POST with the period in query parameters.
- Live warehouse and supply classifier fields are numeric.
- Period FBS order parameters are Unix timestamps, not `YYYY-MM-DD` strings.
- Stock reconciliation queried only assortment already discovered from orders, so it was not independently capable of finding all positive FBS stock positions.

Fix:
- Changed the marking report call to POST.
- Added strict warehouse response normalization and converted numeric warehouse/supply classifiers to strings before Prisma persistence.
- Changed FBS status batches to 100 IDs, period dates to Moscow Unix timestamps and B2B parsing to support `options.isB2b`.
- Made stock reconciliation refresh seller warehouses and check all local catalog `chrtId` values, retaining existing zero-stock FBS positions and discovering new positive-stock positions.
- Added job completion polling and automatic `/fbs` refresh, plus a separate `Остаток WB` metric and an explanation that local physical stock is not overwritten by reconciliation.

Verification:
- 11 FBS tests pass and TypeScript passes.
- Read-only operational smoke test for the affected local cabinet returned 1 warehouse, 4 supplies and 12 orders for `2026-07-29`.
- Read-only marking smoke test returned 30 report rows and performed 8 matching updates; 7 current assortment positions are distinctly marked.
- Full stock smoke test checked 131 catalog sizes, retained/updated 16 FBS positions, discovered 9 new positions and read 215 WB stock units.
- After restarting the sync worker, an end-to-end queued `fbs.stocks.current` job succeeded with 16 updated positions and 215 WB stock units.
- No WB write endpoint, schedule or historical backfill was run.

## BUG-019: FBS Prisma migration was missing from the local database

Status:
- Fixed locally on 2026-07-30.

Symptoms:
- The application failed while opening a report with `Invalid prisma.realizationReport.findMany()` and `The column (not available) does not exist in the current database`.
- The runtime pointed to `src/lib/services/report-calculator.ts` where Prisma selected `RealizationReport`.

Cause:
- The generated Prisma Client and application code expected the new FBS fields on `realization_reports`, but migration `20260730120000_fbs_operations` had not been applied to the local development database.
- A Prisma `findMany` without an explicit `select` attempted to read the newly declared columns and failed before the page could render.

Fix:
- Confirmed that `20260730120000_fbs_operations` was the only pending migration.
- Applied it with `npx prisma migrate deploy --schema prisma/schema.prisma` to the local `wb_cabinet` development database only.

Verification:
- Direct read of `realization_reports.deliveryMethod` succeeds.
- The new `fbs_seller_warehouses` table is queryable.
- `http://localhost:3000` responds with HTTP 200.

Prevention:
- Deploy reviewed schema migrations before starting an application build that uses the corresponding generated Prisma Client.
- Keep the rollout order explicit: migration, Prisma generation/build, application start, then read-only smoke tests.
- Local migration recovery does not authorize production migration, FBS backfill, schedules, WB synchronization or WB write operations.

## BUG-018: pnpm from a nested report folder broke the root npm installation

Status:
Fixed; prevention rule documented.

Symptoms:
`npm run dev` first failed with `Cannot find module ... node_modules/next/dist/bin/next`. After `npm ci`, Next.js started but requests failed with `Cannot find module '.prisma/client/default'`.

Affected area:
Local development dependencies only (`node_modules`). Application source files, PostgreSQL data, migrations, WB data and report artifacts were not deleted or rewritten.

Investigation:
During one-off Excel report generation on 2026-07-25, a bundled `pnpm` command was run from a nested work folder that did not have an isolated `package.json`. It resolved the parent NimbaOS project and moved 38 direct npm-managed dependencies, including `next`, `react` and Prisma, into root `node_modules/.ignored`. A separate junction from the report work folder to a large bundled `node_modules` tree also made VS Code/Git enumerate more than 10,000 apparent changes. The junction was removed without touching its target.

Fix:
Removed only the report-folder junction. Restored root dependencies from the existing lock file with `npm ci`, then regenerated the local Prisma Client with `npx prisma generate`.

Verification:
`next`, `@prisma/client` and generated `node_modules/.prisma/client` are available and the user confirmed the dev server starts. Git reports zero deleted tracked files. Read-only DB verification found both cabinets and their existing key data: Galioni — 64 products, 5,453 orders, 73 sales, 28 stock snapshots and 28,321 realization rows; Nimba — 87 products, 6,114 orders, 278 sales, 24 stock snapshots and 30,914 realization rows.

Prevention:
- This repository is npm-managed (`package-lock.json`); do not run `pnpm install`, `pnpm add` or other dependency-mutating pnpm commands anywhere inside the repository tree.
- Before any package-manager command, verify the working directory and that the intended folder has its own `package.json` and lock file. A nested folder without them may resolve the parent project.
- For one-off report tooling, use the bundled runtime through an explicit module path or an isolated temporary directory outside the repository. Do not create `node_modules` junctions inside the repository or its `outputs` tree.
- Do not install report-only dependencies into the application root. If root dependencies ever become inconsistent, restore with `npm ci`; after a clean install, run `npx prisma generate` before starting NimbaOS.

Related files:
`package.json`, `package-lock.json`, `prisma/schema.prisma`, `docs/development/BUGS_AND_INCIDENTS.md`

## BUG-017: Morning WB YTD guard required full-year ad coverage

Status:
Fixed.

Symptoms:
Manual workflow run for target `2026-06-27` failed for both cabinets with `Нет локального покрытия рекламы за 2026-01-01 - 2026-06-27`, even though reports were synchronized through 2026-06-27 and advertising stats covered the current June reporting window.

Affected area:
`Утренний отчет WB` automation after adding row `Итого с начала года`.

Investigation:
The YTD layout change reused the year-start range for all source checks. That made `ADVERTISING_STATS` require full-year coverage from Jan 1, while local ad coverage currently starts at 2026-04-01.

Fix:
`src/lib/services/morning-wb-report-workflow.ts` now checks `REPORTS_PERIOD` from Jan 1 through target date, but checks `ADVERTISING_STATS` only for the current month window being written.

Verification:
`npx tsc --noEmit --pretty false` passed. Direct verification for target `2026-06-27` succeeded for both `WB Nimba` and `WB Galioni` and updated the live sheet.

Related files:
`src/lib/services/morning-wb-report-workflow.ts`, docs.

## BUG-016: Financial report mixed old and new physical products under one WB nmId

Status:
Fixed in code; known article versions need manual entry.

Symptoms:
If a seller article/current card name changed from an old model to a new physical product under the same WB `nmId`, historical report rows could be read as one product. This also made cost price ambiguous when the new model had a different себестоимость.

Affected area:
Financial report calculation and reference data for product identity/cost.

Investigation:
`products` and `cost_prices` represent the current/local reference state, while `realization_reports` contains historical fact rows. A simple local rename is not enough when the physical item changed; the report needs a dated business identity layer.

Fix:
Added `article_versions` with `wbAccountId`, `nmId`, date range, report name and optional version-specific cost. `/references` has a `Версии артикулов` tab. `calculateReport` resolves versions by report-row date, splits one `nmId` into multiple rows when needed, and uses version cost before falling back to `cost_prices`.

Verification:
`npx prisma generate`, `npm run type-check`, `npx prisma migrate deploy`, and a DB-only Nimba `calculateReport` smoke check passed.

Related files:
`prisma/schema.prisma`, `prisma/migrations/20260619120000_article_versions/migration.sql`, `src/lib/services/report-calculator.ts`, `src/lib/actions/references.ts`, `src/app/(dashboard)/references/article-version-tab.tsx`

## BUG-015: Financial report ordered rubles undercounted on long periods

Status:
Fixed in code; target account totals need DB sync/readback in the normal app environment.

Symptoms:
For `WB Nimba`, financial report period 2026-01-01 - 2026-06-17 showed `Заказано руб.` = 2004577.64 and `Продажа` = 2913759.88. Since `Заказано руб.` is based on WB orders, this indicated an incomplete local `wb_orders` source for the selected period.

Affected area:
Financial report sync path in `src/lib/queue/sync-processor.ts`; calculated report still reads `wb_orders.finishedPrice` in `src/lib/services/report-calculator.ts`.

Investigation:
`calculateReport` correctly sums all local `wb_orders.finishedPrice` rows, including cancelled orders. The bug was in refresh behavior: after the BullMQ lock incident, `reports.period` only forced a full orders backfill for periods up to 31 days. For longer ranges, `syncOrders` could start from the newest local `lastChangeDate` inside an already partial period, so older missing orders were never loaded while report coverage still looked complete.

Fix:
`REPORTS_PERIOD` and `SALES_PLAN_PERIOD` worker paths now force a full order fetch for the requested period. This avoids reusing an incremental cursor from a partial local order set and prevents silent undercounting of `Заказано руб.`.

Verification:
`npm run type-check` passed. DB readback for `WB Nimba` and `WB Galioni` 2026-01-01 - 2026-06-17 was not run in this session because `DATABASE_URL` was not present in the shell and `.env` must not be read or printed by agents. After deploying/restarting the worker, run a normal `reports.period` sync for each account and re-open `/reports` for that period to verify the totals.

Related files:
`src/lib/queue/sync-processor.ts`, `src/lib/services/sync-orders.ts`, `src/lib/services/report-calculator.ts`

## BUG-014: Advertising campaign stats mixed several WB combined-card groups

Status:
Fixed

Symptoms:
For `WB Galioni (WB_2)` campaign `Кампания от 10.06.2026`, period 2026-06-10 - 2026-06-14, NimbaOS showed 63 baskets and 10 advertising orders, while the WB seller UI showed 31 baskets and 8 orders for the displayed combined card.

Affected area:
Advertising campaign detail in `src/lib/actions/advertising.ts` and product-card metadata in `products`.

Investigation:
Local DB matched public WB Advertising API `GET /adv/v3/fullstats`: campaign/day/nm totals were 63 baskets and 10 orders. A read-only Content API check showed that the 24 nm rows belonged to three `imtID` groups. Primary `imtID=151000452` contained all views/clicks/spend and 8 orders; other zero-spend groups contributed 15 baskets and 2 orders. Public fullstats still returned 48 baskets for the primary `imtID`, not 31.

Fix:
Added nullable BigInt `products.imtId`, stored `card.imtID` during product sync, backfilled all active-account products locally, and changed campaign stats/detail actions to rebuild advertising stats from nm rows filtered to the primary `imtID` group when available. The detail now keeps only meaningful nm rows (views/clicks/spend or orders) and normalizes zero-contact order rows by using orders as basket count. Added `orderSum` to ad stat tables and sync mapping from WB fullstats `sum_price`, so article order sum is advertising-attributed instead of all WB orders. Existing saved ad stat periods were backfilled from WB fullstats for all campaigns with ordered rows.

Verification:
`npx prisma migrate deploy`, `npx prisma generate`, `npm run type-check`, and `npm run lint` passed. Product `imtId` backfill updated 64 Galioni and 87 Nimba products. Backfill verification found 0 ordered ad nm rows and 0 ordered campaign stat rows missing `orderSum`. For the checked campaign/date range, the advertising detail now produces 6 articles, 31 baskets, 8 advertising orders, and 16680.00 advertising order sum.

Related files:
`src/lib/actions/advertising.ts`, `src/lib/services/sync-ad-stats.ts`, `src/lib/services/sync-products.ts`, `prisma/schema.prisma`, `prisma/migrations/20260616120000_product_imt_id/migration.sql`, `prisma/migrations/20260616123000_ad_order_sum/migration.sql`, `prisma/migrations/20260616124500_product_imt_id_bigint/migration.sql`

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
