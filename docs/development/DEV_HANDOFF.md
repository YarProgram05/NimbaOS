# Dev Handoff

## Current Development Objective

Поддерживать реализованный MVP NimbaOS, довести Phase 7/8 live WB verification и future production rollout без нарушения safety rules.

## Last Development Session Summary

2026-08-13: fixed late historical FBS withdrawal tasks for post-handoff cancellation/defect in both cabinets. Official CRPT guidance still requires remote-sale withdrawal at shipment (within 3 working days and before delivery), but when NimbaOS first learns a historical order only after it has already become `canceled_by_client`/`defect`, and the withdrawal was never confirmed, it no longer creates or exports the operationally pointless `withdraw -> return` pair. Pending OPEN/EXPORTED withdrawal tasks are canceled with an audit event, the local circulation state stays `IN_CIRCULATION`, and physical state stays `RETURN_EXPECTED` until receipt inspection. Confirmed withdrawals are never changed and still require return-to-circulation after physical return. Local reconciliation canceled 28 Nimba and 40 Galioni unconfirmed tasks; final audit showed zero open withdrawal tasks attached to canceled orders in both cabinets. The new export query also excludes any canceled order as a fail-safe. Tests 36/36, type-check and production build passed; no WB/CRPT call or mutation occurred.

2026-08-13: replaced the temporary 100-row FBS history window with server-side archive navigation. Orders, KIZ units, CRPT tasks, supplies and the WB action journal now search/filter/sort across the complete account-scoped database history while returning only the requested 25/50/100-row page. A shared optional history date range applies to all five journals; the browser never receives the complete archive. Encrypted KIZ search remains application-side after bounded account/date/status selection so full codes stay encrypted at rest. Analytics search is compact and shares its row with total direct OP, margin, profitability and buyout percentage; article rows expose the same profitability/buyout metrics. Profitability is `OP / total expenses`; buyout is `net sales / (sales + cancellations)` over completed outcomes. Real local DB smoke checks found results beyond the first 100 rows; tests 35/35, type-check and production build passed with only two old unrelated `<img>` warnings.

2026-08-13: completed the FBS history/table/analytics follow-up. `/fbs` keeps all database history but bounds each heavy workspace journal to an operationally prioritised window of up to 100 rows, renders 25 rows per page (10 for the WB action journal), shows exact database totals, and supports ascending/descending sorting from every table header. The standalone UNKNOWN-circulation explanation was removed. Analytics now uses the shared date-range calendar and article rows include orders, cancellations, buyouts, returns, revenue, transfer, direct FBS operating profit and margin. Direct FBS OP is `transfer - direct WB realization expenses - COGS - tax`; shared advertising is deliberately not allocated between FBS/FBO and the UI says so. Exact KIZ unit `5a118244-fb2b-40bb-994a-02f00f040144` was verified against the user-supplied identification code, changed once from `IN_CIRCULATION` to `WITHDRAWN` in a transaction, and an audit event was recorded against its sold order. No WB/CRPT write, sync, deletion, migration or production operation was run. Tests 35/35, type-check and production build passed; only two pre-existing unrelated `<img>` lint warnings remain.

2026-08-13: corrected the CRPT withdrawal XLSX contract. Future withdrawal exports now contain `Код маркировки` plus numeric `Цена за единицу с НДС`, taken from the linked FBS order `convertedPriceRaw / 100`; no VAT is added because the seller uses VAT 0%. Return-to-circulation files remain code-only. Missing/zero order price blocks export instead of silently producing an invalid CRPT file. Four previously downloaded withdrawal workbooks were rebuilt as separate `_с_ценами.xlsx` copies (9, 16, 163 and 179 rows), all rows matched, all codes were canonicalized to `01GTIN21serial`, and originals were preserved. A bounded read-only audit also proved that 57 `IN_STOCK + UNKNOWN` units (29 Galioni, 28 Nimba) were historical pickup-cancellation/defect KIZs imported from WB metadata, not unassigned warehouse stock; no DB/sync/WB/CRPT mutation was performed. Tests 35/35, type-check and lint passed; lint retained two unrelated `<img>` warnings.

2026-08-12: fixed `BUG-024` in the FBS KIZ lifecycle and completed cross-tab filtering. `canceled_by_client` and `defect` are now unconditional post-handoff returns and never emit `UNASSIGN_KIZ`, even when the local shipment flag arrives late. The workspace can recover an already detached order's KIZ from its withdrawal task/event history, and normal operational sync reattaches codes still present in WB metadata. Managers/admins see the same `01GTIN21serial` identification code as the CRPT export (no AIs 91/92), while viewers remain masked. `UNKNOWN` now reads «Статус в ЧЗ не указан» with a no-live-CRPT explanation. Every FBS tab has local search and relevant filters. Tests 33/33, type-check and lint passed.

2026-08-12: localized the remaining raw technical statuses in `/fbs`. KIZ compliance tasks (`OPEN`, `EXPORTED`, `CONFIRMED`, `CANCELED`), WB action statuses (`PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`) and WB action kinds now display clear Russian labels with safe Russian fallbacks for future API/schema values. KIZ circulation wording was clarified to explicit «вывод из оборота» / «возврат в оборот». Stored enum values remain unchanged.

2026-08-12: completed the Stage 1 bulk Chestny Znak workflow in `/fbs`. Withdrawal and return-to-circulation now have separate CRPT-compatible XLSX exports with one `Код маркировки` column and identification codes stripped of AIs 91/92. Every export is stored as a `KizOperationBatch`; after CRPT accepts the file, a manager can enter one document number/date and confirm the entire batch. Local `circulationState` changes only on confirmation, not on download. Direct online status verification against Chestny Znak remains unimplemented Stage 2.

2026-08-12: fixed `BUG-023` in `/fbs` analytics. WB Finance populates `deliveryMethod=FBS` mainly on zero-quantity logistics rows, while the related `Продажа`/`Возврат` rows often have an empty delivery method. FBS finance rows are now identified through `realization_reports.orderId -> fbs_orders.externalOrderId`, with direct `deliveryMethod=FBS` kept only as a fallback. The screen now shows FBS orders, cancellations, buyouts, returns, net revenue and net transfer, plus article-level revenue/transfer. Read-only DB verification for 2026-08-01 - 2026-08-11 returned non-zero results for both cabinets. The KIZ withdrawal trigger remains at WB handoff, not order creation or buyout, because remote-sale light-industry rules require submission after warehouse shipment and before actual delivery.

2026-07-25: recovered and documented `BUG-018`, a local dependency incident caused by bundled `pnpm` resolving the parent npm project from a nested Excel-report work folder and moving 38 direct dependencies into `node_modules/.ignored`. Removed only the verified report-workspace junction that caused Git/VS Code to enumerate 10,000+ apparent changes; restored dependencies with `npm ci` and regenerated Prisma Client. The dev server starts, Git has zero deleted tracked files, and read-only DB verification confirmed both cabinets and key data remain present. Prevention rule: this is an npm repository; do not run dependency-mutating pnpm commands or create `node_modules` junctions anywhere inside it, and isolate one-off report tooling outside the repository.

2026-06-28: updated `Утренний отчет WB` automation layout and writer. Removed morning-sheet `ROMI`, added `Выкупили, шт` after `Выкупили, руб`, added `ЧП на 1 ед` after `ЧП`, added `Итого с начала года` row calculated from 2026-01-01/Jan 1 of target year through target date. Workflow now checks YTD report coverage from year start, current-month advertising coverage, writes progress to `A44:C44`, and still stays DB-only with no WB API/sync calls. Live Google Sheet `Утренний отчет WB` tabs `WB Nimba` and `WB Galioni` were updated and filled through 2026-06-27; `npx tsc --noEmit --pretty false` passed.

2026-06-19: implemented dated article versions to prevent historical financial reports from mixing old and new physical products under the same WB `nmId`. Added Prisma model/table `article_versions`, `/references` tab `Версии артикулов`, server actions with non-overlap validation, and `calculateReport` version resolution by report-row date. Reports now split one `nmId` into separate rows when a selected period crosses a version change; `ArticleVersion.costPrice` overrides regular `cost_prices` only for that version/date range. Ran `npx prisma generate`, `npm run type-check`, `npx prisma migrate deploy` against local `localhost:5432/wb_cabinet`, and a DB-only Nimba report smoke check. Existing versions were not backfilled; user should manually enter known transitions such as old `Парео синяя ракушка` to new `парео синяя разводы` with exact change date/cost.

2026-06-18: fixed `BUG-015` code path for undercounted financial-report `Заказано руб.` on long periods. The report formula remains `Σ wb_orders.finishedPrice` including cancelled orders, but `REPORTS_PERIOD`/`SALES_PLAN_PERIOD` worker paths now force a full order fetch for the requested period instead of using an incremental `lastChangeDate` cursor from a potentially partial local range. `npm run type-check` passed. Concrete DB readback for `WB Nimba` and `WB Galioni`, 2026-01-01 - 2026-06-17, still needs a normal app-environment sync/readback because this shell has no `DATABASE_URL` and agents must not read `.env`.

2026-06-16: fixed advertising campaign stats overcount for combined cards (`BUG-014`). Product sync now stores WB card `imtID` as nullable BigInt `products.imtId`; `/advertising/[campaignId]` rebuilds campaign stats and nm detail from `ad_campaign_nm_stats` for the primary combined card group, keeps only meaningful nm rows (ad contact or ad orders), and normalizes basket-only order rows to order count. Added `orderSum` to ad stat tables from WB fullstats `sum_price`, so article order sum is advertising-attributed instead of all WB orders. Backfilled `imtId` for all active-account products and `orderSum` for all existing ordered ad stat periods. For `WB Galioni (WB_2)`, `Кампания от 10.06.2026`, 2026-06-10 - 2026-06-14, local backfills now produce 6 articles, 31 baskets, 8 ad orders, and 16680.00 ad order sum.

2026-06-07: fixed stock risk classification on `/stocks`. Risk now uses local DB only, combines recent non-return sales from `wb_sales` with sale quantities from `realization_reports` as a fallback, and calculates size-level risk from financial-report barcodes when available. `Нет остатка` is assigned to products with zero total sellable stock; positive stock with reasonable 14-120 day coverage is `В норме`; positive no-demand stock is `Нет продаж`; `Излишек` requires more than 120 days of coverage and at least 10 units. UI label changed from `Норма` to `В норме`, and the category filter now supports multiple selected categories.

2026-06-04: fixed `BUG-012` missing cost prices after the Finance API migration. Finance report rows can contain lowercased `vendorCode`, while references preserve product-card casing. Report reference lookups now normalize vendor-code keys before matching. For 2026-06-02 - 2026-06-03, `парео зеленое/вискоз` now shows `1478.00` cost for two units, and no sold rows in either account have zero cost. A DB-only audit through 2026-06-03 found no net-bought product without a linked cost price.

2026-06-04: completed live verification of `TASK-WB-FINANCE-REPORTS-MIGRATION`. Manual `REPORTS_PERIOD` run `bd702e2a-c703-4aad-8faf-b76d15f29b65` for `WB Galioni (WB_2)` started at 2026-06-04 16:01:59 MSK using code loaded after the endpoint migration. It succeeded with 1 attempt, 1738 report rows read, 244 new rows inserted for 2026-06-02 - 2026-06-03, `maxReportDate: 2026-06-03`, and coverage advanced through 2026-06-03. Key financial fields were non-zero where expected and comparable to prior-period rows. Future report sync results now record `sourceApi` with exact domain/method/path.

2026-06-04: implemented `TASK-WB-FINANCE-REPORTS-MIGRATION` at code level. `fetchRealizationReportPage` now calls Finance API `POST /api/finance/v1/sales-reports/detailed`, requests only fields used by `realization_reports`, paginates with `rrdId`, and normalizes renamed camelCase/string-money fields into the existing internal row mapper. Finance API throttle is now 1 request/minute. `npm run type-check` passed; `npm run lint` passed with two pre-existing `<img>` warnings. Live WB smoke verification was not run because an account and short period were not explicitly selected.

2026-06-01: documented WB Finance API migration priority. At that time report sync used deprecated `GET /api/v5/supplier/reportDetailByPeriod`; the target was `POST /api/finance/v1/sales-reports/detailed` on `finance-api.wildberries.ru`. Main implementation risks identified were Finance token scope, POST JSON request body, `rrdId` pagination, 1 req/min rate limit, `204 No data` when report is not formed, and camelCase response fields that must map into the existing `realization_reports` schema.

2026-05-26: fixed `BUG-011` scheduled automation first-run skip. BullMQ cron schedulers no longer pass `startDate` equal to the first occurrence; cron pattern with `tz: Europe/Moscow` now picks the nearest future run. Temporary scheduler test confirmed same-day near-future scheduling works.

2026-05-26: fixed `BUG-010` for `Утренний отчет WB` runtime. The workflow is now DB-only: it checks report/ad coverage and stock snapshot freshness, then writes the sheet or fails fast; it no longer calls sync services or live WB advertising APIs, and sales-plan coverage is not required. Stale `AutomationRun` `fb1825f9-a865-491f-8720-6dc951dac1e0` was marked `FAILED` after BullMQ showed no active automation job.

2026-05-26: fixed `BUG-009` next-run display for schedules. `/automations` and `/sync` now format `nextRunAt` explicitly in `Europe/Moscow`, and backend schedule helpers calculate next run/lateness from Moscow calendar parts instead of manual `+3/-3` hour shifts. `13:28` MSK now resolves to `10:28Z` and displays as `13:28`. `npm run type-check` and `npm run lint` passed.

2026-05-26: fixed `BUG-008` in `Утренний отчет WB`. Default target date now uses the Moscow calendar date, `A43:C43` progress cells are filled, duplicate monthly `orders` sync is skipped after report sync refreshed the same range, and automation results include per-account/per-step timing diagnostics. `npm run type-check` passed.

2026-05-25: implemented `/automations` and the first automation workflow `Утренний отчет WB`. Added Prisma automation settings/account/run tables, a separate BullMQ automation queue/worker/scheduler, Google Sheets service-account runtime, daily month rollover logic for `A2:P32`, and UI for spreadsheet/account/sheet mapping plus run history.

2026-05-25: corrected `Заказано руб.` calculation to include cancelled WB orders. The metric now sums all `wb_orders.finishedPrice` rows for the selected period.

2026-05-25: fixed a stuck BullMQ `REPORTS_PERIOD` run after `Missing lock for job 316. moveToDelayed`. Long report syncs no longer force full orders backfill beyond 31 days; worker lock duration was increased. The stuck Galioni run was marked failed, and the prior successful run populated `Заказано руб.`.

2026-05-25: fixed `Заказано руб.` sync gap. `reports.period` now syncs `wb_orders` for the selected period, and orders sync upserts existing rows so WB changes to `finishedPrice` / `isCancel` are reflected locally.

2026-05-25: для подготовки `Утренний отчет WB` добавлены `Заказано руб.` и `ROMI %` в финансовый отчет, `Оборачиваемость, дн.` в остатки, account-wide orders/sales sync через `sales-plan.period`, и локальный сервис `morning-report`. Google Sheet не заполнялся.

## Current Safe Next Step

Для новой development-задачи открыть `AGENTS.md`, `docs/DOCS_INDEX.md`, затем этот файл и `docs/development/DEV_CURRENT_TASKS.md`. Первоочередная миграция Finance API завершена и live-verified.

## Active Development Risks

- Financial report sync uses live-verified Finance API `sales-reports/detailed`; continue monitoring `204 No data` and exact `report.sourceApi` in future job results.
- `Заказано руб.` depends on complete local `wb_orders`; long manual report periods now force full order fetches and can be slow/rate-limited, but must not fall back to partial incremental cursors.
- Finance API may change vendor-code casing; report reference matching is normalized and must remain case-insensitive.
- Very long `reports.period` ranges can still be slow because WB Statistics API is rate-limited; prefer shorter periods for forced orders backfill.
- `reports.period` now also calls WB orders sync; respect the Statistics API rate limit and avoid wide historical ranges without confirmation.
- WB Advertising fullstats can return several combined-card (`imtID`) groups inside one campaign and zero-contact nm basket rows. Campaign detail now filters to the primary `imtID`, keeps meaningful nm rows, and normalizes zero-contact order rows; existing ordered ad stat periods were backfilled for `orderSum`, but new data still depends on normal ad stats sync.

- Не запускать production migrations и full historical sync без подтверждения.
- WB advertising live API может возвращать 429/rate limits.
- Raw report/ad tables могут быть тяжелыми без account/date filters.
- `sales-plan.period` теперь может синхронизировать orders/sales без активного плана; не запускать широкий исторический диапазон без подтверждения.
- `Утренний отчет WB` requires `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` and the target Sheet shared with the service-account email before real writes can run.
- `Утренний отчет WB` is DB-only: it must not call WB API or sync services. Missing coverage/stale stocks should fail fast and be fixed via separate sync jobs.
- Stock turnover/risk depends on recent local sales coverage. If both `wb_sales` and `realization_reports` are stale for the 30 completed days before the stock snapshot, `/stocks` can still show many `Нет продаж` rows.
- Automation worker/scheduler are separate from sync worker; production enablement requires Redis/PostgreSQL and explicit rollout setup.
- Старые flat `docs/*.md` теперь legacy redirects/archives.

## FBS Implementation Handoff (2026-07-30)

- `/fbs` is a separate workplace for seller warehouse stock, FBS assortment, orders, supplies/stickers, KIZ and Chestny Znak queue.
- Migration: `prisma/migrations/20260730120000_fbs_operations/migration.sql`. It was schema-validated and applied to the local development `wb_cabinet` database on 2026-07-30 after BUG-019. It has not been applied to production.
- FBS schedules: `fbs.operational` 5 min, `fbs.stocks.current` 15 min, `fbs.marking-report` 60 min. Defaults are disabled; scheduler was not applied.
- Initial backfill script is fixed to `2026-07-20` - `2026-07-30`, dry-run by default and was not executed.
- Full KIZ is encrypted; do not log `rawCode`, decrypted codes or finance KIZ. Use masks/hash.
- All WB FBS writes require manager intent, a warehouse gate and `FbsActionLog`; only admin enables a gate. All gates default false.
- Stage 2 True API is not implemented.
- BUG-020 live-read verification passed for one local cabinet: 1 warehouse, 4 supplies, 12 one-day orders, 30 marking rows, 7 distinctly marked current positions, 16 positive/current FBS positions and 215 WB stock units. No WB write was made.
- BUG-021 fixed raw FBS statuses and the overflowing assortment selector. All documented seller/WB statuses and order actions now have Russian labels; the catalog popover has search, collision padding, a 60vh/20rem height cap and internal scrolling.
- Local/WB stock labels and the WB write gate were clarified in the interface. Permission alone sends nothing; publication remains a separate explicit action.
- Official and live verification confirmed that FBS metadata already provides `orderId -> meta.sgtin.value[]` after the code is attached in WB. Across both local cabinets, 20 of 24 latest orders returned a non-empty SGTIN array; no raw code was printed or stored during verification.
- Secure WB-metadata ingestion is implemented: SGTIN is extracted before sanitization, normalized/parsed, encrypted, hash-deduplicated, GTIN-validated and linked to its order; stored order metadata remains redacted. Conflicts are counted and flagged without exposing or moving the code.
- Two-cabinet live verification for 2026-07-29 - 2026-07-30 created and assigned 20 KIZ units (11 Galioni, 9 Nimba), with 0 rejects, conflicts or GTIN mismatches. The idempotency rerun created/assigned 0 and recognized all 20 as already assigned.
- All 20 imported units reconciled to `HANDED_OVER` and received open `WITHDRAWAL_REMOTE_SALE` tasks. This local DB mutation was expected; no WB write occurred. PDF import is now optional for pre-packing code-pool accounting.
- BUG-022: 9 Nimba codes from 2026-07-28 were missing because two running sync workers had loaded pre-ingestion code. After a bounded direct repair, both stale worker trees were replaced by one current worker. A queued idempotency check succeeded with all 9 already assigned.
- BUG-024: `canceled_by_client` and `defect` preserve their KIZ association. Historical display can recover from task/event relations; if neither exists and WB no longer returns metadata, NimbaOS cannot invent the old code and a normal operational sync is the only safe recovery attempt.
- Authorized managers/admins see CRPT identification codes `01GTIN21serial` in FBS tables and selectors; viewer access remains masked. Never log or expose decrypted AIs 91/92.
- `UNKNOWN` is a truthful local absence of a confirmed Chestny Znak state, displayed as «Статус в ЧЗ не указан»; do not silently convert it to `IN_CIRCULATION`.
- WB metadata readiness no longer depends on Chestny Znak circulation state. July 28 workspace readback is 9/9 KIZ with label `Получены`; exact safe reasons replace the former generic `Заблокировано`.
- `BUG-023` fixed FBS analytics: financial sale/return rows are matched to FBS orders by `orderId`, because WB puts `deliveryMethod=FBS` mostly on related logistics rows. Orders/cancellations use FBS order date; buyouts/returns/revenue/transfer use the financial operation date.
- Remote-sale withdrawal tasks intentionally remain tied to WB handoff (`supplierStatus=complete`), not initial order creation or final `sold`: light-industry distance-sale reporting is due after shipment, within 3 business days and no later than actual delivery. A returned unit is quarantined and uses return-to-circulation/remarking as applicable.
- Verification completed: Prisma format/validate/generate, 14 FBS tests, TypeScript and lint. Authenticated visual verification of BUG-021 remains pending because the test browser had no active application session. Existing unrelated `<img>` warnings remain.

## Read Next If Needed

- `docs/core/ARCHITECTURE.md`
- `docs/core/DATA_MODEL.md`
- `docs/core/WB_API_MAP.md`
- `docs/core/DATABASE_ACCESS_GUIDE.md`
- `docs/development/BUGS_AND_INCIDENTS.md`
- `DECISIONS.md`

## Do Not Do

- Не читать `.env`.
- Не менять WB prices/cards/ads/feedback answers без подтверждения.
- Не запускать migrations/sync worker/scheduler без причины и разрешения.
- Не читать все docs подряд.

## Last Updated

2026-08-12 - fixed and DB-verified FBS analytics under BUG-023; documented the legally required handoff-time KIZ withdrawal trigger. No sync, WB write, migration or production-data mutation was run.
2026-08-13: rebuilt the two affected historical Galioni CRPT withdrawal files after canceled-order reconciliation. The 2026-07-30 batch was reduced from 16 to 11 rows and the 2026-08-12 batch from 179 to 173 rows; 5 and 6 canceled tasks were excluded respectively. The corrected workbooks contain 184 unique KIZs total, all still `EXPORTED + WITHDRAWAL_REQUIRED`, preserve the verified WB unit prices, and have no overlap. Originals remain unchanged.
