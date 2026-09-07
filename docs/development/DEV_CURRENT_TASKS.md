# Dev Current Tasks

Только незавершенная работа и короткий список недавно закрытых изменений. Исторический список до 2026-09-02 сохранен в `docs/archive/snapshots/2026-09-02-pre-cleanup/DEV_CURRENT_TASKS.md` и `docs/development/DEV_LOG.md`.

Last updated: 2026-09-07.

## Active

- ID: TASK-AGNIA-SYNC-STATUS-VERIFY
  Status: Needs read-only verification
  Priority: High
  Description: Последняя запись сообщала о production historical sync `WB AGNIA` за диапазон до 2026-08-20, но ее старый статус `Running` нельзя считать текущим без проверки очереди и coverage.
  Next step: Read-only проверить семь runs, coverage и row counts. Не ставить повторно тот же historical range до проверки.
  Risks: WB rate limits; production worker concurrency 1.

## Next

- BUG-037 — Проверить и применить FBS nomenclature/mapping fix и две операционные метрики после отдельного rollout-решения; точные группы, ограничения данных и результаты в `DEV_LOG.md` за 2026-09-07.

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

- 2026-09-04 — Исправлен midnight drift ежедневных schedule fingerprints; CI и production rollout `fdb3f5e` успешны, отчёты и хранение запустились в 02:30.
- 2026-09-04 — Graphify переведён в read-only-by-default режим с отдельным пакетным обслуживанием и без самореферентного `save-result` workflow.
- 2026-09-02 — Production migrations и rollup проверены, локальная БД обновлена свежим production snapshot.
- 2026-09-02 — Исправлена FBS Sheet product identity; 62 active tuples прошли mapping audit.

Подробности и проверки: `docs/development/DEV_LOG.md`.
