# Documentation Index

Главный навигатор по документации NimbaOS. Last updated: 2026-08-27.

## Zones

- `docs/core` — общая проектная правда: архитектура, БД, API, sync, команды, безопасность, freshness.
- `docs/development` — рабочая память и playbook агента-разработчика.
- `docs/marketplace` — рабочая память и playbook агента-менеджера/аналитика.

Не читать все документы подряд. Начать с `AGENTS.md`, затем выбрать нужные файлы здесь.

## AGENTS.md

Purpose:
Короткий стартовый файл агента, role selection, startup rule, data/database priority, safety.

Read when:
В начале каждой новой сессии.

Update when:
Меняются правила старта, роли, safety или routing docs.

Do not store here:
Историю задач, подробную архитектуру, длинные playbooks.

Related docs:
`docs/DOCS_INDEX.md`, role handoffs.

## SPECIFICATION.md

Purpose:
Стабильная продуктовая спецификация и MVP boundaries.

Read when:
Есть продуктовый спор, изменение бизнес-логики или MVP scope.

Update when:
Меняется продуктовая цель, модули, границы MVP, business rules.

Do not store here:
Журнал разработки, текущие баги, временные задачи.

Related docs:
`DECISIONS.md`, `docs/core/PROJECT_STATE.md`.

## DECISIONS.md

Purpose:
Канонический журнал продуктовых и архитектурных решений.

Read when:
Нужно понять почему выбрана архитектура, схема, data flow, deploy path.

Update when:
Принято новое устойчивое решение или старое решение superseded.

Do not store here:
Ежедневные логи, TODO, подробные баг-расследования.

Related docs:
`SPECIFICATION.md`, `docs/development/DEV_LOG.md`.

## docs/core/PROJECT_MAP.md

Purpose:
Карта папок, слоев и быстрых entrypoints.

Read when:
Нужно найти где API, sync, reports, UI, БД.

Update when:
Меняется структура проекта или важные entrypoints.

Do not store here:
Детальные formulas, KPI, task history.

Related docs:
`docs/core/ARCHITECTURE.md`, `docs/core/WB_API_MAP.md`.

## docs/core/PROJECT_STATE.md

Purpose:
Текущее состояние реализации, частично готовые зоны, риски.

Read when:
Нужно понять что уже сделано и что осталось.

Update when:
Значимо меняется состояние продукта/кода/docs.

Do not store here:
Длинные дневники, решения, бизнес-аналитику.

Related docs:
`docs/development/DEV_HANDOFF.md`, `docs/marketplace/MARKETPLACE_HANDOFF.md`.

## docs/core/MINI_PC_RUNBOOK.md

Purpose:
Каноническая карта Windows mini-PC, production runtime, remote access, release, backup/restore и safety boundaries.

Read when:
Задача касается mini-PC, production, SSH/Tailscale, Docker runtime, deploy, backup/restore, dev DB refresh или production diagnostics.

Update when:
Меняются стабильные host/path/topology facts, production service layout, access method, release/restore boundaries или Windows runtime caveats.

Do not store here:
Secrets, current commit/run/backup identifiers, dated row counts, chronological incident logs или volatile task status.

Related docs:
`docs/core/COMMANDS.md`, `docs/core/SAFETY_RULES.md`, `docs/core/PROJECT_STATE.md`, `docs/development/DEV_HANDOFF.md`.

## docs/core/ARCHITECTURE.md

Purpose:
Общая архитектура, layers and data pipeline.

Read when:
Задача про код, sync, reports, API, data flow.

Update when:
Меняются слои, boundaries, data flow.

Do not store here:
Все модели БД или KPI formulas.

Related docs:
`docs/core/DATA_MODEL.md`, `docs/core/WB_API_MAP.md`.

## docs/core/COMMANDS.md

Purpose:
Команды проекта и safety classification.

Read when:
Нужно что-то запускать.

Update when:
Добавлена/изменена команда или safety policy.

Do not store here:
Логи выполнения команд.

Related docs:
`docs/core/SAFETY_RULES.md`, `docs/development/TROUBLESHOOTING.md`.

## docs/core/DATA_MODEL.md

Purpose:
Модели Prisma, таблицы, ключи, индексы, raw/normalized/aggregate classification.

Read when:
Задача про БД, запросы, аналитику, sync coverage.

Update when:
Меняется schema, indexes, table purpose, aggregates.

Do not store here:
Detailed SQL investigations.

Related docs:
`docs/core/DATABASE_ACCESS_GUIDE.md`, `prisma/schema.prisma`.

## docs/core/DATABASE_ACCESS_GUIDE.md

Purpose:
Правила быстрого и безопасного доступа к данным.

Read when:
Нужно строить отчет, запрос, repository/report function.

Update when:
Появились новые services, aggregates, indexes, slow query findings.

Do not store here:
Business recommendations.

Related docs:
`docs/core/DATA_MODEL.md`, `docs/marketplace/ANALYTICS_PLAYBOOK.md`.

## docs/core/WB_API_MAP.md

Purpose:
Карта WB API methods, read/write boundaries, sync usage.

Read when:
Задача про API, sync, WB read/write actions.

Update when:
Добавлен endpoint, изменились limits/errors/write methods.

Do not store here:
API tokens, real responses with private data.

Related docs:
`docs/core/DATA_FRESHNESS_POLICY.md`, `docs/core/SAFETY_RULES.md`.

## docs/core/DATA_FRESHNESS_POLICY.md

Purpose:
Правила DB-first аналитики и API-only-for-sync.

Read when:
Перед analytics/report/sync decisions.

Update when:
Меняется sync strategy, coverage logic, freshness definition.

Do not store here:
Implementation logs.

Related docs:
`docs/core/DATABASE_ACCESS_GUIDE.md`, `docs/marketplace/ANALYTICS_PLAYBOOK.md`.

## docs/core/SAFETY_RULES.md

Purpose:
Запреты, approvals, secret/data/WB safety.

Read when:
Любая потенциально опасная задача.

Update when:
Появился новый риск или dangerous action.

Do not store here:
Long troubleshooting.

Related docs:
`AGENTS.md`, `docs/core/WB_API_MAP.md`.

## docs/core/SCHEDULED_AUTOMATION.md

Purpose:
Расписание, cron/VPS/Task Scheduler/Codex automation guidance.

Read when:
Задача про recurring sync, reports, automation.

Update when:
Меняется scheduler, production automation, report cadence.

Do not store here:
Actual secrets or production credentials.

Related docs:
`docs/core/COMMANDS.md`, `docs/core/DATA_FRESHNESS_POLICY.md`.

## docs/core/OPEN_QUESTIONS.md

Purpose:
Неясности, risks, questions for owner.

Read when:
Нужно проверить открытые вопросы before design/analysis.

Update when:
Появляется uncertainty or unresolved decision.

Do not store here:
Resolved decisions; move them to `DECISIONS.md`.

Related docs:
All core and role docs.

## docs/development/DEVELOPMENT_AGENT.md

Purpose:
Playbook агента-разработчика.

Read when:
Development task.

Update when:
Меняется development workflow.

Do not store here:
Marketplace recommendations.

Related docs:
`docs/core/ARCHITECTURE.md`, `docs/development/DEV_HANDOFF.md`.

## docs/development/DEV_HANDOFF.md

Purpose:
Короткая передача контекста следующей development-сессии.

Read when:
После startup docs на development task.

Update when:
После каждой значимой development task.

Do not store here:
Длинную историю; она в `DEV_LOG.md`.

Related docs:
`docs/development/DEV_CURRENT_TASKS.md`, `docs/development/DEV_LOG.md`.

## docs/development/DEV_CURRENT_TASKS.md

Purpose:
Active/next/blocked/done development tasks.

Read when:
Нужно выбрать следующий development шаг.

Update when:
Статус задач меняется.

Do not store here:
Deep investigations.

Related docs:
`docs/development/DEV_HANDOFF.md`, `docs/development/BUGS_AND_INCIDENTS.md`.

## docs/development/DEV_LOG.md

Purpose:
Хронологический журнал development work.

Read when:
Нужно расследовать историю; не читать целиком на старте.

Update when:
После каждой significant development task.

Do not store here:
Current short handoff.

Related docs:
`docs/development/DEV_HANDOFF.md`.

## docs/development/BUGS_AND_INCIDENTS.md

Purpose:
Баги, симптомы, расследования, fixes.

Read when:
Баг, ошибка, странное поведение.

Update when:
Найден/исправлен bug or incident.

Do not store here:
Feature plans.

Related docs:
`docs/development/TROUBLESHOOTING.md`.

## docs/development/TROUBLESHOOTING.md

Purpose:
Типовые проверки и диагностика.

Read when:
Что-то не запускается, reports empty, sync failed, query slow.

Update when:
Появился новый diagnostic pattern.

Do not store here:
Bug history; use bugs doc.

Related docs:
`docs/core/COMMANDS.md`, `docs/development/BUGS_AND_INCIDENTS.md`.

## docs/marketplace/MARKETPLACE_AGENT.md

Purpose:
Playbook агента-менеджера/аналитика.

Read when:
Marketplace task.

Update when:
Меняется marketplace workflow.

Do not store here:
Architecture details; link core docs.

Related docs:
`docs/marketplace/MARKETPLACE_HANDOFF.md`.

## docs/marketplace/MARKETPLACE_HANDOFF.md

Purpose:
Короткая передача контекста следующей marketplace-сессии.

Read when:
После startup docs на marketplace task.

Update when:
После marketplace task.

Do not store here:
Full analysis history.

Related docs:
`docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`, `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.

## docs/marketplace/MARKETPLACE_CURRENT_TASKS.md

Purpose:
Active/next/blocked/done marketplace tasks.

Read when:
Нужно выбрать аналитический next step.

Update when:
Статус marketplace задач меняется.

Do not store here:
Detailed findings.

Related docs:
`docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.

## docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md

Purpose:
Журнал бизнес-анализов и рекомендаций.

Read when:
Нужно восстановить прошлый analysis.

Update when:
После анализа или отчета.

Do not store here:
Development logs.

Related docs:
`docs/marketplace/ANALYTICS_PLAYBOOK.md`.

## docs/marketplace/ANALYTICS_PLAYBOOK.md

Purpose:
Как проводить аналитику из базы и готовых сервисов.

Read when:
Перед любым marketplace report.

Update when:
Меняется аналитическая методика.

Do not store here:
Project architecture.

Related docs:
`docs/core/DATABASE_ACCESS_GUIDE.md`, `docs/marketplace/KPI_DEFINITIONS.md`.

## docs/marketplace/MARKETPLACE_MANAGER_PLAYBOOK.md

Purpose:
Operational WB manager thinking.

Read when:
Нужны daily/weekly management actions.

Update when:
Меняется manager routine.

Do not store here:
Raw report data.

Related docs:
`docs/marketplace/DAILY_CHECKLIST.md`, `docs/marketplace/DECISION_RULES.md`.

## docs/marketplace/REPORTS_GUIDE.md

Purpose:
Какие отчеты есть и какие нужны.

Read when:
Нужно сформировать или добавить отчет.

Update when:
Появился новый report/export.

Do not store here:
KPI formula details; use KPI doc.

Related docs:
`docs/marketplace/KPI_DEFINITIONS.md`.

## docs/marketplace/KPI_DEFINITIONS.md

Purpose:
Метрики, формулы, источники, ошибки интерпретации.

Read when:
Нужно посчитать или объяснить KPI.

Update when:
Меняются formulas or metric source.

Do not store here:
One-off findings.

Related docs:
`docs/marketplace/ANALYTICS_PLAYBOOK.md`.

## docs/marketplace/DAILY_CHECKLIST.md

Purpose:
Ежедневная проверка WB кабинетов.

Read when:
Daily marketplace task.

Update when:
Меняется daily routine.

Do not store here:
Full analysis logs.

Related docs:
`docs/marketplace/MARKETPLACE_MANAGER_PLAYBOOK.md`.

## docs/marketplace/DECISION_RULES.md

Purpose:
Осторожные правила бизнес-рекомендаций.

Read when:
Перед рекомендацией владельцу.

Update when:
Уточнены thresholds or policy.

Do not store here:
Автоматические WB actions.

Related docs:
`docs/marketplace/KPI_DEFINITIONS.md`, `docs/core/SAFETY_RULES.md`.

## docs/DASHBOARD_ANALYTICS_ROADMAP.md

Purpose:
Legacy/working roadmap for dashboard analytics phases.

Read when:
Only when continuing dashboard analytics roadmap work or checking historical implementation intent.

Update when:
Dashboard analytics roadmap changes and the roadmap remains intentionally active.

Do not store here:
Global project state; use `docs/core/PROJECT_STATE.md`.

Related docs:
`docs/core/PROJECT_STATE.md`, `docs/development/DEV_CURRENT_TASKS.md`.

## README.md

Purpose:
Short human-facing entrypoint.

Read when:
Someone needs a quick project overview.

Update when:
Stack, documentation entrypoints, or safe command summary changes.

Do not store here:
Agent memory, task history, detailed architecture.

Related docs:
`AGENTS.md`, `docs/DOCS_INDEX.md`.

## PROMPTS_GUIDE.md

Purpose:
Legacy prompt archive from earlier development phases.

Read when:
Investigating old phase intent.

Update when:
Usually never; prefer new role docs.

Do not store here:
Current operating rules.

Related docs:
`AGENTS.md`, `DECISIONS.md`.
