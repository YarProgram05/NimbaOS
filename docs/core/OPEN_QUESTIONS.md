# Open Questions

Открытые вопросы для владельца проекта и будущих агентов. Last updated: 2026-05-24.

## Data And Performance

- Нужны ли materialized views или summary tables для daily account/nm sales, ad spend, stock risk and dashboard periods?
- Какие реальные объемы `realization_reports`, `wb_orders`, `wb_sales`, ad stats ожидаются через 6-12 месяцев?
- Нужны ли дополнительные индексы после EXPLAIN на production-like данных?

## Sync

- Какой период считать свежим для каждого домена: reports, ads, stocks, reviews, funnel?
- Нужно ли запрещать repeated historical sync на уровне UI/service, а не только через правила docs?
- Какой полный safe smoke matrix нужен для Phase 7/8 live verification?

## Marketplace Logic

- Какие thresholds владелец считает нормой для DRR, margin, buyout, conversion, stock coverage?
- Какие отчеты должны быть ежедневными, а какие weekly owner summary?
- Какие действия агент может только рекомендовать, а какие можно автоматизировать после отдельного approval flow?

## Production

- Production rollout target and schedule need confirmation.
- Monitoring/alerting channel for sync failures is not defined.
- Backup/restore policy for PostgreSQL needs explicit runbook.

## Documentation

- Старые `docs/*.md` сохранены как legacy redirects/archives; можно ли удалить их позже после подтверждения?
