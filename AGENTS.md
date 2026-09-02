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

Затем по типу задачи:
- development: `docs/development/DEV_HANDOFF.md`, `docs/development/DEV_CURRENT_TASKS.md`;
- marketplace: `docs/marketplace/MARKETPLACE_HANDOFF.md`, `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`;
- mixed: только релевантные handoff/current task документы.

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

Graphify is the project memory and navigation index. Its project-scoped skill lives at `.codex/skills/graphify/`; graph outputs live in `graphify-out/`. The user does not need to invoke `/graphify`: apply this workflow automatically whenever it is relevant.

### Graph-first navigation

1. If `graphify-out/graph.json` exists and is current for the relevant sources, use Graphify before broad `rg` searches or mass file reading.
2. At the start of graph work, refresh/read `graphify-out/reflections/LESSONS.md` according to the Graphify skill, then use `graphify query` for a scoped subgraph, `graphify path` for a dependency/flow and `graphify explain` for one entity.
3. Use returned `source_file` and `source_location` values to open only the exact source files or necessary sections. Do not reread many Markdown files merely for general orientation.
4. Use `graphify-out/wiki/index.md` for broad navigation when present. Read `graphify-out/GRAPH_REPORT.md` only for a graph-wide audit or when query/path/explain is insufficient.
5. Dirty generated files in `graphify-out/` are normal and do not invalidate the graph. If the graph is known to be stale, update it or navigate directly to the relevant source until it is synchronized.

### Source of truth

- Graphify is an index and memory/navigation layer, not an authority that replaces project sources.
- Code, active Markdown documentation, KPI/metric definitions, analytical methodology, data contracts and decision records remain the source of truth.
- Confirm exact formulas, contracts, implementation details and consequential claims in their source before changing code or presenting a final conclusion.

### Memory update after substantial work

Treat a task as graph-relevant when it changes architecture, business logic, analytical methods, KPI/metric definitions, data contracts, documentation, important decisions or component relationships.

For every graph-relevant change:

1. Update the appropriate source of truth first.
2. If an important decision exists only in the conversation, record it in `DECISIONS.md` or the relevant canonical document before updating the graph.
3. Run the project-scoped Graphify incremental update according to `.codex/skills/graphify/SKILL.md`.
4. Verify with a focused query, path or explanation that the changed entities, sources and relationships are present and correct.
5. Do not consider the substantive task complete until its source of truth and Graphify are synchronized. If synchronization cannot be completed, report the graph as stale and state the exact reason.

Routine edits that do not change project knowledge or relationships do not require a graph rebuild.

Last updated: 2026-09-02 - established Graphify-first project memory workflow.
