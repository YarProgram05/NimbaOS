# Documentation Index

Главный справочник по документации. В начале новой сессии читать только `docs/AGENTS.md`, этот файл, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`. Остальные документы открывать по задаче.

## docs/AGENTS.md

Purpose:
Короткие обязательные правила для Codex: старт сессии, автоматическое обновление документации, hard safety, базовые coding defaults.

Read when:
Всегда в начале новой сессии.

Update when:
Меняются правила работы агента, стартовый протокол, обязательные safety-ограничения или документационный workflow.

Do not store here:
Историю фаз, длинные баг-расследования, подробные схемы БД, полную продуктовую спецификацию.

Related docs:
`docs/SESSION_PROTOCOL.md`, `docs/SAFETY_RULES.md`, `docs/HANDOFF.md`.

## docs/SPECIFICATION.md

Purpose:
Стабильная продуктовая спецификация: цель, пользователи, MVP, бизнес-правила, основные модули, границы продукта.

Read when:
Задача касается требований продукта, MVP, бизнес-логики, спорного поведения или изменения границ продукта.

Update when:
Меняются продуктовые требования, бизнес-правила, границы MVP, поддерживаемые маркетплейсы или критерии успеха.

Do not store here:
Дневник разработки, текущие задачи, баги, команды, временные заметки по сессиям.

Related docs:
`docs/PROJECT_STATE.md`, `docs/DECISIONS.md`, `docs/DATA_FRESHNESS_POLICY.md`.

## docs/DECISIONS.md

Purpose:
Канонический журнал архитектурных и продуктовых решений.

Read when:
Нужно понять, почему система устроена определённым образом, или задача может конфликтовать с прошлым решением.

Update when:
Принято новое решение, старое решение устарело, решение отклонено или superseded.

Do not store here:
Пошаговые dev-логи, текущие задачи, баги без принятого решения.

Related docs:
`docs/SPECIFICATION.md`, `docs/PROJECT_STATE.md`, `docs/DEV_LOG.md`.

## docs/DOCS_INDEX.md

Purpose:
Маршрутизатор документации: что читать и обновлять для каждого типа задач.

Read when:
Всегда в начале новой сессии и перед выбором дополнительных документов.

Update when:
Добавлен, удалён или изменён смысл любого проектного `.md`.

Do not store here:
Подробную историю, технические детали реализации, полные правила safety.

Related docs:
Все проектные `.md`.

## docs/HANDOFF.md

Purpose:
Короткая передача контекста для новой сессии.

Read when:
Всегда в начале новой сессии и после context compaction.

Update when:
После каждой значимой задачи или при явной команде завершить/обновить контекст.

Do not store here:
Длинный дневник, детальные баг-расследования, полные списки фаз.

Related docs:
`docs/CURRENT_TASKS.md`, `docs/DEV_LOG.md`, `docs/PROJECT_STATE.md`.

## docs/CURRENT_TASKS.md

Purpose:
Короткий список активных, следующих, заблокированных и недавно закрытых задач.

Read when:
Всегда в начале новой сессии; при незавершённой работе.

Update when:
После каждой значимой задачи, при изменении приоритетов, блокеров или next steps.

Do not store here:
Подробную историю выполнения, длинные заметки по багам.

Related docs:
`docs/HANDOFF.md`, `docs/PROJECT_STATE.md`, `docs/BUGS_AND_INCIDENTS.md`.

## docs/PROJECT_STATE.md

Purpose:
Текущее состояние проекта: реализовано, частично готово, не реализовано, важные модули, состояние данных.

Read when:
Нужно понять текущую фазу, готовность модулей или что уже реализовано.

Update when:
Фаза или модуль меняет статус, появляется deprecated-подход, меняется состояние данных/sync/reports.

Do not store here:
Подробные dev-log записи, все решения, все баги.

Related docs:
`docs/CURRENT_TASKS.md`, `docs/SPECIFICATION.md`, `docs/DEV_LOG.md`.

## docs/DEV_LOG.md

Purpose:
Журнал выполненной работы. Новые записи добавляются сверху.

Read when:
Нужно понять последние изменения, особенно при баге или после незавершённой сессии. Обычно читать только последние записи.

Update when:
После каждой значимой задачи.

Do not store here:
Краткий handoff, канонические решения, текущий task board.

Related docs:
`docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`, `docs/BUGS_AND_INCIDENTS.md`.

## docs/BUGS_AND_INCIDENTS.md

Purpose:
Баги, инциденты, симптомы, расследования и фиксы.

Read when:
Задача про ошибку, падение, странное поведение, WB 429, зависание dev server, расхождение данных.

Update when:
Найден, расследован, исправлен или закрыт баг/инцидент.

Do not store here:
Обычные задачи без симптомов, продуктовые требования.

Related docs:
`docs/DEV_LOG.md`, `docs/CURRENT_TASKS.md`, `docs/SAFETY_RULES.md`.

## docs/SESSION_PROTOCOL.md

Purpose:
Чёткий протокол начала и завершения сессии.

Read when:
Новая сессия, context compaction, пользователь просит завершить/обновить контекст.

Update when:
Меняется порядок старта/завершения, набор обязательных документов или правила handoff.

Do not store here:
Текущий handoff, конкретные задачи, историю выполнения.

Related docs:
`docs/AGENTS.md`, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`.

## docs/PROJECT_MAP.md

Purpose:
Карта проекта: где лежат ключевые модули, UI, actions, services, WB API слой, scripts.

Read when:
Задача про структуру проекта, поиск места для изменения, onboarding.

Update when:
Появились новые важные директории, модули или изменились ownership boundaries.

Do not store here:
Полные описания бизнес-логики, историю решений, все файлы проекта.

Related docs:
`docs/SPECIFICATION.md`, `docs/DATABASE_ACCESS_GUIDE.md`.

## docs/COMMANDS.md

Purpose:
Команды проекта и уровень их безопасности.

Read when:
Нужно запускать dev server, type-check, Prisma, Docker, sync/debug scripts, tests.

Update when:
Добавилась команда, изменился риск команды, появилась новая безопасная/опасная процедура.

Do not store here:
Секреты, значения env, подробные баг-расследования.

Related docs:
`docs/SAFETY_RULES.md`, `docs/DATABASE_ACCESS_GUIDE.md`.

## docs/DATA_FRESHNESS_POLICY.md

Purpose:
Правила свежести данных: когда читать из БД, когда обновлять через WB API, как обращаться с историческими данными.

Read when:
Задача про WB данные, отчёты, sync, incremental sync, historical sync, stale data.

Update when:
Меняется sync-логика, источник истины, периодичность обновлений, правила исторической загрузки.

Do not store here:
SQL-рецепты и индексы; они в `docs/DATABASE_ACCESS_GUIDE.md`.

Related docs:
`docs/DATABASE_ACCESS_GUIDE.md`, `docs/SAFETY_RULES.md`.

## docs/DATABASE_ACCESS_GUIDE.md

Purpose:
Как безопасно и быстро получать данные из БД; raw/normalized/aggregate таблицы, индексы, нежелательные запросы.

Read when:
Задача про БД, запросы, агрегаты, скорость аналитики, индексы, прямую диагностику данных.

Update when:
Изменились таблицы, индексы, report services, агрегаты или подход к чтению данных.

Do not store here:
Продуктовые требования и общую freshness-политику.

Related docs:
`docs/DATA_FRESHNESS_POLICY.md`, `docs/PROJECT_MAP.md`.

## docs/SAFETY_RULES.md

Purpose:
Запреты, подтверждения, production safety, секреты, WB-changing actions.

Read when:
Задача потенциально опасна: `.env`, токены, цены WB, карточки, реклама, sync, миграции, destructive commands.

Update when:
Появился новый риск, новая опасная команда, новый внешний side effect.

Do not store here:
Обычные команды без safety-контекста, подробную спецификацию продукта.

Related docs:
`docs/AGENTS.md`, `docs/COMMANDS.md`, `docs/DATA_FRESHNESS_POLICY.md`.

## docs/OPEN_QUESTIONS.md

Purpose:
Неясности, требующие уточнения или будущего решения.

Read when:
Задача касается спорной области, blocked work, Phase 8/9 planning или неизвестного поведения WB.

Update when:
Появился или решился открытый вопрос.

Do not store here:
Закрытые решения; переносить их в `docs/DECISIONS.md`.

Related docs:
`docs/CURRENT_TASKS.md`, `docs/DECISIONS.md`.

## README.md

Purpose:
Короткий human-facing вход в проект: что это, где документация, базовые команды.

Read when:
Нужно быстро понять проект вне Codex-сессии.

Update when:
Меняются базовые команды или главный путь к документации.

Do not store here:
Память агента, dev-log, подробную спецификацию.

Related docs:
`docs/AGENTS.md`, `docs/DOCS_INDEX.md`.

## PROMPTS_GUIDE.md

Purpose:
Legacy archive старых фазовых промптов для Claude Code.

Read when:
Нужно восстановить старые prompt-шаблоны или понять исходный фазовый план.

Update when:
Обычно не обновлять; только если специально поддерживается архив промптов.

Do not store here:
Актуальные правила Codex-сессий. Они в `docs/AGENTS.md` и `docs/SESSION_PROTOCOL.md`.

Related docs:
`docs/DEV_LOG.md`, `docs/PROJECT_STATE.md`.
