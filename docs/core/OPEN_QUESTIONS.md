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

## FBS Stage 2

- Which Chestny Znak True API environment, participant credentials, certificate/signature provider and document types will be used?
- What SLA and owner should apply to commissioning, remote-sale withdrawal, B2B withdrawal and return-to-circulation tasks?
- After live WB smoke tests, which seller warehouses may have `writeEnabled=true` and who approves stock publication?
- Should sticker batches be combined into a printable PDF in addition to current per-order PNG?
- What monitoring channel should receive FBS stock mismatch, overdue order and overdue compliance alerts?
