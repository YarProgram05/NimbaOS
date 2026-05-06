# Open Questions

## OQ-001: Phase 7 live verification timing

Status: Open  
Question: Когда повторить live verification рекламы после WB advert API long 429?  
Context: `scripts/debug-advertising.ts` получил rate-limit retry около 42 минут.  
Needed decision: Повторить вручную позже или использовать Phase 8 worker для одного безопасного read-only job после подготовки dev DB/Redis.

## OQ-002: Phase 8 background sync priority

Status: Closed  
Decision: Перевести все read-only WB sync в Bull MQ: products, reports + paid storage, sales plan orders/sales/funnel, advertising campaigns/stats/clusters. Default schedule — осторожный дневной по Europe/Moscow; UI — мини-экран `/sync`.  
Closed in: Phase 8 implementation, 2026-05-05.

## OQ-003: Phase 9 production target

Status: Closed  
Question: Какой production target считать основным: VPS Docker Compose only или Vercel-compatible deployment тоже нужен?  
Context: Specification historically mentions VPS Docker Compose.  
Decision: VPS Docker Compose is the primary Phase 9 production target. Vercel-compatible deployment is out of Phase 9 unless requested separately.

## OQ-004: Deleted legacy plan files

Status: Open  
Question: Нужно ли когда-нибудь восстанавливать уже удалённые старые plan docs (`PHASE6_PLAN.md`, `Plan_Phase_7_converted.md`, `faza 5 plan.md`)?  
Context: Пользователь выбрал не восстанавливать сейчас.  
Needed decision: Только если понадобится архив старых планов.
