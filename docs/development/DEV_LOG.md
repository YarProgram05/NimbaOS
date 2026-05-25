# Development Log

## 2026-05-25 - Ordered rub includes cancelled orders

### Summary
Corrected business definition of `Заказано руб.`: it must include all WB orders, including cancelled orders, because it represents the original ordered ruble volume, not fulfilled/non-cancelled orders.

### Files changed
`src/lib/services/report-calculator.ts`, report column tooltip, docs.

### Verification
For Galioni `2026-01-01` - `2026-05-24`, all orders sum is 2783846.47 vs report sale 1571692.94 (`1.77x`, buyout 58.66%). The previous non-cancelled calculation was only 1846684.89 (`1.17x`).

## 2026-05-25 - BullMQ lock fix for long report sync

### Summary
Investigated stuck `REPORTS_PERIOD` job `316` for Galioni (`2026-01-01` - `2026-05-24`). BullMQ lost the active job lock while trying to move the job to delayed/retry state, leaving `SyncJobRun` stuck as `RUNNING`.

### Files changed
`src/lib/queue/index.ts`, `src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`; checked BullMQ job state and `SyncJobRun`; verified report summary after the successful prior job.

### Result
Worker lock duration is now longer, report sync only forces full orders backfill for periods up to 31 days, stuck run `316` was marked `FAILED`, and worker was restarted. The previous successful run `315` populated orders; after definition correction, report summary for `2026-01-01` - `2026-05-24` should show `Заказано руб.` from all order rows, including cancellations.

## 2026-05-25 - Orders sync repair for ordered rub

### Summary
Fixed `Заказано руб.` freshness: report sync now also syncs WB orders for the selected period, and orders sync can force a full bounded backfill instead of starting from the newest local `lastChangeDate`.

### Files changed
`src/lib/services/sync-orders.ts`, `src/lib/queue/sync-processor.ts`, docs.

### Commands run
`npm run type-check`.

### Result
`wb_orders` rows are now upserted by `(wbAccountId, srid)`, so changed WB order fields such as `finishedPrice` and `isCancel` update existing local rows. Manual/scheduled `reports.period` sync includes orders, so the financial report can refresh `Заказано руб.` with the same button.

Новые записи добавлять сверху. В начале сессии не читать целиком.

## 2026-05-25 — Morning report metrics prep

### Summary
Добавлены недостающие показатели для будущего Google Sheet `Утренний отчет WB`: `Заказано руб.`, `ROMI %` и `Оборачиваемость, дн.`. Таблица Google не заполнялась.

### Files changed
Расчеты финансового отчета, XLSX export, `/reports`, `/stocks`, stock services, sales-plan sync coverage, morning report service, docs.

### Commands run
`npm run type-check`; локальная проверка Galioni за 2026-04-22 — 2026-05-06.

### Result
`Заказано руб.` initially matched `wb_orders.finishedPrice` without cancellations, but this was later corrected: the metric must include cancelled orders too. `ROMI %` считается по итоговым `ОП` и `Реклама все`. Остатки получили оборачиваемость по 30 завершенным дням продаж.

### Issues
Google Sheets read earlier hit 429, поэтому live mapping листа `WB Galioni` нужно повторить перед фактическим заполнением.

## 2026-05-24 — Documentation 3-zone rebuild

### Summary
Пересобрана Markdown-документация под `docs/core`, `docs/development`, `docs/marketplace`. Созданы канонические root `AGENTS.md`, `SPECIFICATION.md`, `DECISIONS.md`; старая документация сохранена как legacy/redirect или архив.

### Files changed
Только `.md` файлы документации.

### Commands run
Read-only inspection: file listing, Markdown headings search, Prisma model/index search, export/function search, migration index search. Также создана структура папок docs.

### Result
Будущая сессия стартует с `AGENTS.md` и `docs/DOCS_INDEX.md`, затем выбирает development или marketplace документы по задаче.

### Issues
Часть старых docs в терминале отображалась с битой кодировкой, но была использована как источник смысла и сохранена.

### Follow-up
После подтверждения можно удалить или оставить старые flat docs; пока они сохранены.
