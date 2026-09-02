# Marketplace Handoff

Короткая передача актуального marketplace-контекста. Полная история до чистки сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/MARKETPLACE_HANDOFF.md`; результаты анализов находятся в `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.

Last updated: 2026-09-02.

## Current Objective

Поддерживать корректный FBS physical-product mapping и движение остатков, затем перейти к регулярной DB-first проверке продаж, остатков, рекламы и план/факта.

## Latest Verified State

- Для FBS Sheet исправлен Nimba tuple `412122105:591014919`: он относится к `синий шифон квадраты`, а не к похожему `парео синий шиф`.
- Повторный аудит по 2026-09-01 проверил 62 active order/stock tuples: ноль mismatches и unresolved mappings.
- Шесть известных физических объединений `туника ↔ парео` закреплены точными tuple aliases; текстовое сходство само по себе не считается основанием для объединения.
- DB-first workflow `Заказы FBS → таблица учета` реализован локально. Production code rollout и включение production schedule остаются отдельными шагами.
- Google Sheet показывает WB stock из свежего локального FBS snapshot отдельно от local movement ledger. Желтые replenishment warnings требуют проверки человеком, а не автоматической корректировки.

## Safe Next Steps

1. Проверить 11 текущих предупреждений `ВНЕСТИ ПОПОЛНЕНИЕ +N` и внести только фактически подтвержденные локальные пополнения.
2. После development rollout отдельно smoke-test production workflow и только затем явно решить, включать ли расписание.
3. Для новых аналитических выводов сначала проверить cabinet, period и freshness локальной БД.

## Active Risks

- Не объединять товары по похожему названию; identity определяется стабильным `account + nmId + chrtId` и подтвержденным alias.
- Не редактировать скрытые технические колонки WB snapshot в Sheet.
- Shipped cancellation/defect не возвращает физический остаток до подтвержденного `RETURN_RECEIVED`.
- Не менять WB prices, cards, ads, budgets или stock без отдельного явного подтверждения.
- Старые аналитические цифры являются историческими observations, а не текущей истиной.

## Read Next If Needed

- Active marketplace work: `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`.
- Analysis history: `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.
- KPI: `docs/marketplace/KPI_DEFINITIONS.md`.
- Data access/freshness: `docs/core/DATABASE_ACCESS_GUIDE.md`, `docs/core/DATA_FRESHNESS_POLICY.md`.

## Do Not Do

- Не запускать historical resync и не записывать данные в WB/Google Sheet без проверки scope и требуемого approval.
- Не переносить полные прошлые анализы или done-task history обратно в handoff.
