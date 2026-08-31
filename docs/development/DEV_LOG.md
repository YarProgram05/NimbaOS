# Development Log

## 2026-09-01 - Daily FBS movement Google Sheet workflow

Implemented `FBS_MOVEMENT_SHEET` as the second registered automation. Its settings page reuses the flexible schedule editor and adds spreadsheet/tab/start-date, cabinet label and stable account-key controls. The queue processor runs the previous Moscow day; manual runs accept an explicit target date. The local Prisma migration adds the new workflow enum value.

The service requires completed local FBS operational coverage, validates the live workbook contract and projects orders, pre-handoff cancellations and explicit accepted-return movements. Rows are upserted by stable event key, not display text or first-empty-row logic. Writes are followed by full readback, a second upsert plan that must be a no-op, and per-day/per-cabinet control-row verification. Unknown products, duplicate keys, broken headers/formula/timezone or reconciliation mismatches fail the workflow.

Added an explicit physical-product alias for the duplicate WB listing `парео леопард/пятна`: tuple `nimba:297175085:452136209` maps to canonical `туника леопард/пятна`. The authorized live initial load through 2026-08-31 inserted 250 rows and updated 5 existing rows; retry preview was exactly 0 inserts, 0 updates and 255 unchanged. The workflow remains disabled. No production deployment, production migration, worker or schedule was changed.

Connector readback caught a timestamp-only issue: Google serial values initially represented UTC wall time even though the workbook is Moscow-based. `sheetSerialDateTime` now serializes Moscow wall time, a regression test covers the conversion, and all 255 timestamps from the initial run were corrected and read back as Moscow time.

Verification: 49 tests, `npm run type-check`, `npm run lint` and `npm run build` passed. Browser QA after replacing a stale local Next.js process confirmed normal CSS and layout on `/automations` at port 3000.

## 2026-09-01 - Automation catalog and flexible workflow schedules

Changed `/automations` from a settings page dedicated to `Утренний отчет WB` into a catalog of registered workflows. Each catalog card shows a human-readable name, purpose, enabled state, schedule summary and next run; settings are now opened through `/automations/[kind]`. The shared run history remains on the catalog page and now includes the workflow name as its first column, with server-side sorting and filtering by the persisted workflow kind.

Added a reusable schedule value stored inside the existing `AutomationWorkflowSetting.config` JSON. It supports daily, weekly, every-N-weeks and monthly cadence; one or many exact times; or repeated runs between start/end times. Weekly modes select one or more weekdays, every-N-weeks stores a cycle anchor, and monthly mode selects one or more month days. The legacy `timeOfDay` column remains the primary/compatibility time, so existing rows load as daily schedules and no Prisma schema or migration was changed.

BullMQ schedule application now removes the workflow's legacy/current scheduler keys and registers one job scheduler per effective time. Daily, weekday and month-day constraints are represented in cron patterns. Every-N-weeks uses the selected weekday cron pattern and a worker-side Moscow-calendar cycle check because cron has no stable anchored multi-week expression. Scheduled jobs carry a schedule fingerprint and selected time so stale jobs are skipped after configuration changes and lateness is measured against the correct run time.

Authenticated browser QA confirmed the catalog, history name column/filter, detail navigation, weekly controls and interval controls. The UI test did not save settings or enqueue a run. `npm run type-check`, `npm run lint`, all 40 tests and a clean `npm run build` passed; lint/build retain only two existing unrelated `<img>` warnings. The verified local dev server was restarted on port 3000 after the build. No local or production worker, scheduler, WB API call or production mutation was performed.

## 2026-08-31 - Restored local styles after `.next` collision

During authenticated in-app-browser QA, localhost rendered the application as unstyled HTML. The page referenced `/_next/static/css/app/layout.css?...`, but that URL returned HTTP 404 and the browser had no loaded application stylesheet. Process inspection proved port 3000 belonged to this checkout's local `next dev` chain.

The preceding `npm run build` had reused and replaced the same `.next` directory while dev remained active. Stopped only the verified local dev process tree and restarted `next dev` hidden from the repository directory. `/api/health` returned HTTP 200; after reloading the existing authenticated tab, the CSS URL returned HTTP 200 with 106,095 bytes, `document.styleSheets` reported 164 application rules, and the normal NimbaOS layout returned. No database, worker, queue, sync, schedule or production process was changed.

## 2026-08-31 - Complete paginated sync and automation histories

Confirmed that synchronization tasks are persisted in `sync_job_runs` and workflow executions in `automation_runs`. The previous read services used `take: 50`, so older records remained in PostgreSQL but were invisible to both pages.

Changed both read services and Server Actions to return a page object with rows, exact total, current page and normalized page size. The UI now supports 25, 50 or 100 rows, previous/next navigation, debounced server-side filters and sortable stored columns. `/sync` filters type, status, account, source, Moscow creation-date range and error text; `/automations` filters status, source, creation-date range and error text. Polling and manual refresh reload the current filtered page. Added shared pager/sort-header components; no Prisma schema or migration was required.

The first UI pass exposed separate creation-date inputs plus technical text filters for task payload period/report date. After owner review, removed those redundant controls and reused the existing canonical `DateRangePicker` on both pages. Each history now has one two-month calendar with the standard quick presets, and it filters the task creation/run timestamp. Payload `Период` and automation `Дата отчета` remain read-only table columns because they describe what the task processed, not when it ran. Authenticated in-app-browser checks confirmed the simplified controls on both pages, the quick-preset calendar, and successful filtering with `Прошлый месяц`.

Read-only local database smoke checks returned 789 sync runs and 49 automation runs, loaded 25-row first pages, and successfully exercised source/date filters plus relation sorting. `npm run type-check`, `npm run lint`, all 36 tests and `npm run build` passed. Lint/build retain only the two pre-existing unrelated `<img>` warnings.

## 2026-08-31 - Refreshed local dev database from production

With explicit owner approval, created a consistent custom-format snapshot from the running mini-PC PostgreSQL database using a read-only `pg_dump`. Verified archive readability, size and SHA-256 before and after transfer. Production stayed online and returned HTTP 200 after cleanup; no production code, data, Redis state, container, worker, schedule, migration or WB sync was changed.

Restored the snapshot first into the isolated local database `wb_cabinet_refresh_20260831`. Validation found 13 completed repository migrations, the one expected historical rolled-back migration, zero active unfinished migrations, zero invalid indexes and zero unvalidated constraints. After validation, renamed the old local database to a temporary rollback name, switched the restored database to `wb_cabinet`, repeated the checks, and removed the obsolete local database only after they passed.

Final local counts are 2 users, 3 WB accounts, 171 products, 14,247 orders and 78,225 realization-report rows. Order and financial-report coverage reaches 2026-08-30; the latest successful sync timestamp stored in the snapshot is 2026-08-31 03:15:01.935. All temporary dump copies were removed from the production container, mini-PC, laptop and local PostgreSQL container. Local PostgreSQL and Redis are healthy; local sync and automation workers remain stopped.

Later the same day, the owner reported additional FBS changes and requested another refresh. Read-only comparison confirmed that production had advanced to 613 FBS orders versus 444 locally, 604 KIZ units versus 421, and 541 compliance tasks versus 417. Repeated the complete isolated restore/validate/switch flow with a new snapshot. The final local FBS controls are 613 orders, 958 order events, 8 inventory movements, 604 KIZ units, 4,197 KIZ events, 541 compliance tasks, 7 operation batches and 0 FBS action logs; the latest FBS/KIZ timestamps are from 2026-08-31. Migration and catalog-integrity checks remained clean, production health remained HTTP 200, and all second-pass temporary artifacts plus the superseded local database were removed after verification.

## 2026-08-27 - Added canonical mini-PC production runbook

Created `docs/core/MINI_PC_RUNBOOK.md` as the stable operating guide for the Windows production host. It records the local-vs-production environment map, Tailscale/OpenSSH identity preflight, expected compose services, persistent-state boundaries, read-only health sequence, controlled GitHub release flow, backup/restore and local dev refresh safeguards, Windows interactive-session dependency, current private/public ingress status, and explicit approval gates. No secrets, volatile commit/run/backup identifiers or permanent row-count assumptions were added.

Updated `AGENTS.md` and `docs/DOCS_INDEX.md` so new agents must read the runbook before mini-PC, production, SSH/Tailscale, Docker runtime, deploy, backup/restore or production-diagnostics work. This documentation-only task did not connect to the mini-PC, run production commands, deploy, commit or push.

## 2026-08-27 - Refreshed local dev database from production

With explicit owner approval, created a consistent custom-format PostgreSQL snapshot from the running mini-PC database using only read-only production operations. Verified archive readability, size and checksum before and after transfer, then removed every temporary snapshot copy from the production host and container. Production remained online; `/api/health` returned HTTP 200 after cleanup, and no production code, data, Redis state, container, worker, schedule, migration or sync was changed.

On the laptop, proved the target was the local `nimba_digitization` development compose project and that no NimbaOS Node/worker process or database connection was active. Restored the snapshot into a separate temporary local database, validated it, switched it into the standard local `wb_cabinet` name, repeated validation, and only then removed the obsolete local database and all local snapshot files. The 13 completed migrations match the repository; one historical rolled-back record is expected, with zero active unfinished migrations, invalid indexes or unvalidated constraints. Final bounded counts are 2 users, 3 WB accounts, 171 products, 14,161 orders and 77,276 realization-report rows.

Started only the local Next.js development server. `/api/health` and `/login` return HTTP 200, the login stylesheet returns HTTP 200, and `/`, `/cards`, `/reports`, `/stocks`, `/analytics` and `/advertising` correctly redirect unauthenticated requests to `/login`. PostgreSQL and Redis are healthy; sync and automation workers remain stopped, and production Redis was not copied.

## 2026-08-24 - Controlled GitHub deployment to the mini-PC

Implemented a repository-owned release path for the Windows mini-PC. Pushes and pull requests now run dependency installation, Prisma Client generation, type-checking, tests, lint and a production build in GitHub Actions. Production deployment remains manual and confirmation-gated through `Deploy production`; it re-runs verification before touching the host.

Installed an online self-hosted GitHub runner as a highest-privilege logon task under the actual `n8929` Windows identity. The deploy script uses one versioned `nimba-app:<commit>` image for the app, sync worker, automation worker, migrations and schedulers. It keeps the previous app online during the build, serializes deployments with a mutex, rejects a dirty or mismatched production checkout, creates a validated custom-format PostgreSQL backup, applies only committed Prisma migrations, recreates application services without recreating PostgreSQL/Redis, restores both scheduler sets and verifies containers plus `/api/health`. Application rollback uses the prior image tag; database restoration is never automatic.

The first complete release succeeded in GitHub Actions run `32679512118` at commit `abb5853ddbb0636a98ac86e8f853081d64665b05`. App, sync worker and automation worker are running the same versioned image; app/PostgreSQL/Redis are healthy and both worker start markers are present. Local and Tailscale health returned HTTP 200. Backup `C:\NimbaOS\backups\nimba-production-20260824-012722-abb5853ddbb0.dump` was validated at 9,891,769 bytes with SHA256 `ADB8664F1A24EA97394EE02823FF3FC9CC778B9D22CBAFD1924A644130F836C2`. Production database volumes and synchronized data were not replaced.

## 2026-08-24 - Confirmed Russian IPv4 Cloudflare response throttling

Superseded the interim Worker diagnosis after byte-level comparison from the mini-PC and the affected work laptop. The exact 124,727-byte Next.js chunk completed locally in 0.007 seconds and through direct Tailscale in about 0.75 seconds. Through public `app.nimbaos.ru` from the Russian IPv4 client, Cloudflare returned HTTP 200 headers but repeatedly stopped after about 24,576 bytes, including on a cache HIT; four explicit small range requests completed quickly. Small HTML, health and NextAuth requests therefore succeed while the browser cannot finish React hydration.

Removed `app.nimbaos.ru` from the obsolete `nimbaos-proxy` Worker custom domains and restored the Tunnel CNAME. Verified that `/api/auth/csrf` again carries private/no-store caching and NextAuth cookies, and that an intentionally invalid credentials request returns HTTP 401 quickly. Restored the automatic Windows Cloudflared service to QUIC over IPv6 after an HTTP2/IPv4 comparison showed no client-side improvement. The connector is healthy, but Cloudflare Tunnel, Workers and proxied DNS all retain the throttled Cloudflare-to-user response path.

Verified the current reliable route: `https://win-sk69nvld6f0.tailc11887.ts.net` delivers both the login page and full JavaScript bundle quickly on trusted Tailscale devices. The preferred no-VPS public fix is a public/static IPv4 from the ISP, direct HTTPS on the mini-PC and DNS-only records. No application data, database schema, migration, schedule, credential or WB data was changed.

## 2026-08-24 - Interim Worker mitigation for public login hydration

Diagnosed the endless public sign-in as a frontend delivery failure rather than a credential or database problem. The custom hostname sometimes failed to finish parallel Next.js JavaScript requests, leaving the login form unhydrated; Chrome could also close the custom-domain connection after negotiating HTTP/3/QUIC even while HTTP/1.1 health checks passed.

Updated and deployed `nimbaos-proxy` so public HTML/RSC payloads and the webpack runtime load immutable Next.js assets through the reliable `nimbaos-proxy.yaros-05.workers.dev` hostname. Added immutable edge caching and removed stale body-specific headers from rewritten responses. Disabled HTTP/3/QUIC for `nimbaos.ru`, retaining HTTP/2.

Verified three consecutive public health responses at HTTP 200. A fresh Chromium session loaded the styled login page to `readyState=complete`, initialized webpack, bound React to the submit button, loaded five Worker-hosted scripts and no custom-host static scripts. A blank submit produced normal client validation instead of navigation or an endless loading state. No credential, application data, database schema, migration, synchronization schedule or WB data was changed.

## 2026-08-23 - Restored public NimbaOS ingress through Worker and Funnel

Retested the intended physical topology using a normal ZTE LAN1 port connected to Keenetic port 0. Keenetic received the expected `192.168.1.19` lease, promoted Ethernet to the primary uplink and retained WISP as reserve. Tailscale remote access remained stable and all 12 connectivity checks passed. The local production stack remained healthy: PostgreSQL, Redis and the app reported healthy, both BullMQ workers were running, and local `/api/health` returned HTTP 200.

The updated native Cloudflare Tunnel still registered and then lost its edge streams even over the corrected wired uplink, so it was removed from the production DNS path. Enabled persistent Tailscale Funnel from `https://win-sk69nvld6f0.tailc11887.ts.net` to `http://127.0.0.1:3000`. Published Cloudflare Worker `nimbaos-proxy`, attached `app.nimbaos.ru` as its custom domain, and deleted only the obsolete DNS Tunnel record for that hostname. The Worker source and deployment metadata are tracked in `infra/cloudflare/nimbaos-proxy/` without credentials.

Verified the final path end to end: public `/api/health` returned HTTP 200 in 20/20 checks over more than two minutes, `/` redirected to the login route, and `/login` returned HTTP 200 with the expected NimbaOS form. AnyDesk, Tailscale and the legacy Cloudflared service remain automatic. The legacy connector is retained temporarily for diagnostics but no longer serves production DNS. No application data, database schema, migration, synchronization schedule or secret was changed.

A subsequent browser test exposed a separate delivery problem: HTML and health responses completed, but larger `/_next/static/` bodies stalled on the Worker custom hostname, so Chrome rendered the login form without CSS and waited indefinitely. Direct Tailscale Funnel and the Worker's `workers.dev` hostname both delivered the same CSS quickly and at the correct size. Updated and deployed `nimbaos-proxy` so requests for immutable Next.js static assets on `app.nimbaos.ru` receive a temporary redirect to the same Worker's technical hostname. Verification downloaded the complete 78,262-byte production CSS in 1.32 seconds, kept public `/api/health` at HTTP 200, and rendered the fully styled login page in a clean Chrome tab. No application, database, schedule or secret was changed.

## 2026-08-23 - ZTE LAN to Keenetic WAN controlled test and recovery

Connected a second cable from ZTE LAN to Keenetic Internet/WAN and temporarily promoted the Keenetic Ethernet uplink. The resulting WAN lease was `10.49.27.58/21` through gateway `10.49.24.1`, not an address from the expected ZTE LAN subnet `192.168.1.x`. The route returned a filtered/private answer for Cloudflare infrastructure (`172.16.24.100`), and Netcraze RMM, Tailscale and Cloudflared became unreachable. This was a provider/ZTE uplink-path failure, not an application or Docker failure.

Disconnected the new ZTE-facing cable. The existing WISP route recovered, Netcraze and Tailscale came back, and the mini-PC was again reachable at `192.168.2.82`. PostgreSQL, Redis, the application and workers remained healthy; `http://127.0.0.1:3000/api/health` returned HTTP 200. Restarted Cloudflared `2026.8.2`; it registered four IPv4/HTTP2 edge connections and loaded the expected route to `http://127.0.0.1:3000`, but sustained public checks still alternated among HTTP 200, 530 and timeouts.

AnyDesk remained offline after route recovery even though its automatic Windows service was running. Its service trace showed repeated attempts to reach `boot.net.anydesk.com` at the poisoned address `172.16.24.100`. The current DNS path already returned public AnyDesk relay addresses, so the Windows DNS cache was cleared and the AnyDesk service/processes were fully restarted. AnyDesk then established TLS 1.3 to public relay `208.115.231.202:443`, remained connected after a sustained check and accepted an incoming managed-client connection.

Returned the Keenetic Ethernet uplink profile to `Reserve 1`, leaving WISP as the primary path. The second cable must not be promoted again until the ZTE-facing port supplies an expected `192.168.1.x` lease and passes sustained DNS, Tailscale, RMM and public-health checks. No application data, schema, migration, schedule or secret was changed.

## 2026-08-23 - Cloudflare ingress retest over Keenetic Ethernet

Connected to the Windows mini-PC over Tailscale and verified that the production host now uses the 1 Gbps Realtek Ethernet interface at `192.168.2.82`; Wi-Fi is disconnected. The active path still traverses `192.168.2.1` (Keenetic), `192.168.1.1` (ZTE) and `100.90.0.1` (MGTS CGNAT). Therefore the cable removed Wi-Fi variability without changing the upstream NAT topology.

Restored the full compose runtime after confirming zero queued/running sync or automation jobs. PostgreSQL and Redis remained healthy; app, sync worker and automation worker restarted normally; local `/api/health` returned HTTP 200 and no new worker errors were found. The Cloudflared service initially remained stopped after an early DNS timeout while networking was not ready. Changed it to delayed automatic startup and configured service recovery restarts after 5, 15 and 30 seconds.

Retested both transports with request-level logging. HTTP2 registered four connections and served one public HTTP 200, then Cloudflare control streams closed and public checks returned 502 or transport resets while the local app stayed healthy. QUIC also registered four connections, but every connection failed with `timeout: no recent network activity` within about five seconds. Restored the service to the previous IPv4/HTTP2 configuration with normal info logging. Public ingress remains blocked by `BUG-026`; no production data, schema, migration, schedule or secret was changed.

Continued in the Keenetic UI: registered the mini-PC at permanent LAN address `192.168.2.82` and set the active WISP profile `local` to always-on. The physical mini-PC cable reaches a Keenetic LAN port, but Keenetic's own internet uplink remains WISP Wi-Fi to ZTE; the intended ZTE LAN -> Keenetic Internet/WAN cable is not present. Updated the official Windows connector from `cloudflared 2026.5.2` to `2026.8.2`, verified its published SHA256, retained the old executable as a rollback copy, and restarted the existing service. Sustained public checks still alternated among 200, 502/530 and timeouts while local health stayed 200. The router reports developer firmware `5.2 Alpha 5`; no firmware update, channel change or reboot was attempted. Next controlled network test is a second Ethernet cable from ZTE LAN to Keenetic Internet/WAN, followed by promoting Ethernet and disabling/demoting WISP.

The owner subsequently updated Keenetic to developer firmware `5.2 Alpha 6`. Netcraze RMM confirmed the router online after reboot with the mini-PC connected at 1 Gbps. A 24-request external monitor over four minutes returned five HTTP 502 responses followed by nineteen HTTP 530 responses. During the same interval, the Windows Cloudflared service remained running on `2026.8.2`, local `/api/health` returned 200, and the connector log again recorded `client disconnected` control-stream failures followed by edge re-registration. The firmware update alone was therefore insufficient; no further router setting was changed.

## 2026-08-21 - BUG-029 scheduled queue grace and Galioni recovery

Replaced the hard 10-minute scheduled-start checks in both BullMQ processors with `src/lib/queue/scheduled-job-policy.ts`. The production default is 1080 minutes and the parser caps any configured value at 1439 minutes, preserving stale-job protection without rejecting a second account that legitimately waits behind a long WB job. Added three regression tests; focused tests, type-check, lint and compose validation passed.

Committed and pushed `bb139f9`, updated the mini-PC checkout, and deployed the policy into `nimba-worker` and `nimba-app`. Docker Desktop could not access its Windows credential helper from the non-interactive SSH logon, so the already-built local images were safely patched from the checked-out commit and recreated without touching PostgreSQL or Redis. Both workers started with `SCHEDULED_START_GRACE_MINUTES=1080`; app health remained HTTP 200.

With explicit owner approval, enqueued only Galioni `advertising.stats` for 2026-08-07 - 2026-08-21. Run `28d4ba91-cea7-4de1-97e7-1c3ba2d23b80` succeeded on attempt 1 with zero campaign errors and moved coverage from 2026-08-12 to 2026-08-21. Then re-ran `Утренний отчет WB` for target 2026-08-20. Run `a9dfd0a9-dfb7-4464-ace9-a477eeb83e5e` succeeded for Nimba and Galioni, writing 20 rows per sheet with zero account failures. Final checks found all five core containers running, app health 200, 14 future sync schedulers and one future automation scheduler.

## 2026-08-21 - Diagnosed partial scheduled morning report

Read-only production inspection found that the scheduled report targeted `2026-08-20`. Nimba completed successfully and wrote 20 daily rows. Galioni failed immediately after sheet preparation because its `ADVERTISING_STATS` coverage stopped at `2026-08-12`, while the report required `2026-08-01 - 2026-08-20`.

The missing coverage was caused by the sync queue's 10-minute scheduled-start guard. Both account jobs entered the concurrency-1 worker at 05:00 MSK; Nimba completed after 14m52s, and Redis shows Galioni returning `skippedScheduledJob: true` with `scheduled job is 14 minutes late`. Since the skip happens before run creation, `/sync` had no Galioni failure row and the surrounding nightly run set looked healthy. No WB sync, queue mutation, automation rerun or Google Sheet write was performed during diagnosis.

## 2026-08-21 - Deployed production automation worker

Added `automation-worker` to the production compose stack and reused the current `nimba-app` image to run `scripts/automation-worker.ts`. Added a one-shot `automation-scheduler` service, securely supplied `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` through the untracked production environment, and re-applied one enabled automation schedule. The permanent container started successfully; Redis showed zero waiting/active automation jobs and one future delayed job.

The one-shot schedule command registered the job but remained alive because the shared BullMQ queue connection was not closed. Removed that temporary container and added `closeAutomationQueue()` so future schedule-only runs terminate cleanly. Focused ESLint passed. No automation report was manually triggered and no Google Sheet was changed because the owner explicitly declined a guaranteed-failing run while the required period is uncovered.

## 2026-08-21 - Production automation runtime audit

Verified that Redis holds one `automation` repeat scheduler and one delayed job targeting 10:00 MSK. The production compose stack has no running automation worker, so the separate BullMQ `automation` queue has no consumer. A presence-only check also confirmed that `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is missing from the running app container; no credential value was read or printed. Therefore `Утренний отчет WB` is not production-operational yet even though its schedule is visible.

No automation was started and no Google Sheet was changed.

## 2026-08-21 - Restored production sync schedules and ran missed card refresh

The mini-PC worker, PostgreSQL and Redis were healthy, but the `sync` Redis namespace contained only queue metadata and the stalled-worker key: there were no BullMQ schedulers or delayed jobs. PostgreSQL still held both enabled `PRODUCTS_REFRESH` settings at `02:00 Europe/Moscow`, last applied on 2026-06-25. This explains why neither cabinet started at 02:00 after the production move: the database settings were restored, while the executable queue schedules were not.

Re-applied all settings using the existing `nimba-app` image, avoiding an unnecessary Docker build from the SSH session. The command processed 22 schedule settings for two active accounts and produced 16 enabled BullMQ schedulers plus 16 delayed next-run jobs. Manually enqueued the missed card jobs: Nimba updated 87 cards and 131 price rows in 3.5 seconds; Galioni updated 63 cards and 63 price rows in 2.3 seconds. Both runs finished `SUCCEEDED` on the first attempt with zero errors.

No migrations, historical resync, WB write operation, price mutation or secret access was performed.

## 2026-08-21 - Mini-PC production update and remote administration

### Summary
Updated the mini-PC checkout to `main` commit `15e9100`, built the production `app` and `worker` images, verified the production Prisma migration state, and recreated only the application and sync-worker containers. PostgreSQL and Redis stayed online.

### Safety and backup
Created and validated `C:\NimbaOS\backups\nimba_production-20260821-005218.backup` before rollout. SHA256: `967410A71AE53435CC1E727A29898807B942DAD36043D614EBA3EA6D9AF1AB50`. The production `.env.production` file was neither read nor changed.

### Migration result
`prisma migrate deploy` found 13 repository migrations and no pending migration. Production already contained the completed `20260730120000_fbs_operations` migration from the restored source database. `_prisma_migrations` contains 13 finished records plus one older explicitly rolled-back attempt for `20260513000000_user_preferences`; this is expected and not an incomplete migration.

### Verification
The recreated `nimba-app-1` and `nimba-worker-1` containers match the newly built images. App, PostgreSQL and Redis are healthy; the worker logs `[sync-worker] started`; local `/api/health` returns HTTP 200. Basic data sanity remained `users=2` and `wb_accounts=2`.

### Remote access
Tailscale provides encrypted remote access to the mini-PC at `100.107.244.75`; key-based OpenSSH access as `n8929` is verified from the trusted development laptop. AnyDesk remains the graphical fallback. Public `app.nimbaos.ru` ingress is still blocked separately by the unstable Cloudflare/CGNAT path.

### Post-rollout Windows and private-access diagnosis
The mini-PC last rebooted on 2026-08-16 because of Windows Update. Docker Desktop runs in the interactive `n8929` session and did not start until that user session was opened; locking an already logged-in session does not stop Docker, but reboot/sign-out leaves the application unavailable until login and Docker startup. Docker Desktop already has a per-user startup entry, while `com.docker.service` being manual/stopped is normal and does not itself host the Linux engine.

All three saved Wi-Fi profiles (`Keenetic-7780`, `MTS_GPON5_FCEA`, `MGTS_GPON_5671`) were configured for automatic connection. Windows currently uses `MTS_GPON5_FCEA`; Keenetic remains first in the saved-profile order, so the likely cause is that Keenetic was unavailable or failed association during reconnect and Windows used the next automatic profile.

Created the trusted-laptop scheduled task `NimbaOS Temporary Tunnel`. It maintains `127.0.0.1:13000 -> mini-PC 127.0.0.1:3000` through Tailscale/OpenSSH, restarts after connection failure, and starts at laptop logon. `/api/health` returned 200, `/` redirected locally to `/login`, and `/login` returned 200.

## 2026-08-14 - Production worker env startup fix

### Summary
Fixed the production Docker worker/scheduler commands so containers use environment variables injected by `docker-compose.prod.yml` instead of npm scripts that require a local `.env` file.

### Files changed
`docker-compose.prod.yml`.

### Commands run
Not run in this workspace; the mini-PC production worker log showed `node: .env: not found`.

### Result
Production `worker` now runs `npx tsx scripts/sync-worker.ts` and `scheduler` now runs `npx tsx scripts/schedule-sync.ts` directly.

## 2026-08-13 - BUG-025 late withdrawal after FBS cancellation

- Audited the latest and prior withdrawal batches for both local cabinets without exposing raw KIZ values.
- Nimba's newest 28-row file contained only already canceled/defect orders, all `RETURN_EXPECTED`, all never confirmed as withdrawn; all 28 were canceled locally and restored from `WITHDRAWAL_REQUIRED` to `IN_CIRCULATION`.
- Galioni had 40 unconfirmed withdrawal tasks tied to currently canceled orders; all 40 were canceled locally and restored to `IN_CIRCULATION`. Eleven belonged to two old exported files; the files are now stale and must not be uploaded unchanged.
- Preserved physical `RETURN_EXPECTED`: cancellation is not proof that the product has physically returned. Availability still requires the normal receive/inspection workflow.
- Confirmed withdrawals were explicitly excluded from reconciliation. If such a product returns physically, it still creates/needs a return-to-circulation task.
- State machine now cancels pending withdrawal instead of creating/recreating it when a post-handoff return is already known. Export has a second fail-safe excluding canceled orders.
- Final local audit: Nimba 0 open withdrawal tasks on canceled orders; Galioni 0. Tests 36/36, type-check and production build passed. No WB/CRPT call or migration was run.

## 2026-08-13 - Full FBS server archive and profitability/buyout KPIs

- Added an authenticated, account-scoped FBS history service/server action for orders, KIZs, CRPT tasks, supplies and WB action logs.
- Search, filters, date range and header sorting now query the full retained history; only one selected 25/50/100-row page is sent to the browser.
- Added a single optional history calendar shared by all heavy FBS journals and a `Вся история` reset.
- The history-period control is hidden on `Сводка` and `Свой склад`, where it has no effect; it remains visible only on tabs backed by historical datasets.
- Preserved encrypted-at-rest KIZ storage: exact KIZ searches decrypt only inside the server process after account/date/status scoping. No full decrypted archive is sent to the client or logged.
- Reworked analytics layout so the article/nmId search occupies a compact column and the freed space contains total direct OP, margin, profitability and buyout percentage.
- Added article-level profitability and buyout columns and sortable headers. Definitions: margin = OP / revenue; profitability = OP / total expenses; buyout = net sales / (sales + cancellations) over completed outcomes.
- Real DB smoke: an order query returned 81 total matches with a 25-row first page; a Russian KIZ circulation query returned 164 matches, proving results are not limited to the initial 100-row workspace payload.
- Verification: `npm test` 35/35, `npx tsc --noEmit` passed, `npm run build` passed; only two unrelated existing `<img>` warnings remain.

## 2026-08-13 - FBS bounded history, sorting, counters and article analytics

- Kept all historical rows in PostgreSQL; no cleanup/delete job was introduced.
- Bounded orders, KIZ, compliance, supplies and WB action payloads to an operationally prioritised window of up to 100 rows; added client pagination (25 rows, action journal 10) so DOM size stays stable as history grows.
- Added exact account-scoped database totals and visible row counters. Every FBS data table now sorts ascending/descending by clicking its column header.
- Replaced the two native analytics date inputs with the shared NimbaOS range calendar.
- Added article-level FBS orders/cancellations and direct FBS OP/margin. Formula: `toTransfer - delivery - storage - acceptance - additional payment - penalty - deduction - COGS - tax`. Shared ads/external ads are intentionally excluded because they cannot currently be allocated reliably between FBS and FBO.
- Removed the standalone `Статус в ЧЗ не указан` explanatory banner.
- Verified the requested encrypted KIZ resolves to exactly one unit and a sold order; transactionally changed only that unit from `IN_CIRCULATION` to `WITHDRAWN` and wrote a `COMPLIANCE_CONFIRMED` audit event with the previous/next state and user-requested correction source.
- Verification: `npm test` 35/35, `npx tsc --noEmit` passed, `npm run build` passed. Build retained two unrelated pre-existing `<img>` warnings.

## 2026-08-13 - CRPT withdrawal unit price and historical file repair

- Added the mandatory second withdrawal column `Цена за единицу с НДС`; values are numeric rubles from `FbsOrder.convertedPriceRaw / 100`.
- Applied no VAT markup because the seller uses VAT 0%; the stored WB converted price is used as the final per-unit amount.
- Kept return-to-circulation exports code-only and kept export selection restricted to `OPEN` tasks, so already exported batches are not silently duplicated.
- Added fail-closed validation for missing, zero or non-integer raw order prices and unit tests for conversion/validation.
- Rebuilt four existing withdrawal files as separate `_с_ценами.xlsx` copies: 9, 16, 163 and 179 data rows. Every source row matched a local withdrawal task/code, no duplicates or invalid prices were found, and each saved workbook passed re-import plus visual verification. Originals were preserved.
- Read-only lifecycle audit: all 57 units shown as `IN_STOCK` with unspecified CRPT state (29 Galioni, 28 Nimba) originated from WB FBS metadata for post-handoff pickup cancellation/defect orders; none was a manually imported/scanned free warehouse KIZ. They are historical misclassification records, not labels requiring a new product assignment.
- Verification: `npm test` 35/35, `npm run type-check` passed, `npm run lint` passed with two pre-existing unrelated `<img>` warnings. No sync, DB write, WB/CRPT call or migration was performed.

## 2026-08-12 - BUG-024 post-handoff KIZ link and FBS filters

- Removed `canceled_by_client` and `defect` from pre-handoff cancellation handling and made their post-handoff classification override a late/missing `shipmentApplied` flag.
- Added regression tests proving pickup cancellation keeps the KIZ and a defect transitions it to expected return.
- Added workspace recovery of order-to-KIZ display through withdrawal tasks and KIZ events for already affected records.
- Decrypts only for authorized FBS manager/admin rendering, then reduces the value to `01GTIN21serial`; viewers continue to receive the stored mask and no decrypted value is logged.
- Renamed local circulation `UNKNOWN` to «Статус в ЧЗ не указан» and added a UI explanation that NimbaOS has no live CRPT status check.
- Clarified CRPT document confirmation: optional primary-document fields without `*` may be blank; NimbaOS requires the number/ID of the already signed document from the CRPT documents list.
- Added search and relevant filters to overview, orders, assortment, KIZ, Chestny Znak tasks, supplies, analytics articles and WB action journal.
- Verification: `npm test -- --runInBand` 33/33; `npm run type-check` passed; `npm run lint` passed with the two pre-existing unrelated `<img>` warnings. No WB/CRPT write, migration or production data mutation was performed.
- `npm run build` compiled the application and passed its lint/type phase, but the final prerender failed on missing generated Next.js `vendor-chunks/next.js` / `/_document` artifacts while a local `next dev` process was active. A separate build directory reproduced the `/_document` failure; the temporary config change was reverted and generated output was moved out of the workspace. This is recorded as an environment/build-artifact issue, not counted as a successful production build.

## 2026-08-12 - Russian FBS status labels

- Added Russian labels for all KIZ compliance task statuses and WB action execution statuses shown in `/fbs`.
- Added Russian names for WB write action kinds, including KIZ attachment, order status change, supply movement/closure and stock publication.
- Clarified circulation labels to «Требуется вывод из оборота», «Выведен из оборота» and «Требуется возврат в оборот».
- Kept raw enum/API values unchanged internally while removing them from user-facing labels and tooltips.
- Added fallback labels for unknown future values and unit tests for every new mapping.
- `npm test -- --runInBand` passed 31 tests; `npm run type-check` passed; `npm run lint` passed with two pre-existing `<img>` warnings outside FBS.

## 2026-08-12 - Bulk KIZ file export and confirmation

- Split the manual Chestny Znak queue into withdrawal and return-to-circulation XLSX exports.
- Aligned the export with CRPT file upload: the first and only column is `Код маркировки`; values are KIZ identification codes without verification key/signature AIs 91/92.
- Kept every generated file as a `KizOperationBatch` and exposed recent batches in the FBS workspace.
- Added mass confirmation for a complete batch with one document number and date; the operation updates every task, its KIZ circulation state, audit events and return inventory movement where applicable.
- Kept single-task confirmation only as an exception fallback.
- Added unit coverage for export task separation and KIZ identification-code conversion. `npm test -- --runInBand`, `npm run type-check` and `npm run lint` passed; lint has only the two existing `<img>` warnings outside FBS.
- No WB/CRPT API call, migration or production/data mutation was performed.

## 2026-08-12 - BUG-023 FBS analytics and KIZ timing verification

`/fbs` analytics returned zero because it filtered every financial row by `deliveryMethod contains FBS`. Local DB evidence showed that WB sets this value mainly on related logistics rows with zero quantity and zero sales amounts; the actual `Продажа` and `Возврат` rows commonly have an empty delivery method.

Implemented a bounded FBS analytics helper and joined financial sale/return rows to operational FBS orders through `realization_reports.orderId = fbs_orders.externalOrderId`. Added FBS order, cancellation, buyout, return, net revenue and net transfer cards, plus revenue and transfer in the article table. Orders/cancellations use Moscow order-date boundaries; financial metrics keep report operation-date semantics.

Read-only DB verification for 2026-08-01 - 2026-08-11: Nimba 161 orders / 26 cancellations / 52 buyouts / 0 returns / 73,432.86 RUB revenue / 52,763.15 RUB transfer; Galioni 199 / 34 / 33 / 0 / 43,925.11 / 30,201.17. `npm test` passed 26 tests; TypeScript passed; lint passed with two pre-existing `<img>` warnings.

Official light-industry guidance based on paragraph 76 of PPRF No. 1956 requires distance-sale withdrawal submission no later than three business days after shipment and no later than actual delivery. Therefore the existing KIZ task trigger remains at WB handoff, not order creation or final buyout. No sync, migration, WB write, historical rewrite or production mutation was run.

## 2026-07-30 - BUG-022 Nimba July 28 KIZ and metadata-state fix

Nine Nimba orders from 2026-07-28 had no KIZ despite successful jobs whose payload covered 2026-07-26 - 2026-07-30. The background jobs were handled by two stale sync-worker trees loaded before SGTIN ingestion existed. After confirming zero active BullMQ jobs, both exact worker trees were stopped and one current hidden worker was started.

A bounded direct sync created/assigned all 9 codes with no reject, conflict or GTIN mismatch. A subsequent real queued job handled by the restarted worker succeeded with 9 `alreadyAssigned` and zero creates/assignments, proving both code freshness and idempotency.

The generic `Заблокировано` metadata label was a separate UI bug: it conflated WB metadata with Chestny Znak circulation and required `IN_CIRCULATION`, while handed-over units correctly had `WITHDRAWAL_REQUIRED`. Metadata readiness now checks WB attachment/validation only and reports an exact safe label/reason. Workspace readback shows all 9 July 28 orders as `Получены`.

Verification: 23 FBS tests and TypeScript passed. No WB write, full-code output, schema migration or historical backfill was performed.

## 2026-07-30 - Automatic encrypted KIZ ingestion from WB FBS metadata

### Implementation
`syncFbsOperational` now extracts `meta.sgtin.value[]` before metadata sanitization, normalizes/parses each DataMatrix, encrypts the full code, deduplicates by account/code hash, validates a known assortment GTIN and attaches the unit to its WB order. Ordinary order/event JSON continues to store `[REDACTED]`. Reused codes, unavailable states and mismatches are counted/flagged without exposing values or aborting the entire sync.

Late metadata is reconciled with existing order state: handed-over units become `HANDED_OVER`, returns become `RETURN_EXPECTED`, pre-handoff cancellations release the assignment, and withdrawal tasks are created at handoff rather than waiting for final sale. Multiple SGTIN values are handled per order even though normal FBS assembly orders contain one unit.

### Verification
`npm test` passes 20 FBS tests, `npm run type-check` passes, and `npm run lint` passes with two pre-existing unrelated `<img>` warnings. A bounded local read-only-WB sync for 2026-07-29 - 2026-07-30 created/assigned 11 Galioni and 9 Nimba KIZ units with no reject, conflict or GTIN mismatch. An immediate identical rerun created/assigned zero and reported all 20 as already assigned.

The database contains 20 new `VALID` units linked to orders, 20 `ATTACHED_TO_WB` audit events and 20 open remote-sale withdrawal tasks. No full code was printed, no WB write was made, and no schema migration was required.

## 2026-07-30 - Read-only verification of FBS order-to-KIZ metadata

### Summary
Official WB documentation confirms that `POST /api/marketplace/v3/orders/meta` returns `orders[].id` with `meta.sgtin.value[]`, and that codes attached through the FBS metadata write method can be read back through this endpoint.

### Live verification
A bounded read-only call through the existing WB wrapper checked the latest 12 local FBS orders in each cabinet. WB returned 12 metadata rows per cabinet; 9 Nimba orders and 11 Galioni orders had non-empty SGTIN arrays (20 of 24 total). Only counts were emitted; tokens and full marking codes were neither logged nor printed.

### Gap found at investigation time
At this point `syncFbsOperational` still replaced the SGTIN object with `[REDACTED]` before KIZ creation. This gap was resolved later the same day by the automatic encrypted KIZ-ingestion implementation recorded above.

## 2026-07-30 - FBS Russian statuses and viewport-safe assortment selector

### Summary
Translated all documented seller and WB order statuses and order actions into Russian. Replaced the overflowing assortment selector with a searchable, viewport-limited popover with internal scrolling. Clarified physical/reserved/available/WB stock labels and made the WB write gate wording explicit that permission alone sends nothing.

### Verification
`npm test` passed all 14 FBS tests, `npm run type-check` passed, and `npm run lint` passed with only two pre-existing unrelated `<img>` warnings. Browser navigation reached the application login page; authenticated visual verification could not be completed without an active browser session.

### Scope
No WB write, synchronization, migration, backfill or database mutation was performed.

## 2026-07-25 - Local dependency incident and recovery

### Summary
Documented and recovered a local development dependency incident caused by running bundled `pnpm` from a nested Excel-report work folder without an isolated package manifest. pnpm resolved the parent npm project and moved 38 direct dependencies into `node_modules/.ignored`. A report-workspace `node_modules` junction also caused VS Code/Git to enumerate more than 10,000 apparent changes.

### Files changed
Documentation only. The report-folder junction was removed; application source, database schema and data were not changed by the recovery.

### Commands run
Inspected the junction and dependency tree; removed only the verified junction; restored dependencies with `npm ci`; generated Prisma Client with `npx prisma generate`; checked Git deleted paths; performed read-only Prisma counts for both cabinets.

### Result
The dev server starts again. Git has zero deleted tracked files. PostgreSQL is reachable and contains both cabinets and their key product, order, sale, stock, realization-report, review and question data. Added a hard rule to keep pnpm dependency mutations and `node_modules` junctions out of this npm repository and to isolate one-off report tooling outside the repository.

## 2026-06-28 - Morning WB report layout and YTD total

### Summary
Updated `Утренний отчет WB` workflow contract. The Google Sheet no longer has `ROMI`; it now has `Выкупили, шт` after `Выкупили, руб` and `ЧП на 1 ед` after `ЧП`. Added row `Итого с начала года`, calculated from January 1 of the target year through the target date.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, docs. The live Google Sheet `Утренний отчет WB` was updated on tabs `WB Nimba` and `WB Galioni`.

### Commands run
Started local Docker dev PostgreSQL/Redis; ran a DB-only one-off sheet fill for 2026-06-01 - 2026-06-26 daily rows and 2026-01-01 - 2026-06-26 YTD totals; `npx tsc --noEmit --pretty false`.

### Result
Workflow remains DB-only and does not call WB API or sync services. It checks report coverage from `YYYY-01-01` for YTD totals and advertising coverage for the current month window, writes daily month values into `B:D`, `F:K`, `M`, `O:Q`, writes YTD row 34, and writes month progress to `A44:C44`.

### Follow-up fix
Manual run for target `2026-06-27` initially failed because the new YTD guard required `ADVERTISING_STATS` from `2026-01-01`, while local advertising coverage starts at `2026-04-01` and covers the current June window. Adjusted the guard: YTD report rows require `REPORTS_PERIOD` from Jan 1, but advertising freshness is checked for the current month being written. Direct verification run for `2026-06-27` succeeded for both cabinets and updated the sheet.

## 2026-06-26 - Docker production build memory headroom

### Summary
Adjusted the Docker builder stage to give the Next.js production build explicit Node heap headroom. Mini-PC Docker builds can otherwise fail during `npm run build` with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`.

### Files changed
`Dockerfile`.

### Commands run
Not run in this workspace; the failure was observed during the mini-PC Docker build.

### Result
The builder stage now sets `NODE_OPTIONS=--max-old-space-size=4096` before `npm run build`.

## 2026-06-19 - Article versions for historical product identity

### Summary
Added dated article versions so one WB `nmId` can represent different physical products/models over time without mixing historical financial reports. A version has a report display name, date range and optional version-specific cost price.

### Files changed
`prisma/schema.prisma`, `prisma/migrations/20260619120000_article_versions/migration.sql`, `src/lib/services/report-calculator.ts`, `src/lib/actions/references.ts`, `src/types/references.ts`, `src/app/(dashboard)/references`.

### Commands run
`npx prisma generate`; `npm run type-check`; `npx prisma migrate status`; `npx prisma migrate deploy`; DB-only `calculateReport` smoke for `WB Nimba (WB_1)`, 2026-06-01 - 2026-06-17.

### Result
`/references` now has a `Версии артикулов` tab. Financial reports resolve `ArticleVersion` by report-row date and split one `nmId` into separate rows when the selected period crosses a version change. Version cost has priority over `cost_prices` for that version; if empty, the old cost fallback remains.

### Issues
Existing versions were not backfilled automatically. Add versions manually for known model changes such as old `Парео синяя ракушка` vs new `парео синяя разводы`, with the real change date and costs.

### Follow-up fix
After opening `/references`, the running app could still use an older Prisma Client and throw `Cannot read properties of undefined (reading 'findMany')` for `prisma.articleVersion`. Reference actions and `calculateReport` now use a parameterized SQL fallback for `article_versions` when the generated delegate is not present in the current process. Restarting the dev server is still recommended, but the page no longer depends on it for this table.

### Cross-section follow-up
Extended historical article-version resolution beyond financial reports. Advertising article stats, sales-plan metrics/detail, analytics comparison chart, and feedback rows now resolve article names by event date and can show separate rows/series when one WB `nmId` spans several physical product versions. Added shared resolver `src/lib/services/article-versions.ts`. Ran `npm run type-check` and `npx prisma validate`.

## 2026-06-18 - Financial report ordered rub long-period repair

### Summary
Fixed the code path that let long financial-report periods show understated `Заказано руб.`. The calculation still uses all local `wb_orders.finishedPrice`, including cancellations, but report/sales-plan worker sync now performs a full order fetch for the requested period instead of starting from a potentially partial local `lastChangeDate` cursor.

### Files changed
`src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`.

### Result
The 31-day forced-backfill cap is no longer used for `REPORTS_PERIOD`/`SALES_PLAN_PERIOD` order refreshes. Wide periods may take longer and hit WB Statistics rate limits, but they should not silently reuse incomplete local orders.

### Issues
DB readback for `WB Nimba` and `WB Galioni`, 2026-01-01 - 2026-06-17, was not possible in this shell because `DATABASE_URL` was not set and `.env` is off-limits. Run the normal report sync in the app environment, then verify the totals on `/reports`.

## 2026-06-07 - Stock risk classification fixed

### Summary
Reworked `/stocks` risk logic after the `В норме` state was effectively absent. The previous logic used only `wb_sales` for the last 30 completed days and classified any zero-stock product as `Нет остатка`, even if there was no recent demand. Slow/partial sales coverage also made many products look like `Излишек` or `Нет продаж`.

### Fix
Stock turnover still uses current sellable stock divided by average daily non-return sales over the 30 completed days before the latest stock snapshot. The sales source now takes the stronger local signal between `wb_sales` and `realization_reports` sale quantities; size rows use `realization_reports.barcode` when available. Risk thresholds are now: zero total sellable stock = `Нет остатка`; positive stock up to 14 days = `Низкий остаток`; 14-120 days = `В норме`; more than 120 days with at least 10 units = `Излишек`; positive stock with no recent demand = `Нет продаж`. `/stocks` category filter now supports selecting multiple categories.

### Checks run
`npm run type-check`.

## 2026-06-04 - Financial report cost-price matching fixed

### Summary
Fixed `BUG-012`: Finance API lowercased report `vendorCode` values, while cost-price and related reference tables preserved product-card casing. Exact string matching caused valid cost prices to appear as zero.

### Fix
Financial report reference keys now use trimmed, Unicode-normalized, case-insensitive vendor-code matching. Equivalent normalized codes are deduplicated, and normalized cost duplicates prefer the most recently updated entry.

### Verification
For 2026-06-02 - 2026-06-03, both accounts now have zero sold rows with missing cost. `парео зеленое/вискоз` changed from `0.00` to `1478.00` for two bought units. The other affected rows were two additional Galioni articles and two Nimba articles. DB-only report calculation and a direct reference audit for 2026-01-01 - 2026-06-03 found no net-bought product without linked cost.

### Checks run
`npm run type-check`; `npm run lint`; `git diff --check`; DB-only financial report calculations for both accounts over 2026-06-02 - 2026-06-03 and 2026-01-01 - 2026-06-03.

## 2026-06-04 - WB Finance reports migration live-verified

### Summary
Audited the repository for old executable links to `reportDetailByPeriod`, verified the user's latest financial report sync, checked persisted field quality, and added exact source API metadata to future report sync results.

### Verification evidence
Manual `REPORTS_PERIOD` run `bd702e2a-c703-4aad-8faf-b76d15f29b65` for `WB Galioni (WB_2)` started at 2026-06-04 16:01:59 MSK after the migrated source files and dev runtime were loaded. It succeeded on the first attempt, read 1738 report rows, inserted 244 new rows dated 2026-06-02 - 2026-06-03, reached `maxReportDate: 2026-06-03`, and advanced report coverage through 2026-06-03.

The 244 new rows contained expected non-zero values for transfer amount, SPP, logistics, acquiring and commission. No silent zeroing caused by Finance API field renames was found. No executable source reference to the deprecated endpoint remains.

DB-only `calculateReport` for 2026-06-02 - 2026-06-03 completed successfully with covered status, 52 product rows, and non-zero sales, transfer, commission, logistics, storage and acquiring totals.

### Checks run
`npm run type-check`; `npm run lint`; `npx prisma validate`; `git diff --check`; repository/runtime-cache search for the deprecated endpoint; mock Finance POST/pagination/field-mapping check; DB-only report calculation.

### Result
Migration is considered implemented and live-verified. Future `ReportSyncResult` values include `sourceApi.domain`, `sourceApi.method`, and `sourceApi.path`.

## 2026-06-04 - WB Finance reports migration implemented

### Summary
Replaced deprecated financial report request `GET /api/v5/supplier/reportDetailByPeriod` with `POST /api/finance/v1/sales-reports/detailed`. The new Finance API response is normalized into the existing internal realization row format so the Prisma schema and report calculations remain unchanged.

### Files changed
`src/lib/wb-api/reports.ts`, `src/lib/wb-api/constants.ts`, `src/lib/services/sync-reports.ts`, `src/types/reports.ts`, and relevant core/development documentation.

### Commands run
`npm run type-check`; `npm run lint`.

### Result
`npm run type-check` passed. `npm run lint` passed with two pre-existing `<img>` warnings. The new request uses POST JSON body, `rrdId` pagination, selected fields, explicit renamed-field mapping, and a 1 request/minute Finance API throttle. Live smoke verification was not run because an account and short period were not explicitly selected.

## 2026-06-01 - WB Finance reports migration documented

### Summary
Compared the deprecated WB financial report endpoint used by NimbaOS at that time with the new Finance API endpoint. The retired implementation called `GET /api/v5/supplier/reportDetailByPeriod` on the Statistics API and mapped snake_case rows. The new target was `POST /api/finance/v1/sales-reports/detailed` on the Finance API, using a JSON body, `rrdId` pagination and camelCase response fields.

### Files changed
Documentation only: `docs/core/WB_API_MAP.md`, `docs/core/DATA_FRESHNESS_POLICY.md`, `docs/core/DATABASE_ACCESS_GUIDE.md`, `docs/core/PROJECT_STATE.md`, `docs/development/DEV_CURRENT_TASKS.md`, `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_LOG.md`.

### Result
Added `TASK-WB-FINANCE-REPORTS-MIGRATION` as the first high-priority development task. No code was changed.

## 2026-05-26 - Scheduled automation first-run fix

### Summary
Fixed `BUG-011`: saving `Утренний отчет WB` shortly before the configured time could skip the same-day run and schedule only the next day. The cause was passing `startDate` equal to the first intended cron occurrence into BullMQ `upsertJobScheduler`.

### Files changed
`src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`, docs.

### Commands run
`npm run type-check`; `npm run lint`; inspected BullMQ automation schedulers/jobs; created and removed a temporary BullMQ scheduler test.

### Result
Automation and sync cron schedulers no longer pass `startDate`; BullMQ now uses the cron pattern plus `tz: Europe/Moscow` to choose the nearest future occurrence. A temporary test scheduler for `14:08` MSK created a same-day delayed job with about 72 seconds delay.

## 2026-05-26 - Morning WB workflow DB-only hardening

### Summary
Fixed `BUG-010`: `Утренний отчет WB` could run slowly because it performed freshness sync inside the workflow and daily report calculation could call live WB advertising APIs. The workflow is now DB-only: it checks local report/ad coverage and stock snapshot freshness, then either writes from DB or fails fast with a clear sync-needed message.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, `src/lib/services/morning-report.ts`, docs.

### Commands run
`npm run type-check`; `npm run lint`; inspected latest `AutomationRun` rows and BullMQ automation queue without printing secrets.

### Result
Removed workflow calls to report/storage/orders/sales-plan/advertising/stocks sync services. Removed sales-plan coverage from the workflow because the Google Sheet does not use sales plans. Morning report calculation now uses persisted ad stats only. The stale scheduled run `fb1825f9-a865-491f-8720-6dc951dac1e0` was marked `FAILED` after BullMQ showed its job had already completed/skipped and no active automation jobs remained.

## 2026-05-26 - Automation next-run Moscow time display

### Summary
Fixed `BUG-009`: `/automations` displayed `13:28` MSK as `10:28`. The first pass fixed client formatting, then a deeper backend issue was found: `getNextRunAt` manually shifted `+3/-3` hours and double-shifted on a Moscow-time host. Schedule helpers now calculate next run/lateness from Moscow calendar parts without depending on host timezone.

### Files changed
`src/lib/time/moscow.ts`, `src/lib/automations/workflows.ts`, `src/lib/sync/schedules.ts`, `src/lib/queue/automation-processor.ts`, `src/lib/queue/sync-processor.ts`, `src/app/(dashboard)/automations/automations-client.tsx`, `src/app/(dashboard)/sync/sync-client.tsx`, docs.

### Commands run
`npm run type-check`; `npm run lint`; local `getNextMoscowRunAt('13:28', 2026-05-26T09:00:00.000Z)` check.

### Result
Next-run backend value for `13:28` MSK is `2026-05-26T10:28:00.000Z`, which formats as `26 мая, 13:28` in Moscow time. Lint passed with only pre-existing `<img>` warnings in unrelated files.

## 2026-05-26 - Morning WB workflow bug fixes

### Summary
Fixed `BUG-008` for `Утренний отчет WB`: the default target date now uses the Moscow calendar date before subtracting one day, so a morning run on 2026-05-25 targets 2026-05-24 instead of 2026-05-23. The workflow also writes the progress summary cells `A43:C43`.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, development/core docs.

### Commands run
`npm run type-check`.

### Result
The workflow remains DB-first: report/sales/ad coverage is checked before any WB sync service is called, stock sync runs only when the latest snapshot is stale, and duplicate `orders` sync for the same monthly range is skipped. `AutomationRun.result` now includes per-account duration and per-step timings to diagnose future Nimba/Galioni runtime differences.

## 2026-05-25 - Morning WB first live run bug notes

### Summary
Recorded first live `Утренний отчет WB` issues without fixing them: report filled through 2026-05-23 instead of 2026-05-24 on 2026-05-25, cells `A43:C43` for `Отработано / Всего дней / Осталось` were not filled, and Nimba took about 988 seconds after Galioni completed in about 142 seconds.

### Files changed
Documentation only for these bug notes: `docs/development/BUGS_AND_INCIDENTS.md`, `docs/development/DEV_CURRENT_TASKS.md`.

### Result
Added open follow-up `TASK-MORNING-WB-LIVE-RUN-FIXES` and `BUG-008`. No workflow behavior was changed for these known bugs.

## 2026-05-25 - Automation run error diagnostics

### Summary
Improved diagnostics for `Утренний отчет WB` automation failures. The workflow now checks Google Sheet access before processing accounts, and run history surfaces saved per-account errors instead of only showing the failed-account count.

### Files changed
`src/lib/services/morning-wb-report-workflow.ts`, `src/lib/automations/runs.ts`, `src/lib/queue/automation-processor.ts`.

### Commands run
`npm run type-check`; checked that `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is not configured without printing any secret values.

### Result
The latest failed manual runs were caused by missing `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`. Next real run requires adding service-account credentials and sharing the target Google Sheet with that service-account email.

## 2026-05-25 - Automations and morning WB report workflow

### Summary
Implemented the new `/automations` section and the first workflow: daily filling of Google Sheet `Утренний отчет WB` at 10:00 Moscow time. The workflow supports multiple WB accounts with per-account sheet tabs, history, manual runs, and month rollover for rows `A2:P32`.

### Files changed
Prisma schema/migration, automation queue/worker/scheduler, Google Sheets runtime, morning report workflow service, `/automations` UI/actions, sidebar, package scripts/dependency, docs.

### Commands run
`npm install googleapis`; `npx prisma generate`; `npm run type-check`; `npm run build`; local dev browser smoke with Playwright CLI.

### Result
The workflow uses service-account Google Sheets access, preserves formulas in `D/K/P`, preserves totals/plans below row 32, writes only daily value columns, and uses existing read-only sync services for missing current-month freshness.

## 2026-05-25 - Ordered rub includes cancelled orders

### Summary
Corrected business definition of `Заказано руб.`: it must include all WB orders, including cancelled orders, because it represents the original ordered ruble volume, not fulfilled/non-cancelled orders.

### Files changed
`src/lib/services/report-calculator.ts`, report column tooltip, docs.

### Verification
For Galioni `2026-01-01` - `2026-05-24`, all orders sum is 2783846.47 vs report sale 1571692.94 (`1.77x`, buyout 58.66%). The previous non-cancelled calculation was only 1846684.89 (`1.17x`).

## 2026-05-25 - BullMQ lock fix for long report sync

### Summary
Investigated stuck `REPORTS_PERIOD` job `316` for Galioni (`2026-01-01` - `2026-05-24`). BullMQ lost the active job lock while trying to move the job to delayed/retry state, leaving `SyncJobRun` stuck as `RUNNING`.

### Files changed
`src/lib/queue/index.ts`, `src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`; checked BullMQ job state and `SyncJobRun`; verified report summary after the successful prior job.

### Result
Worker lock duration is now longer, report sync only forces full orders backfill for periods up to 31 days, stuck run `316` was marked `FAILED`, and worker was restarted. The previous successful run `315` populated orders; after definition correction, report summary for `2026-01-01` - `2026-05-24` should show `Заказано руб.` from all order rows, including cancellations.

## 2026-05-25 - Orders sync repair for ordered rub

### Summary
Fixed `Заказано руб.` freshness: report sync now also syncs WB orders for the selected period, and orders sync can force a full bounded backfill instead of starting from the newest local `lastChangeDate`.

### Files changed
`src/lib/services/sync-orders.ts`, `src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`.

### Result
`wb_orders` rows are now upserted by `(wbAccountId, srid)`, so changed WB order fields such as `finishedPrice` and `isCancel` update existing local rows. Manual/scheduled `reports.period` sync includes orders, so the financial report can refresh `Заказано руб.` with the same button.

Новые записи добавлять сверху. В начале сессии не читать целиком.

## 2026-06-16 - Advertising combined-card stats filter

### Summary
Investigated `Кампания от 10.06.2026` for `WB Galioni (WB_2)`, 2026-06-10 - 2026-06-14. Local campaign totals matched public WB `adv/v3/fullstats`: 63 baskets and 10 orders. The nm rows belonged to three WB combined-card groups (`imtID`): primary `151000452` had all spend/views/clicks and 8 orders; two other groups had zero spend but contributed 15 baskets and 2 orders.

### Files changed
`prisma/schema.prisma`, `prisma/migrations/20260616120000_product_imt_id/migration.sql`, `src/lib/services/sync-products.ts`, `src/lib/actions/advertising.ts`, `src/types/products.ts`, `src/lib/actions/products.ts`, docs.

### Commands run
Read-only DB checks bounded to the campaign/date range; read-only WB Content API and Advertising fullstats checks; local `products.imtId` backfill for 64 Galioni products; `npx prisma migrate deploy`; `npx prisma generate`; `npm run type-check`; `npm run lint`.

### Result
Product sync now stores card `imtID` in `products.imtId`. Advertising campaign stats and nm detail now filter to the primary `imtID` when products have that data, falling back to old campaign totals when `imtId` is unavailable. The checked campaign now resolves to primary `imtID=151000452` and advertising orders 8 instead of campaign-wide 10.

### Issues
Public WB `adv/v3/fullstats` still returns 48 baskets for primary `imtID=151000452`, while the WB seller UI reportedly shows 31. This looks like a WB UI/public API basket deduplication mismatch; exact basket parity needs the source of the seller UI metric or a WB-supported grouped advertising endpoint.

### Follow-up fix
After opening campaign stats, the running app hit `Unknown field imtId for select statement on model Product` because the dev server still used an older Prisma Client. `src/lib/actions/advertising.ts` now loads advertising product metadata through raw SQL with a Prisma fallback, so campaign stats no longer hard-require regenerated Prisma model metadata at request validation time.

### Second follow-up fix
Seller UI showed 6 articles and 31 baskets, while primary `imtID` filtering still showed 15 articles and 48 baskets. The display logic now keeps only meaningful nm rows (ad contact or ad orders) and normalizes rows with no views/clicks/spend but with ad orders by using `orders` as basket count. Added `orderSum` columns to ad stat tables and sync mapping from WB fullstats `sum_price`; the article table now shows advertising order sum, not all WB order revenue. Backfilled current Galioni campaign/date range: 6 articles, 31 baskets, 8 ad orders, 16680.00 ad order sum.

### Third follow-up fix
Another campaign showed empty advertising order sum because old saved ad stat rows predated `orderSum`. Applied the `products.imtId` BigInt migration, regenerated Prisma Client, backfilled `imtId` for all active accounts (64 Galioni products, 87 Nimba products), and backfilled `orderSum` from WB fullstats for all existing campaign periods with ordered rows. Verification now shows 0 ordered ad nm rows and 0 ordered campaign stat rows missing `orderSum`; the checked Galioni campaign still resolves to 6 articles, 31 baskets, 8 ad orders, and 16680.00 ad order sum.

## 2026-05-25 — Morning report metrics prep

### Summary
Добавлены недостающие показатели для будущего Google Sheet `Утренний отчет WB`: `Заказано руб.`, `ROMI %` и `Оборачиваемость, дн.`. Таблица Google не заполнялась.

### Files changed
Расчеты финансового отчета, XLSX export, `/reports`, `/stocks`, stock services, sales-plan sync coverage, morning report service, docs.

### Commands run
`npm run type-check`; локальная проверка Galioni за 2026-04-22 — 2026-05-06.

### Result
`Заказано руб.` initially matched `wb_orders.finishedPrice` without cancellations, but this was later corrected: the metric must include cancelled orders too. `ROMI %` считается по итоговым `ОП` и `Реклама все`. Остатки получили оборачиваемость по 30 завершенным дням продаж.

### Issues
Google Sheets read earlier hit 429, поэтому live mapping листа `WB Galioni` нужно повторить перед фактическим заполнением.

## 2026-05-24 — Documentation 3-zone rebuild

### Summary
Пересобрана Markdown-документация под `docs/core`, `docs/development`, `docs/marketplace`. Созданы канонические root `AGENTS.md`, `SPECIFICATION.md`, `DECISIONS.md`; старая документация сохранена как legacy/redirect или архив.

### Files changed
Только `.md` файлы документации.

### Commands run
Read-only inspection: file listing, Markdown headings search, Prisma model/index search, export/function search, migration index search. Также создана структура папок docs.

### Result
Будущая сессия стартует с `AGENTS.md` и `docs/DOCS_INDEX.md`, затем выбирает development или marketplace документы по задаче.

### Issues
Часть старых docs в терминале отображалась с битой кодировкой, но была использована как источник смысла и сохранена.

### Follow-up
После подтверждения можно удалить или оставить старые flat docs; пока они сохранены.

## 2026-07-30 — FBS and KIZ Stage 1

### Summary
Implemented the approved FBS plan as one code pass with a separate `/fbs` bounded context: seller warehouses and assortment, local stock/reservations, order state processing, supplies/stickers, KIZ encryption/state/events, manual Chestny Znak tasks/XLSX, finance enrichment, interval sync and guarded WB writes.

### Files changed
Prisma schema and migration, FBS types/parser/state machine/tests, WB wrappers, sync/queue/schedules, financial report enrichment, FBS services/actions/UI, sidebar, bounded backfill script and project documentation.

### Commands run
`npx prisma format`; `npx prisma validate`; `npx prisma generate`; `npm test`; `npm run type-check`; `npm run build`; `git diff --check`.

### Result
Schema validates, 8 FBS tests pass, TypeScript passes and Next production build succeeds. `/fbs` is included in the build. FBS schedules and warehouse write gates default disabled.

### Not run
No production migration deploy, live WB sync, backfill, scheduler application, production data mutation or WB write action. The local development migration was applied later while resolving BUG-019.

### Follow-up
Perform a reviewed production rollout: migration, read-only endpoint smoke test, exact `2026-07-20` - `2026-07-30` backfill with confirmation, reconciliation review, then optional schedule enablement. Stage 2 True API remains separate.

## 2026-07-30 — BUG-019 local FBS schema mismatch

### Summary
The local application failed in `prisma.realizationReport.findMany()` because the generated Prisma Client expected FBS fields that were absent from the local database.

### Fix
Confirmed that `20260730120000_fbs_operations` was the only pending migration and applied it to the local development `wb_cabinet` database with `npx prisma migrate deploy --schema prisma/schema.prisma`.

### Verification
The new `realization_reports.deliveryMethod` column and `fbs_seller_warehouses` table are queryable, and `http://localhost:3000` responds with HTTP 200.

### Scope
No production migration, WB synchronization, FBS backfill, schedule enablement or WB write action was performed.

## 2026-07-30 — BUG-020 FBS live read contract fixes

### Summary
Fixed the first live FBS synchronization failures: the mandatory-labeling report method, numeric warehouse/supply classifiers, period timestamp format, B2B response nesting and overly large status batches.

### Stock reconciliation
Made `fbs.stocks.current` independent of a successful order sync. It now refreshes seller warehouses, checks every local catalog `chrtId`, discovers positive-stock FBS positions and retains existing positions when their WB stock becomes zero. The `/fbs` client waits for the background job to finish, refreshes automatically and shows WB stock separately from local physical stock.

### Verification
`npm test` passes all 11 FBS tests and `npm run type-check` passes. Read-only live checks for the affected local cabinet returned 1 warehouse, 4 supplies, 12 orders for `2026-07-29`, 30 marking rows with 8 update operations and 7 distinctly marked current positions, and 16 FBS stock positions totaling 215 WB units after checking 131 catalog sizes.

The existing sync worker was restarted after confirming zero active jobs. A new end-to-end queued `fbs.stocks.current` job then finished `SUCCEEDED` with `updated: 16`, `catalogSizes: 131`, `wbStockUnits: 215` and no error.

Next compilation succeeded, but running `next build` concurrently with `next dev` caused a generated `.next` cache collision during page collection. The three verified dev processes were restarted, only the generated cache was moved to the Windows Recycle Bin, and `/api/health` returned 200 while `/` returned the expected authentication redirect.

### Scope
No WB write method, schedule, bounded historical backfill or production migration was executed. The stock/marking/order smoke tests read WB and updated only the local development database.
2026-08-13 - Corrected the two stale Galioni withdrawal workbooks produced before canceled-order reconciliation. Removed exactly 5 canceled rows from the 16-row 2026-07-30 batch and 6 from the 179-row 2026-08-12 batch. Artifact-tool import/export, readback, price comparison, duplicate scan, status comparison and rendered previews passed. Final total: 184 unique `WITHDRAWAL_REQUIRED` KIZs; originals preserved.

## 2026-08-21 - WB AGNIA initial historical synchronization

### Summary
After explicit owner confirmation, queued the production read-only initial fill for `WB AGNIA`: cards, reports plus paid storage, advertising campaigns and statistics, current WB stocks, reviews and questions. Period-aware jobs use the inclusive range `2026-01-01` through `2026-08-20`; cards, campaign metadata and stocks are current-snapshot APIs.

### Initial verification
The production app, PostgreSQL, Redis and sync worker were running. Cards succeeded with 20 created products, 29 price rows and zero errors. Campaign metadata succeeded with 6 campaigns and zero errors. Historical advertising statistics started next; the remaining jobs are retained in the queue and execute sequentially with worker concurrency 1.

### Safety
No WB write operation, migration, secret read or destructive database command was performed. Do not enqueue the same historical range again until these runs finish and coverage is verified.

## 2026-08-14 - Mini-PC production ingress diagnosis

### Summary
Verified the Windows 11 mini-PC over SSH after moving it to Keenetic. Docker PostgreSQL, Redis, Next.js app and sync worker are up; the app health endpoint returns HTTP 200 and production data was not modified. The mini-PC address is now `192.168.2.147`.

### Network findings
`tracert` shows `192.168.2.1` (Keenetic), then `192.168.1.1` (ZTE), then `100.90.0.1` (MGTS CGNAT). This is double NAT; the ZTE is not currently a transparent bridge. Cloudflared can register four outbound TCP/HTTP2 connections to port 7844, but public checks degrade from 200/502 to 530/1033 while local sockets and `/ready` may still report healthy.

### Tests
Reproduced with Windows cloudflared 2026.5.2, a newer Docker connector, QUIC, HTTP2, IPv4, normal DME edges and forced US `ewr/ord` edges. Router firewall and Anti-DoS tests did not change the failure. A five-minute public probe after restart produced one initial success followed by 502 and sustained 530 responses.

### Result
The original global-region Cloudflared Windows service configuration was restored with automatic startup. No temporary connector process remains. Local application service is healthy, but public ingress is not production-ready. Next step is a public/static IPv4 from MGTS followed by a retest, or a VPS/direct-HTTPS fallback.

## 2026-08-14 - Mini-PC unattended remote access

Converted the downloaded portable AnyDesk client into an installed Windows service at `C:\Program Files (x86)\AnyDesk`. Verified that `AnyDesk Service` is running as `LocalSystem` with automatic startup. The active Windows power plan already has AC sleep and hibernation timeouts set to zero (Never). The operator still needs to set and test the AnyDesk Unattended Access password locally. Existing SSH access at `192.168.2.147` is LAN-only and will require Tailscale/VPN before it can be used directly from another network.
## 2026-09-01 — FBS WB stock authority and replenishment warnings

- Added current `Остатки WB` projection with stable `accountKey + nmId + chrtId` keys, zeroing of disappeared tuples and readback verification.
- Switched Summary WB columns to the snapshot and added a human-readable non-blocking `ВНЕСТИ ПОПОЛНЕНИЕ +N` warning when the local movement ledger is below WB.
- Added four explicit tuple aliases to both the live workflow config and code defaults, plus the new reference product `парео синяя полоска`; retained `туника леопард/пятна` as the canonical duplicate-listing product. Production deployment will therefore not depend on the current local DB config for these mappings.
- Fresh read-only WB stock sync returned 264 Nimba and 278 Galioni units. Live Sheet readback matched both totals exactly; 53 stock rows were loaded and the retry produced 0 inserts/updates.
- Verification: 51 tests passed, TypeScript passed, lint/build passed with only the two pre-existing `<img>` warnings.
- Freshness tolerance was aligned with the operator's hourly FBS sync cadence: 75 minutes instead of 30, so normal scheduling jitter is accepted and a missed hourly cycle still fails the Sheet workflow.

## 2026-09-01 — CI prerender fix for automations

- CI run `33449872826` passed tests, type-check and lint but failed `next build` while prerendering `/automations`: the GitHub runner has no PostgreSQL service, so the page-level Prisma calls returned `ECONNREFUSED`.
- Marked both `/automations` and `/automations/[kind]` as `force-dynamic`; database-backed automation pages are now rendered only per request and are not executed during static generation.
- Fix commit `aa645e7` was pushed to `main`; follow-up GitHub Actions CI run `33450459678` completed successfully in 2m 49s.
