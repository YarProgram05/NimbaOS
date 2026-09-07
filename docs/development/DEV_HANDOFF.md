# Dev Handoff

Короткая передача только актуального development-контекста. Полная история до структурной чистки сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/DEV_HANDOFF.md`; последующие результаты находятся в `docs/development/DEV_LOG.md`.

Last updated: 2026-09-07.

## Current Objective

Отдельно разобрать Excel-приходы и пробелы доказательств приёмки WB после подтверждённого восстановления FBS Sheet, не превращая кандидатов в импортированные движения.

## Current Local Delta

- Production runtime работает на `c04011a49e72cdae7ad141f551f6da0f7b41100c`; текущий follow-up относится к документации и не требует второго runtime deploy.
- Локальная `wb_cabinet` обновлена 2026-09-02 из проверенного production snapshot; схема содержит все 16 repository migrations.
- Результаты marketplace-сверки сохранены в каноническом журнале; Excel-приходы остаются кандидатами, а 118 случаев без индивидуального статусного подтверждения приёмки — unresolved.

Результаты реализации, 153 локальных тестов, type-check/build/lint и полный rollout evidence находятся в `docs/development/DEV_LOG.md`, запись 2026-09-07.

## Production Delta

- Mini-PC production работает через Docker; надежный приватный доступ — Tailscale.
- Публичный Cloudflare response path остается непригодным для части российских IPv4-клиентов.
- Deploy #15 (`34123140699`) успешен; app и оба worker используют новый image, health endpoint — HTTP 200. Current-stock jobs обоих кабинетов и первый FBS Sheet run завершились успешно.
- Номенклатура зарегистрирована, live review не показывает несопоставленных товаров. Новые показатели сохранены как нижние границы из-за legacy Sheet-date diagnostics; физические предупреждения требуют отдельной сверки. Время расписаний не менялось.
- BUG-037 закрыт: независимое сравнение первого запуска, идемпотентный повтор и строгая сверка финального снимка прошли. Защищённые строки, формулы, локальные балансы и конфигурация сохранены; повтор изменил только контрольные timestamps. FBS WB write gates не включались.

## Safe Next Steps

1. Подготовить review Excel receipt candidates с исходными ячейками, датами и точными товарами; до подтверждения не импортировать историю. Разбирать 118 неизвестных подтверждений приёмки отдельно от финансовой обработки WB.
2. Read-only проверить фактический статус старой очереди `WB AGNIA`; не считать запись `Running` актуальной без проверки и не повторять тот же historical range.
3. Наблюдать штатные sync/automation runs. Любой новый production release выполнять только по отдельному явному запросу; docs-only follow-up не требует второго deploy.

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
