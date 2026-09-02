# Open Questions

Только нерешенные owner/product questions. Решенные пункты переносятся в `DECISIONS.md` или role log, а не остаются здесь.

Last updated: 2026-09-02.

## Data And Performance

- При каких объемах нужно вводить persisted daily aggregates/materialized views для reports, dashboard, ads и stock risk?
- Какие production-like EXPLAIN/latency thresholds должны запускать index/aggregate work?

## Sync And Monitoring

- Какой freshness SLA нужен для reports, ads, stocks, reviews, funnel и FBS?
- Какой bounded smoke matrix закроет Phase 7/8 live verification?
- Какой канал должен получать sync/automation failure alerts?

## Marketplace Policy

- Какие owner-approved thresholds считаются нормой для DRR, margin, buyout, conversion и stock coverage?
- Какие reports должны быть daily, weekly и owner-summary?
- Какие actions можно автоматизировать только после отдельного approval-flow design?

## Production And Access

- Какой non-Cloudflare public ingress выбрать: public/static ISP IPv4 with direct HTTPS или другой route?
- Какой external monitoring/alerting нужен поверх current healthcheck и persisted run histories?

## FBS Stage 2

- Какие True API environment, participant credentials, certificate/signature provider и document types будут использованы?
- Какой SLA/owner нужен для commissioning, withdrawal, B2B withdrawal и return-to-circulation tasks?
- Какие seller warehouses могут получить `writeEnabled=true` после reconciliation и кто это подтверждает?
- Нужен ли printable sticker-batch PDF в дополнение к current per-order PNG?

## Knowledge Graph

- Какие архивные классы нужно полностью исключить из Graphify, а какие оставить как explicitly historical corpus?
