# Scheduled Automation

Расписание и автоматизация. Last updated: 2026-09-01.

## Current Project Mechanism

Проект использует BullMQ для фоновых sync jobs. Настройки sync-расписания живут в `SyncScheduleSetting`, helper functions — в `src/lib/sync/schedules.ts`, запуск применения расписаний — `scripts/schedule-sync.ts`.

`/sync` показывает расписания группированным каталогом; одна выбранная задача редактируется в боковой панели. Расширенное sync-расписание хранится в nullable JSON `SyncScheduleSetting.schedule`, а `timeOfDay`/`intervalMinutes` остаются совместимыми полями. Все sync kinds поддерживают одно/несколько точных времён или ограниченное start/end/everyMinutes окно по единым правилам; снимки данных не показывают глубину периода, rolling jobs используют 1-30 дней. Sync cadence ограничен ежедневным режимом или выбранными днями недели. На каждое эффективное время регистрируется отдельный BullMQ scheduler, а fingerprint защищает от запуска задания из уже заменённого расписания.

Для product/workflow автоматизаций добавлена отдельная очередь `automation`. Настройки живут в `AutomationWorkflowSetting`, привязки кабинетов к вкладкам — в `AutomationWorkflowAccount`, история — в `AutomationRun`. Helper functions — `src/lib/automations/workflows.ts`, запуск применения расписаний — `scripts/schedule-automations.ts`, worker — `scripts/automation-worker.ts`.

## Workflow Catalog And Schedule Model

- `/automations` показывает каталог зарегистрированных workflow и общую историю запусков; настройки открываются через `/automations/[kind]`.
- Читаемые названия и описания определяет реестр `src/lib/automations/catalog.ts`. `AutomationRun.kind` остаётся каноническим сохранённым идентификатором; имя в истории вычисляется через реестр и доступно для фильтрации/сортировки по kind.
- Расширенное расписание хранится в существующем `AutomationWorkflowSetting.config.schedule`; миграция БД не требуется. `timeOfDay` сохраняет первое эффективное время для обратной совместимости.
- Поддерживаются daily, weekly, every-N-weeks и monthly; одно/несколько конкретных времён или интервал start/end/everyMinutes; выбранные дни недели; якорная неделя; выбранные числа месяца.
- На каждое эффективное время создаётся отдельный BullMQ Job Scheduler. Every-N-weeks дополнительно проверяется worker-ом по московской календарной дате и якорной неделе.
- Scheduled job содержит fingerprint расписания. Работа из уже заменённого расписания безопасно пропускается до создания `AutomationRun`.

## Daily Jobs

### Заказы FBS → таблица учета

- Workflow kind: `FBS_MOVEMENT_SHEET` / `fbs-movement-sheet`; factory default schedule is 10:30 Europe/Moscow. The current local setting is enabled/applied at 23:30; production scheduling was not changed.
- Source: completed local `FBS_OPERATIONAL` coverage; no direct WB API calls from the automation.
- Projection: order, pre-handoff cancellation and explicit `RETURN_RECEIVED` events with stable account/order or movement keys. Existing rows are updated by key; retries do not append duplicates.
- Guardrails: exact headers, Moscow spreadsheet timezone, protected summary formula sentinel, known product mapping, unique existing/desired keys, readback, per-day/per-cabinet control rows and final idempotency verification.
- Product names remain human-readable display values. Technical joins use account + `nmId` + `chrtId`; duplicate WB listings may be mapped to one canonical physical product through `config.productAliases`.
- Explicit `config.productAliases` have highest priority over names retained in prior Sheet rows. They pin the corrected Nimba squares tuple `412122105:591014919 → синий шифон квадраты` and every active tuple found for the known `туника ↔ парео` category duplicates (black leaf, leopard/spots, blue waves, green wave, blue cotton and light green).
- Current WB sellable stock is maintained on the separate employee-readable `Остатки WB` tab. Rows are upserted by account + `nmId` + `chrtId`; disappeared tuples are retained with zero so stale positive stock cannot survive.
- The workflow requires a locally synchronized WB stock timestamp no older than 75 minutes (for the current 60-minute FBS sync cadence) and verifies Summary values per product/account after write. A Sheet/WB mismatch is a hard failure.
- A lower local physical ledger than WB is not a load failure. Summary displays `ВНЕСТИ ПОПОЛНЕНИЕ +N`, the run/control result records the warning count, and the operator decides whether to add the missing local movement.

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

## Need To Clarify

- Production schedule owner and exact cron windows.
- Whether owner summaries should be emailed/exported automatically.
- Required alert channels for failed sync jobs.
