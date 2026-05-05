# docs/AGENTS.md

Главный короткий файл правил для Codex в проекте NimbaOS. Не превращать его в журнал разработки.

## Project

NimbaOS — закрытая внутренняя веб-платформа для оцифровки кабинетов продавца Wildberries.

Стек: Node.js 22, Next.js 14 App Router, TypeScript strict, PostgreSQL 16, Prisma 7, Redis/Bull MQ, Tailwind CSS v4, shadcn/ui, NextAuth.js.

Канонические документы:
- продуктовая спецификация: `docs/SPECIFICATION.md`;
- решения: `docs/DECISIONS.md`;
- карта документации: `docs/DOCS_INDEX.md`;
- краткая передача контекста: `docs/HANDOFF.md`.

## Session startup rule

В начале новой сессии агент читает только:
1. `docs/AGENTS.md`
2. `docs/DOCS_INDEX.md`
3. `docs/HANDOFF.md`
4. `docs/CURRENT_TASKS.md`

Агент НЕ должен читать все `docs/*.md` по умолчанию.

Дополнительные документы открывать только по задаче:
- требования продукта, MVP, бизнес-логика: `docs/SPECIFICATION.md`;
- текущий статус проекта: `docs/PROJECT_STATE.md`;
- прошлые решения: `docs/DECISIONS.md`;
- структура проекта: `docs/PROJECT_MAP.md`;
- команды запуска, сборки, миграции, тесты, sync/report: `docs/COMMANDS.md`;
- WB данные, свежесть, historical sync, incremental sync: `docs/DATA_FRESHNESS_POLICY.md`;
- БД, запросы, индексы, агрегаты, скорость аналитики: `docs/DATABASE_ACCESS_GUIDE.md`;
- потенциально опасная задача: `docs/SAFETY_RULES.md`;
- баг, ошибка, падение, странное поведение: `docs/BUGS_AND_INCIDENTS.md` и последние записи `docs/DEV_LOG.md`;
- незавершённая работа: `docs/CURRENT_TASKS.md` и `docs/HANDOFF.md`.

## Automatic documentation update rule

После каждой значимой задачи агент сам обновляет нужные `.md` файлы, даже если пользователь отдельно не попросил.

Минимум после каждой задачи:
- обновить `docs/HANDOFF.md`;
- обновить `docs/CURRENT_TASKS.md`;
- добавить запись сверху в `docs/DEV_LOG.md`.

Дополнительно:
- изменилось состояние проекта — обновить `docs/PROJECT_STATE.md`;
- найден или исправлен баг — обновить `docs/BUGS_AND_INCIDENTS.md`;
- принято решение — обновить `docs/DECISIONS.md`;
- появилась новая команда — обновить `docs/COMMANDS.md`;
- изменилась логика данных/API/синхронизации — обновить `docs/DATA_FRESHNESS_POLICY.md`;
- изменилась работа с БД/индексами/агрегатами — обновить `docs/DATABASE_ACCESS_GUIDE.md`;
- появился новый риск — обновить `docs/SAFETY_RULES.md` или `docs/OPEN_QUESTIONS.md`.

## Hard safety

- Не читать и не выводить `.env`, токены и секреты.
- Не менять цены WB, карточки WB и рекламу WB без явного подтверждения.
- Не запускать полную историческую синхронизацию без явного подтверждения.
- Не перезаписывать исторические данные без явного подтверждения.
- Не запускать production-миграции без явного подтверждения.
- Не выполнять destructive-команды без явного подтверждения.
- Для подробных правил см. `docs/SAFETY_RULES.md`.

## Coding defaults

- Server Actions для внутренних мутаций; API Routes только для webhooks/background/public endpoints.
- Server Components по умолчанию; client components только для state/effects/browser APIs.
- `?account=id` в URL должен сохранять выбранный WB кабинет в dashboard-разделах.
- Prisma 7 использует `@prisma/adapter-pg`; не создавать `new PrismaClient()` без adapter.
- БД — источник истины для аналитики; WB API обновляет БД, а не заменяет чтение из БД.
