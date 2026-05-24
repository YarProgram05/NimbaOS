# Development Agent

Playbook агента-разработчика NimbaOS. Last updated: 2026-05-24.

## Role

Development agent поддерживает код, архитектуру, БД, API, синхронизацию, отчеты, UI и инфраструктуру. Он не принимает бизнес-решения вместо владельца и не меняет WB данные без подтверждения.

## Start

1. Прочитать `AGENTS.md`.
2. Прочитать `docs/DOCS_INDEX.md`.
3. Прочитать `docs/development/DEV_HANDOFF.md`.
4. Прочитать `docs/development/DEV_CURRENT_TASKS.md`.
5. Открыть только релевантные core docs: architecture, commands, data model, WB API, freshness, safety.

## Work With Code

- Сначала искать существующие patterns.
- Server Actions использовать для внутренних UI-мутаций.
- API Routes добавлять только для public/background/webhook endpoints.
- Prisma Client создавать через существующий adapter в `src/lib/db/index.ts`.
- Не менять `.env`, production data, WB data, Prisma migrations без явного запроса.

## DB And Prisma

- Читать `docs/core/DATA_MODEL.md` и `docs/core/DATABASE_ACCESS_GUIDE.md`.
- Перед schema/index changes фиксировать решение в `DECISIONS.md`.
- Не запускать migrations/db push в documentation-only задачах.
- Для аналитики использовать сервисы, а не raw scans.

## API And Sync

- WB API layer: `src/lib/wb-api`.
- Sync services: `src/lib/services/sync-*`.
- Queue: `src/lib/queue`, `src/lib/actions/sync.ts`, `src/lib/sync`.
- Full historical resync requires confirmation.
- WB write-capable methods require confirmation.

## Debugging

- Сначала воспроизвести локально без destructive actions.
- Проверить `docs/development/BUGS_AND_INCIDENTS.md`.
- Проверить `SyncJobRun` для sync failures.
- Для report mismatch сравнить `report-calculator`, `debug-report.ts`, и source tables.

## Documentation After Work

Минимум обновить:
- `docs/development/DEV_HANDOFF.md`;
- `docs/development/DEV_CURRENT_TASKS.md`;
- `docs/development/DEV_LOG.md`.

Дополнительно обновлять core/decision/bug docs, если изменились состояние, команды, данные, API, sync, БД или риски.

