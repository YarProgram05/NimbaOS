# Dev Current Tasks

Только незавершенная работа и короткий список недавно закрытых изменений. Исторический список до 2026-09-02 сохранен в `docs/archive/snapshots/2026-09-02-pre-cleanup/DEV_CURRENT_TASKS.md` и `docs/development/DEV_LOG.md`.

Last updated: 2026-09-02.

## Active

- ID: TASK-AGNIA-SYNC-STATUS-VERIFY
  Status: Needs read-only verification
  Priority: High
  Description: Последняя запись сообщала о production historical sync `WB AGNIA` за диапазон до 2026-08-20, но ее старый статус `Running` нельзя считать текущим без проверки очереди и coverage.
  Next step: Read-only проверить семь runs, coverage и row counts. Не ставить повторно тот же historical range до проверки.
  Risks: WB rate limits; production worker concurrency 1.

- ID: TASK-LOCAL-ROLLUP-RELEASE-2026-09-02
  Status: Awaiting explicit production approval
  Priority: High
  Description: Подготовлен общий локальный delta: token-expiry alerts, self-service credentials/session revocation, mobile/dashboard UI, flexible sync schedules, shared Sheets template editor, app credential mapping и FBS Sheet workflow/mapping fixes.
  Next step: Повторить локальные проверки, сверить migration status, затем использовать штатный GitHub Actions release только после подтверждения владельца.
  Related migrations: `20260901120000_fbs_movement_sheet_automation`, `20260901143000_flexible_sync_schedules`, `20260902120000_user_session_version`.
  Risks: Не разделять credential code и session-version migration; не включать FBS WB write gates; после rollout старые пользовательские сессии потребуют повторного входа.

## Next

- ID: TASK-P7-P8-LIVE-VERIFY
  Status: Pending
  Priority: High
  Description: Завершить bounded read-only smoke matrix для WB sync jobs после проверки AGNIA и с учетом rate-limit окон.
  Next step: Согласовать кабинеты, периоды и допустимые live API calls.
  Risks: WB 429, долгие retries, неполная advertising coverage.

## Blocked

- ID: TASK-PUBLIC-INGRESS-NON-CLOUDFLARE
  Status: Blocked by ISP/public-ingress choice
  Priority: High
  Description: Cloudflare response path нестабилен для части российских IPv4-клиентов; small responses могут проходить, а Next.js assets — обрываться.
  Next step: Получить public/static IPv4 и настроить direct HTTPS/DNS-only либо выбрать иной non-Cloudflare ingress. До этого использовать trusted Tailscale access.
  Risks: Не публиковать PostgreSQL, Redis или SSH.

## Done Recently

- 2026-09-02 — Добавлены token expiry dates/admin warnings и self-service credential changes с session revocation.
- 2026-09-02 — Исправлена FBS Sheet product identity; 62 active tuples прошли mapping audit.
- 2026-09-01 — Завершены mobile pass, flexible schedules, shared Sheets settings и FBS movement-sheet workflow.

Подробности и проверки: `docs/development/DEV_LOG.md`.
