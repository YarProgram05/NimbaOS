# Active Bugs And Incidents

Только открытые проблемы и fixes, ожидающие rollout/verification. Полный ledger до 2026-09-02 сохранен в `docs/archive/snapshots/2026-09-02-pre-cleanup/BUGS_AND_INCIDENTS.md`.

Last updated: 2026-09-02.

## Active

### BUG-030 / BUG-026: Public Cloudflare path is unreliable

Status: Open; root cause bounded to the Cloudflare response path for affected Russian IPv4 clients.

Impact: HTML/API responses могут выглядеть healthy, но крупные Next.js assets обрываются, поэтому login не гидратируется.

Current workaround: trusted Tailscale access. Preferred resolution: public/static ISP IPv4 with direct HTTPS and DNS-only records, or another non-Cloudflare ingress.

Safety: Не публиковать PostgreSQL, Redis или SSH.

### BUG-005: Product prices can remain blank after WB rate limits

Status: Open.

Impact: Product-card sync может сохранить карточку раньше успешного price refresh.

Next step: Проверять affected account after rate-limit window и проектировать bounded retry, не запуская broad historical work.

### BUG-004: Phase 7/8 sync smoke matrix incomplete

Status: Investigating.

Next step: После проверки старых AGNIA runs согласовать bounded read-only matrix по кабинетам, sync kinds и периодам.

### BUG-002: `next dev` may hang at Starting

Status: Open/intermittent.

First checks: подтвердить, что порт и `.next` принадлежат текущему checkout; не запускать `next dev` и `next build` одновременно.

### BUG-001: WB advertising API long 429 retry

Status: Open.

Impact: Advertising sync может долго удерживать единственный worker.

Next step: Сохранять bounded periods и наблюдать rate-limit/retry telemetry без повторного широкого sync.

## Fixed Locally, Pending Production Verification

- BUG-036 — FBS Sheet wrong physical-product alias; Sheet исправлен, code deployment pending.
- BUG-035 — phone layouts; local responsive pass complete.
- BUG-034 — Google Sheet connection inspection lacked app-service credential mapping; Compose fix pending rollout.

## Archive Rule

После production verification краткий итог переносится в `docs/development/DEV_LOG.md`, а запись удаляется из этого active index. Детальное расследование остается в датированном архиве и Git history.
