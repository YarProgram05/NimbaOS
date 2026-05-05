# Development Log

## 2026-05-05 — Phase 8 background sync

### Summary

Implemented Bull MQ background sync at code level. Read-only WB syncs now enqueue jobs instead of blocking UI: products, reports + paid storage, sales plan data, advertising campaigns, stats and clusters. Added `SyncJobRun` persistence, worker processor, default daily scheduler and `/sync` status screen.

### Files changed

`prisma/schema.prisma`, `src/lib/queue`, `src/lib/actions/sync.ts`, existing sync actions/UI, `src/app/(dashboard)/sync`, `scripts/sync-worker.ts`, `scripts/schedule-sync.ts`, `package.json`, operational docs.

### Commands run

`npx prisma validate`, `npx prisma generate`, `npm run type-check`, worker/scheduler import smoke checks.

### Result

Phase 8 is implemented at code level. No live WB sync was run. DB schema still needs an explicit local apply before using the new `sync_job_runs` table.

### Issues

Existing dirty worktree from Phase 7/docs remains; no user changes were reverted. Live verification still depends on Redis/PostgreSQL being up and a deliberate read-only job run.

Новые записи добавлять сверху. В начале сессии обычно читать только последние записи.

## 2026-05-05 — Move product specification into docs

### Summary

`SPECIFICATION.md` перенесён из корня проекта в `docs/SPECIFICATION.md`, чтобы важные документы разработки и памяти агента хранились в `docs`. `README.md` оставлен в корне как human-facing entrypoint.

### Files changed

`docs/SPECIFICATION.md`, `docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/CURRENT_TASKS.md`, `docs/DEV_LOG.md`, `docs/BUGS_AND_INCIDENTS.md`, `docs/PROJECT_MAP.md`, `README.md`.

### Commands run

Documentation-only inspection commands. No migrations, no WB sync, no production commands.

### Result

Задачи про продукт, MVP и бизнес-логику теперь маршрутизируются в `docs/SPECIFICATION.md`.

### Issues

Legacy `PROMPTS_GUIDE.md` всё ещё содержит старые упоминания `SPECIFICATION.md`; это архив старых промптов, не актуальный протокол.

### Follow-up

В новых документах ссылаться на `docs/SPECIFICATION.md`.

## 2026-05-05 — Move agent instructions into docs

### Summary

`AGENTS.md` перенесён из корня проекта в `docs/AGENTS.md`, чтобы все инструкции для агента разработки хранились в одной папке `docs`. Обновлены ссылки и протоколы старта сессии.

### Files changed

`docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/SESSION_PROTOCOL.md`, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`, `docs/DEV_LOG.md`, `docs/DECISIONS.md`, `docs/BUGS_AND_INCIDENTS.md`, `docs/PROJECT_MAP.md`, `docs/PROJECT_STATE.md`, `README.md`.

### Commands run

Documentation-only inspection commands. No migrations, no WB sync, no production commands.

### Result

Будущий агент должен начинать с `docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`.

### Issues

Нет.

### Follow-up

Поддерживать путь `docs/AGENTS.md` во всех новых документах.

## 2026-05-05 — Documentation memory rebuild

### Summary

Пересобрана Markdown-документация проекта в систему памяти для будущих Codex-сессий. `docs/AGENTS.md` стал коротким стартовым файлом. Добавлены docs index, handoff, current tasks, project state, dev log, bugs/incidents, session protocol, project map, commands, data freshness policy, database guide, safety rules and open questions. `docs/SPECIFICATION.md` очищен от дневниковости и стал стабильной продуктовой спецификацией.

### Files changed

`docs/AGENTS.md`, `docs/SPECIFICATION.md`, `README.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`, `docs/PROJECT_STATE.md`, `docs/DEV_LOG.md`, `docs/BUGS_AND_INCIDENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/PROJECT_MAP.md`, `docs/COMMANDS.md`, `docs/DATA_FRESHNESS_POLICY.md`, `docs/DATABASE_ACCESS_GUIDE.md`, `docs/SAFETY_RULES.md`, `docs/OPEN_QUESTIONS.md`, `docs/DECISIONS.md`, `CLAUDE.md`.

### Commands run

Documentation-only inspection commands. No migrations, no WB sync, no production commands.

### Result

Future agents should start with only four documents and use `docs/DOCS_INDEX.md` to decide what else to read.

### Issues

PowerShell output may display mojibake for Cyrillic, but files are intended as UTF-8 Markdown.

### Follow-up

Keep `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`, and `docs/DEV_LOG.md` updated after every significant task.

## 2026-05-05 — Phase 7 completion pass

### Summary

Advertising Phase 7 was completed at code level: pause action was connected, per-nm advertising spend was stored for reports, WB client long-429 handling was improved, and a debug script was added for live advert endpoint checks.

### Files changed

Code and schema files changed in the previous task. See git history/diff for exact code paths.

### Commands run

`npx prisma validate`, `npx prisma generate`, `npx prisma db push`, `npm run type-check`, `npx tsx scripts/debug-advertising.ts`.

### Result

Prisma and TypeScript checks passed. Local DB was synced with the new ad stats table.

### Issues

WB advert API returned `429` with a long retry window, so full live verification remains blocked. `next dev` also hung at `Starting...` during manual local server check.

### Follow-up

Repeat live Phase 7 verification after the WB advert rate-limit window.
