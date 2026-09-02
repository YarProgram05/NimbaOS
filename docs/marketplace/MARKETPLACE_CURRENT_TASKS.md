# Marketplace Current Tasks

Только активная/следующая marketplace-работа. История до 2026-09-02 сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/MARKETPLACE_CURRENT_TASKS.md` и `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.

Last updated: 2026-09-02.

## Active

- ID: MKT-FBS-REPLENISHMENT-REVIEW
  Status: Needs owner/operator review
  Priority: High
  Description: В FBS accounting Sheet остаются 11 предупреждений о вероятно пропущенных локальных пополнениях.
  Next step: Сверить каждое предупреждение с фактическим движением товара и внести только подтвержденные replenishment events.
  Risks: WB snapshot не должен автоматически переписывать physical movement ledger.

## Next

- ID: MKT-DAILY-BASELINE
  Status: Pending
  Priority: High
  Description: Провести первую регулярную проверку продаж, остатков, рекламы, план/факта и карточек.
  Next step: Выбрать кабинет/период и проверить freshness локальной БД.
  Risks: Текущий период может быть неполным.

- ID: MKT-KPI-THRESHOLDS
  Status: Pending
  Priority: Medium
  Description: Зафиксировать owner-approved thresholds для DRR, margin, buyout, conversion и stock coverage.
  Next step: Получить значения от владельца или подготовить bounded historical baseline.
  Risks: До утверждения thresholds рекомендации должны оставаться осторожными.

- ID: MKT-FBS-WORKFLOW-ROLLOUT
  Status: Awaiting development rollout and explicit enablement
  Priority: High
  Description: Локальный FBS Sheet workflow реализован и проверен, но production schedule не должен включаться автоматически.
  Next step: После production deploy выполнить read-only/safe smoke test worker и затем отдельно согласовать schedule enablement.
  Risks: Unknown tuple должен останавливать run; shipped cancellation/defect не является accepted return.

## Blocked

- ID: MKT-AUTO-OWNER-SUMMARY
  Status: Blocked by product decision
  Priority: Medium
  Description: Не определены формат, канал и расписание weekly owner summary.
  Next step: Уточнить ожидаемый output и notification policy.

## Done Recently

- 2026-09-02 — Исправлен один FBS product alias; все 62 active tuples прошли повторный аудит.
- 2026-09-01 — Реализован DB-first FBS movement Sheet workflow и initial live-sheet reconciliation.
- 2026-08-24 — Заполнен `OZON Unit 3.0` для двух Ozon cabinets из предоставленного source pack.

Подробности: `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.
