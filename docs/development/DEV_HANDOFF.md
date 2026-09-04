# Dev Handoff

Короткая передача только актуального development-контекста. Полная история до структурной чистки сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/DEV_HANDOFF.md`; последующие результаты находятся в `docs/development/DEV_LOG.md`.

Last updated: 2026-09-04.

## Current Objective

Read-only проверить фактический статус старой исторической синхронизации `WB AGNIA` и наблюдать следующие плановые runs после исправления midnight drift расписаний, не повторяя уже выполненную ручную синхронизацию карточек.

## Current Local Delta

- Production runtime работает на `fdb3f5e0b3e8808b455a2f967c3b2680834a7a80`; последующий delta в `main` относится только к документации и памяти агента.
- Локальная `wb_cabinet` обновлена 2026-09-02 из проверенного production snapshot; схема содержит все 16 repository migrations.
- Известного application/schema delta, требующего нового production rollout, нет.

Для scheduler fix прошли type-check, 71 тест, lint и `git diff --check`; lint сохраняет два ранее известных предупреждения `<img>`. CI run `33817010275` и production workflow `33817076564` завершились успешно.

## Production Delta

- Mini-PC production работает через Docker; надежный приватный доступ — Tailscale.
- Публичный Cloudflare response path остается непригодным для части российских IPv4-клиентов.
- Production release `fdb3f5e` устранил ложный skip `scheduled job belongs to a replaced schedule`: daily fingerprints больше не зависят от неиспользуемого текущего `anchorDate`.
- Отчёты и хранение 2026-09-04 создали реальные runs в 02:30. Карточки пользователь синхронизировал вручную; повторный recovery не нужен.
- После rollout app/PostgreSQL/Redis были healthy, оба worker работали.
- FBS WB write gates не включать как часть этого rollout.

## Safe Next Steps

1. Read-only проверить фактический статус старой очереди `WB AGNIA`; не считать запись `Running` актуальной без проверки.
2. Read-only проверить следующие запланированные sync/automation runs; не ставить повторно карточки, уже выполненные пользователем.
3. При следующем application/schema delta повторить локальные проверки и сверить migration status перед новым rollout.
4. Любой следующий production release выполнять только через штатный owner-confirmed GitHub Actions workflow.

## Active Risks

- Saving enabled schedule немедленно заменяет BullMQ schedulers соответствующей задачи.
- Не печатать Google credential или WB tokens; проверять только наличие и безопасный результат запроса.
- Не запускать повторную историческую синхронизацию AGNIA, пока старые runs не проверены.
- Не запускать `next dev` и `next build` одновременно в одном checkout: это может сломать `.next` assets активного dev server.

## Read Next If Needed

- Production: `docs/core/MINI_PC_RUNBOOK.md`.
- Release commands: `docs/core/COMMANDS.md`.
- Active work: `docs/development/DEV_CURRENT_TASKS.md`.
- Active bugs: `docs/development/BUGS_AND_INCIDENTS.md`.
- Historical detail: `docs/development/DEV_LOG.md` and the archived pre-cleanup snapshot.

## Do Not Do

- Не выполнять production deploy, migration, restore, destructive DB action или WB write без явного запроса.
- Не читать и не выводить `.env`, credentials или расшифрованные WB API keys.
- Не переносить завершенные задачи и полные session summaries обратно в этот файл.
