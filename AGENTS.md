# AGENTS.md

Короткий стартовый файл для Codex-агентов в NimbaOS. Не превращать его в журнал: подробности искать через `docs/DOCS_INDEX.md`.

## Project

NimbaOS — внутреннее веб-приложение для оцифровки кабинетов Wildberries: товары, остатки, отчеты, план продаж, реклама, отзывы, справочники и фоновые синхронизации.

Стек: Next.js 14 App Router, TypeScript, Prisma 7, PostgreSQL, NextAuth, BullMQ/Redis, WB API, XLSX export.

## Role Selection

1. Если задача про код, архитектуру, баги, инфраструктуру, БД, API, синхронизацию, команды или разработку — это `development task`.
2. Если задача про продажи, остатки, рекламу, цены, карточки, план/факт, бизнес-отчеты или рекомендации по WB — это `marketplace task`.
3. Если задача смешанная, сначала открыть core-документы, затем только нужные development или marketplace документы.
4. Не читать все `docs/**/*.md` по умолчанию.

## Session Startup Rule

В начале новой сессии читать только:
1. `AGENTS.md`
2. `docs/DOCS_INDEX.md`

Не читать handoff/current-task файлы автоматически для каждой задачи. Открывать их только когда запрос продолжает прежнюю работу, спрашивает текущий статус/план или действительно зависит от недавнего контекста:
- development continuity: `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_CURRENT_TASKS.md`;
- marketplace continuity: `docs/marketplace/MARKETPLACE_HANDOFF.md`, `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`;
- mixed continuity: только релевантные handoff/current-task документы.

Для изолированной задачи с понятным компонентом сразу использовать точный документ/исходник из индекса ниже. Не загружать handoff, current tasks, project state и архитектуру одновременно «на всякий случай».

Дополнительно открывать по необходимости:
- продукт/MVP: `SPECIFICATION.md`;
- решения: `DECISIONS.md`;
- состояние: `docs/core/PROJECT_STATE.md`;
- карта проекта: `docs/core/PROJECT_MAP.md`;
- архитектура: `docs/core/ARCHITECTURE.md`;
- команды: `docs/core/COMMANDS.md`;
- mini-PC, production, SSH/Tailscale, Docker runtime, deploy, backup/restore и production-диагностика: `docs/core/MINI_PC_RUNBOOK.md`;
- БД и связи: `docs/core/DATA_MODEL.md`;
- быстрый доступ к данным: `docs/core/DATABASE_ACCESS_GUIDE.md`;
- WB API: `docs/core/WB_API_MAP.md`;
- актуальность данных: `docs/core/DATA_FRESHNESS_POLICY.md`;
- безопасность: `docs/core/SAFETY_RULES.md`;
- автоматизация: `docs/core/SCHEDULED_AUTOMATION.md`;
- баги: `docs/development/BUGS_AND_INCIDENTS.md`;
- marketplace-аналитика: `docs/marketplace/ANALYTICS_PLAYBOOK.md`;
- отчеты: `docs/marketplace/REPORTS_GUIDE.md`;
- KPI: `docs/marketplace/KPI_DEFINITIONS.md`;
- ежедневная проверка: `docs/marketplace/DAILY_CHECKLIST.md`;
- бизнес-решения: `docs/marketplace/DECISION_RULES.md`.

## Data Source Priority

1. Для аналитики и отчетов сначала использовать локальную базу данных.
2. Не вызывать WB API напрямую, если нужный период уже есть в базе.
3. Перед анализом проверять покрытие периода и статус синхронизации.
4. Если свежих данных не хватает, использовать существующий sync-сервис для недостающего диапазона.
5. Исторические данные не пересинхронизировать без явного подтверждения пользователя.
6. После синхронизации строить аналитику из базы, а не из сырых API-ответов.
7. Повторная полная историческая синхронизация требует подтверждения.
8. Перезапись исторических данных требует подтверждения.

## Database Access Priority

1. Сначала использовать готовые report services, repository functions, views, summary tables или агрегированные таблицы.
2. Не делать тяжелые ad-hoc запросы по raw-таблицам, если есть нормализованные или агрегированные источники.
3. Для больших периодов использовать агрегаты или готовые сервисы.
4. Для точечной проверки можно обращаться к raw-данным, но только с ограничением периода и кабинета.
5. Перед новым запросом проверить `docs/core/DATABASE_ACCESS_GUIDE.md`.

## Hard Safety

- Не читать и не выводить `.env`, токены, пароли, ключи и расшифрованные WB API keys.
- Не менять `.env`, production-данные, Prisma-схему, миграции и конфиги без явного запроса.
- Не менять цены, скидки, карточки, рекламу, ставки, бюджеты, остатки и данные WB без явного подтверждения.
- Не запускать production-миграции, destructive-команды, полную историческую синхронизацию или перезапись истории без подтверждения.
- В documentation-only задачах менять только `.md`.

## Documentation Update Rule

После значимой задачи обновлять только те канонические файлы, смысл которых реально изменился. Не копировать один полный summary в handoff, current tasks, project state и log.

- Development result: одна подробная запись в `docs/development/DEV_LOG.md`.
- Marketplace analysis/report: одна подробная запись в `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.
- `*_CURRENT_TASKS.md`: только Active/Next/Blocked и не более 3–5 коротких Done Recently; завершенные details остаются в log.
- `*_HANDOFF.md`: только текущая цель, delta, risks и safe next step; заменять устаревший контекст, а не дописывать историю.
- `PROJECT_STATE.md`: snapshot текущего состояния, без chronological update log.
- `DECISIONS.md`: только устойчивое решение с reason/consequences; superseded material переносить в `docs/archive`.
- Core reference обновлять только при изменении его stable contract.

Архив не читать на старте. Если archive противоречит active canonical document, приоритет у active document.

## Graphify Memory Workflow

Graphify is a derived navigation index, not mandatory session memory. Its project-scoped skill lives at `.codex/skills/graphify/`; graph outputs live in `graphify-out/`. Use the lightest mode that materially helps the task.

### Everyday navigation

1. For a narrow task with known files, symbols, routes, errors or services, use direct `rg` and source inspection. Graphify is unnecessary.
2. For broad architecture, dependency, cross-subsystem or unknown-entrypoint questions, one read-only Graphify query with a small token budget may be used before opening the returned sources.
3. Do not run `reflect`, `save-result`, semantic extraction, clustering or HTML generation during ordinary work.
4. A stale/noisy graph is a hint only: stop querying and inspect current sources directly. Do not refresh it merely to finish the current task.
5. Dirty generated files in `graphify-out/` are normal. `GRAPH_REPORT.md` and `graph.html` are for deliberate graph audits, not startup reading.

### Source of truth

- Graphify is an index and memory/navigation layer, not an authority that replaces project sources.
- Code, active Markdown documentation, KPI/metric definitions, analytical methodology, data contracts and decision records remain the source of truth.
- Confirm exact formulas, contracts, implementation details and consequential claims in their source before changing code or presenting a final conclusion.

### Batched maintenance

1. Ordinary tasks update only their actual source of truth and required canonical documentation. They never block on Graphify synchronization.
2. Graph maintenance runs only on an explicit user request or as a dedicated maintenance task, preferably after several substantial changes rather than after each change.
3. Code-only batches use a cheap AST refresh without semantic extraction, clustering or HTML. Important documentation/architecture/business-rule batches may use semantic incremental maintenance once for the whole batch.
4. Full rebuild, community relabeling and visualization are rare operations for major restructuring, corruption recovery or an explicit graph audit.
5. Do not save ordinary query answers through `graphify save-result`; upstream Graphify re-ingests its default memory directory and creates avoidable self-referential updates.
6. If an important decision exists only in conversation, record it in `DECISIONS.md` or the relevant canonical source immediately; do not rely on the graph to preserve it.

Human usage and maintenance guide: `docs/core/GRAPHIFY_MEMORY_GUIDE.md`.

Last updated: 2026-09-04 - switched Graphify to read-only-by-default navigation with explicit batched maintenance.
