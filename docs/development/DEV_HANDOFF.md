# Dev Handoff

## Current Development Objective

Поддерживать реализованный MVP NimbaOS, довести Phase 7/8 live WB verification и future production rollout без нарушения safety rules.

## Last Development Session Summary

2026-05-25: corrected `Заказано руб.` calculation to include cancelled WB orders. The metric now sums all `wb_orders.finishedPrice` rows for the selected period.

2026-05-25: fixed a stuck BullMQ `REPORTS_PERIOD` run after `Missing lock for job 316. moveToDelayed`. Long report syncs no longer force full orders backfill beyond 31 days; worker lock duration was increased. The stuck Galioni run was marked failed, and the prior successful run populated `Заказано руб.`.

2026-05-25: fixed `Заказано руб.` sync gap. `reports.period` now syncs `wb_orders` for the selected period, and orders sync upserts existing rows so WB changes to `finishedPrice` / `isCancel` are reflected locally.

2026-05-25: для подготовки `Утренний отчет WB` добавлены `Заказано руб.` и `ROMI %` в финансовый отчет, `Оборачиваемость, дн.` в остатки, account-wide orders/sales sync через `sales-plan.period`, и локальный сервис `morning-report`. Google Sheet не заполнялся.

## Current Safe Next Step

Для новой development-задачи открыть `AGENTS.md`, `docs/DOCS_INDEX.md`, затем этот файл и `docs/development/DEV_CURRENT_TASKS.md`.

## Active Development Risks

- Very long `reports.period` ranges can still be slow because WB Statistics API is rate-limited; prefer shorter periods for forced orders backfill.
- `reports.period` now also calls WB orders sync; respect the Statistics API rate limit and avoid wide historical ranges without confirmation.

- Не запускать production migrations и full historical sync без подтверждения.
- WB advertising live API может возвращать 429/rate limits.
- Raw report/ad tables могут быть тяжелыми без account/date filters.
- `sales-plan.period` теперь может синхронизировать orders/sales без активного плана; не запускать широкий исторический диапазон без подтверждения.
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

2026-05-25 — добавлены метрики утреннего отчета и подготовлен локальный источник данных.
