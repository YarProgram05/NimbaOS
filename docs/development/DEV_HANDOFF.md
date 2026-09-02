# Dev Handoff

Короткая передача только актуального development-контекста. Полная история до структурной чистки сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/DEV_HANDOFF.md`; последующие результаты находятся в `docs/development/DEV_LOG.md`.

Last updated: 2026-09-02.

## Current Objective

Подготовить контролируемый production rollout локальных изменений от 2026-09-01/02, не смешивая его с незавершенной проверкой исторической синхронизации `WB AGNIA` и не выполняя production-действий без явного подтверждения владельца.

## Current Local Delta

- WB API-token expiry: срок JWT показывается без передачи токена в браузер; администратор получает предупреждение за 10 календарных дней до истечения.
- Self-service credentials: пользователь может изменить email/пароль с подтверждением текущего пароля; миграция `20260902120000_user_session_version` отзывает старые сессии.
- Mobile/UI: завершен общий phone-responsive pass и height-responsive dashboard.
- Scheduling: `/sync` использует общий flexible schedule editor; миграция `20260901143000_flexible_sync_schedules` применена только локально.
- Google Sheets automation: общий role-based template editor, Compose credential mapping для app service и FBS movement-sheet workflow; миграция `20260901120000_fbs_movement_sheet_automation` применена только локально.
- FBS Sheet identity: известные физические объединения закреплены точными `account + nmId + chrtId` aliases; последний аудит проверил 62 active tuples без расхождений.

Последняя записанная комплексная проверка: type-check, lint, `git diff --check` и 69 тестов прошли; lint сохраняет два ранее известных предупреждения `<img>`. Перед релизом выполнить проверки повторно на текущем дереве.

## Production Delta

- Mini-PC production работает через Docker; надежный приватный доступ — Tailscale.
- Публичный Cloudflare response path остается непригодным для части российских IPv4-клиентов.
- Изменения и миграции выше еще требуют обычного owner-confirmed release.
- FBS WB write gates не включать как часть этого rollout.

## Safe Next Steps

1. Read-only проверить фактический статус старой очереди `WB AGNIA`; не считать запись `Running` актуальной без проверки.
2. Перед rollout повторить локальные проверки и сверить migration status.
3. После отдельного подтверждения владельца выполнить штатный GitHub Actions production release.
4. После релиза проверить health, вход после session-version migration, Google Sheet connection, workers/schedulers и read-only UI flows.

## Active Risks

- Не деплоить application code для self-service credentials без `20260902120000_user_session_version`.
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
