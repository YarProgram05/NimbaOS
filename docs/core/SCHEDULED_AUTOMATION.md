# Scheduled Automation

Расписание и автоматизация. Last updated: 2026-05-25.

## Current Project Mechanism

Проект использует BullMQ для фоновых sync jobs. Настройки sync-расписания живут в `SyncScheduleSetting`, helper functions — в `src/lib/sync/schedules.ts`, запуск применения расписаний — `scripts/schedule-sync.ts`.

Для product/workflow автоматизаций добавлена отдельная очередь `automation`. Настройки живут в `AutomationWorkflowSetting`, привязки кабинетов к вкладкам — в `AutomationWorkflowAccount`, история — в `AutomationRun`. Helper functions — `src/lib/automations/workflows.ts`, запуск применения расписаний — `scripts/schedule-automations.ts`, worker — `scripts/automation-worker.ts`.

## Daily Jobs

Подходящие read-only jobs:
- products/cards refresh в непиковое время;
- reports/paid storage rolling current period;
- orders/sales/funnel rolling current period;
- advertising campaigns/stats current period;
- stocks current;
- reviews/questions refresh.
- `Утренний отчет WB`: daily Google Sheet fill at 10:00 Europe/Moscow from local DB-backed services after freshness checks.

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
- Dangerous writes require human confirmation.

## Need To Clarify

- Production schedule owner and exact cron windows.
- Whether owner summaries should be emailed/exported automatically.
- Required alert channels for failed sync jobs.
