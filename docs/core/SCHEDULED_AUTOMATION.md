# Scheduled Automation

Расписание и автоматизация. Last updated: 2026-09-07.

## Current Project Mechanism

Проект использует BullMQ для фоновых sync jobs. Настройки sync-расписания живут в `SyncScheduleSetting`, helper functions — в `src/lib/sync/schedules.ts`, запуск применения расписаний — `scripts/schedule-sync.ts`.

`/sync` показывает расписания группированным каталогом; одна выбранная задача редактируется в боковой панели. Расширенное sync-расписание хранится в nullable JSON `SyncScheduleSetting.schedule`, а `timeOfDay`/`intervalMinutes` остаются совместимыми полями. Все sync kinds поддерживают одно/несколько точных времён или ограниченное start/end/everyMinutes окно по единым правилам; снимки данных не показывают глубину периода, rolling jobs используют 1-30 дней. Sync cadence ограничен ежедневным режимом или выбранными днями недели. На каждое эффективное время регистрируется отдельный BullMQ scheduler, а fingerprint защищает от запуска задания из уже заменённого расписания. Fingerprint содержит только поля, влияющие на выбранные cadence/time mode; неактивные поля редактора и динамические fallback-значения не должны инвалидировать ежедневные задания.

Для product/workflow автоматизаций добавлена отдельная очередь `automation`. Настройки живут в `AutomationWorkflowSetting`, привязки кабинетов к вкладкам — в `AutomationWorkflowAccount`, история — в `AutomationRun`. Helper functions — `src/lib/automations/workflows.ts`, запуск применения расписаний — `scripts/schedule-automations.ts`, worker — `scripts/automation-worker.ts`.

## Workflow Catalog And Schedule Model

- `/automations` показывает каталог зарегистрированных workflow и общую историю запусков; настройки открываются через `/automations/[kind]`.
- Читаемые названия и описания определяет реестр `src/lib/automations/catalog.ts`. `AutomationRun.kind` остаётся каноническим сохранённым идентификатором; имя в истории вычисляется через реестр и доступно для фильтрации/сортировки по kind.
- Расширенное расписание хранится в существующем `AutomationWorkflowSetting.config.schedule`; миграция БД не требуется. `timeOfDay` сохраняет первое эффективное время для обратной совместимости.
- Поддерживаются daily, weekly, every-N-weeks и monthly; одно/несколько конкретных времён или интервал start/end/everyMinutes; выбранные дни недели; якорная неделя; выбранные числа месяца.
- На каждое эффективное время создаётся отдельный BullMQ Job Scheduler. Every-N-weeks дополнительно проверяется worker-ом по московской календарной дате и якорной неделе.
- Scheduled job содержит fingerprint только эффективных полей расписания. Работа из уже заменённого расписания безопасно пропускается до создания `AutomationRun`, но неактивные поля других cadence/time mode не считаются изменением конфигурации.

## Daily Jobs

### Заказы FBS → таблица учета

- Workflow kind: `FBS_MOVEMENT_SHEET` / `fbs-movement-sheet`; factory default schedule is 10:30 Europe/Moscow. The current local setting is enabled/applied at 23:30; production scheduling was not changed.
- Source: completed local `FBS_OPERATIONAL` coverage; no direct WB API calls from the automation.
- Projection: order, pre-handoff cancellation and explicit `RETURN_RECEIVED` events with stable account/order or movement keys. Existing rows are updated by key; retries do not append duplicates.
- Guardrails: exact headers, Moscow spreadsheet timezone, protected summary formula sentinel, known product mapping, unique existing/desired keys, readback, per-day/per-cabinet control rows and final idempotency verification.
- Product names remain human-readable display values. Technical joins use account + `nmId` + `chrtId`; duplicate WB listings may be mapped to one canonical physical product through `config.productAliases`.
- New tuples require an explicit physical-product mapping. `/automations/fbs-movement-sheet` shows unmatched FBS positions, existing accounting groups and suggested matches; a manager confirms an existing group or enters a new name. Similarity only ranks suggestions and never merges inventory. Existing Sheet tuple mappings are retained; a confirmed tuple cannot be renamed through this flow.
- The workflow registers approved names in the first empty product slot of `Справочники!A4:A153`, after checking the paired formulas in `Сводка!A8:T157`. Instruction/footer rows are outside these ranges. Full capacity or a damaged template stops the run before writes. Names are written as literal text, re-read and checked for Summary coverage before operations/stocks are written. Registration creates no opening quantity or movement.
- Owner-confirmed groups and their separate cabinet tuples from 2026-09-07 are recorded in `src/lib/automations/fbs-product-aliases.ts`: nine listings share five physical names. Configured mappings take precedence over these defaults. Future similar listings still require confirmation.
- Explicit `config.productAliases` have highest priority over names retained in prior Sheet rows. They pin the corrected Nimba squares tuple `412122105:591014919 → синий шифон квадраты` and every active tuple found for the known `туника ↔ парео` category duplicates (black leaf, leopard/spots, blue waves, green wave, blue cotton and light green).
- Current WB sellable stock is maintained on the separate employee-readable `Остатки WB` tab. Rows are upserted by account + `nmId` + `chrtId`; disappeared tuples are retained with zero so stale positive stock cannot survive.
- The workflow requires a locally synchronized WB stock timestamp no older than 75 minutes (for the current 60-minute FBS sync cadence) and verifies Summary values per product/account after write. A Sheet/WB mismatch is a hard failure.
- A lower local physical ledger than WB is not a load failure. Summary displays `ВНЕСТИ ПОПОЛНЕНИЕ +N`, the run/control result records the warning count, and the operator decides whether to add the missing local movement.
- `Сводка!K4:L6` contains two unmerged operational metrics and an explicit Moscow date range. `Передано в доставку по WB, шт.` counts distinct cabinet/order IDs by the first proven `supply.closedAt`; one WB assembly order is one item. It measures system transfer, not per-item physical acceptance or fulfillment charges. Later returns/cancellations do not subtract prior transfers. Local `shippedAt` is not a substitute for the WB event date.
- Both metrics use retained history from the earliest local order or existing Sheet order date through the target day, independently of `config.startDate`. The DB reader is scoped to enabled active workflow cabinets, checks existing Sheet order keys against local coverage and fails explicitly above its 50,000-order bound. Missing history or handoff dates yield a lower bound or `Нет данных`, never a false exact count.
- `Приёмка WB подтверждена, шт.` displays `не менее N` for orders in the same handoff cohort with individual `sorted`, `ready_for_pickup` or `sold` evidence observed by the end of the target Moscow day. `observedAt`/`fetchedAt` are knowledge timestamps, not physical acceptance dates; future evidence is excluded from older reports. Absence of proof means a gap in available history, not proven non-acceptance. `accepted_by_carrier`, supply-level scans and late return statuses alone do not prove WB acceptance.
- Metric planning rejects formulas, unknown content or intersecting merges in `K4:L6` before any Sheet write. It preserves the existing `Всего заказов` formula and other cells, writes specific format fields without merges or changing the row-6 border, and raises row 4 to 60px for wrapped titles. The metric readback must match before the last successful report date advances.

Подходящие read-only jobs:
- products/cards refresh в непиковое время;
- reports/paid storage rolling current period;
- orders/sales/funnel rolling current period;
- advertising campaigns/stats current period;
- stocks current;
- reviews/questions refresh.
- FBS orders/status/meta every 5 minutes, WB FBS stock reconciliation every 15 minutes, marking report every 60 minutes after explicit schedule enablement.
- `Утренний отчет WB`: daily Google Sheet fill at 10:00 Europe/Moscow from local DB-backed services only after freshness checks; the default target is the previous Moscow calendar day.

Не запускать full historical sync по расписанию.

## Weekly Jobs

- Сводка owner summary из базы.
- Проверка long-term stale data and sync failures.
- Анализ stock risk, ad efficiency, plan/fact deviations.

## Where To Run

- Local dev: вручную через `/sync`, worker and scheduler only when environment is ready.
- VPS: предпочтительное место production schedules.
- Windows Task Scheduler or cron: can start worker/scheduler wrappers, but must have env and project access.
- GitHub Actions: уместен только при безопасной сетевой/secret настройке, не для прямой работы с production без review.
- Codex Automations: уместны как агентский слой анализа/напоминаний, но не как единственный production scheduler.

## Rules

- Расписание запускает штатные sync-сервисы.
- Историческая синхронизация не повторяется автоматически.
- Обновлять только свежие/недостающие даты.
- Отчеты строить из базы и service/report layer.
- Google Sheets writes require service-account env and Sheet sharing; formulas and plan blocks in `Утренний отчет WB` must not be overwritten.
- `Утренний отчет WB` must not call WB API or sync services. It checks local coverage/stocks, writes from DB when ready, and fails fast when data is missing; run sync jobs separately before rerunning it.
- Dangerous writes require human confirmation.
- FBS interval schedules are created disabled by default. They are read-only even after enablement; stock publication and other WB changes are never scheduled.
- `FBS_STOCKS_CURRENT` first refreshes card/size identities through the cards-only catalog service, without price API calls. A catalog failure fails the job before stock freshness advances. Newly stocked seller-warehouse sizes create local assortment rows with `onHand=reserved=0`; WB sellable stock stays in `wbStock`. Existing balances, disabled flags and marking settings are preserved. Unchanged size/barcode pairs retain their `ProductSize` IDs.

## Need To Clarify

- Production schedule owner and exact cron windows.
- Whether owner summaries should be emailed/exported automatically.
- Required alert channels for failed sync jobs.
