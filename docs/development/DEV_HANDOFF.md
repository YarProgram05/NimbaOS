# Dev Handoff

## Current Development Objective

Поддерживать реализованный MVP NimbaOS, довести Phase 7/8 live WB verification и future production rollout без нарушения safety rules.

## Last Development Session Summary

2026-05-24: документация пересобрана под три зоны `docs/core`, `docs/development`, `docs/marketplace`. Код, конфиги, Prisma schema, `.env` и данные не менялись.

## Current Safe Next Step

Для новой development-задачи открыть `AGENTS.md`, `docs/DOCS_INDEX.md`, затем этот файл и `docs/development/DEV_CURRENT_TASKS.md`.

## Active Development Risks

- Не запускать production migrations и full historical sync без подтверждения.
- WB advertising live API может возвращать 429/rate limits.
- Raw report/ad tables могут быть тяжелыми без account/date filters.
- Старые flat `docs/*.md` теперь legacy redirects/archives.

## Read Next If Needed

- `docs/core/ARCHITECTURE.md`
- `docs/core/DATA_MODEL.md`
- `docs/core/WB_API_MAP.md`
- `docs/core/DATABASE_ACCESS_GUIDE.md`
- `docs/development/BUGS_AND_INCIDENTS.md`
- `DECISIONS.md`

## Do Not Do

- Не читать `.env`.
- Не менять WB prices/cards/ads/feedback answers без подтверждения.
- Не запускать migrations/sync worker/scheduler без причины и разрешения.
- Не читать все docs подряд.

## Last Updated

2026-05-24 — создан development handoff для новой 3-zone документации.

