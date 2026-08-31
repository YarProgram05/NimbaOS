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

## Automatic Documentation Update Rule

После каждой значимой задачи агент сам обновляет нужные `.md`, даже если пользователь отдельно не попросил.

Development минимум:
- `docs/development/DEV_HANDOFF.md`;
- `docs/development/DEV_CURRENT_TASKS.md`;
- `docs/development/DEV_LOG.md`.

Marketplace минимум:
- `docs/marketplace/MARKETPLACE_HANDOFF.md`;
- `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`;
- `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`, если был анализ или отчет.

Дополнительно обновлять:
- состояние проекта: `docs/core/PROJECT_STATE.md`;
- баги: `docs/development/BUGS_AND_INCIDENTS.md`;
- решения: `DECISIONS.md`;
- команды: `docs/core/COMMANDS.md`;
- данные/API/sync: `docs/core/DATA_FRESHNESS_POLICY.md`;
- БД/индексы/агрегаты: `docs/core/DATABASE_ACCESS_GUIDE.md`;
- риски и вопросы: `docs/core/SAFETY_RULES.md`, `docs/core/OPEN_QUESTIONS.md`.

Last updated: 2026-08-27 - added canonical mini-PC production runbook routing.
