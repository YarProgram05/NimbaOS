# Marketplace Current Tasks

## Active

No active marketplace task is currently assigned. Pick from `Next` after reading `MARKETPLACE_HANDOFF.md`.

## Next

- ID: MKT-DAILY-BASELINE
  Status: Pending
  Priority: High
  Description: Провести первую ежедневную проверку по продажам, остаткам, рекламе, план/факт и карточкам.
  Next step: Выбрать кабинет/период и проверить freshness.
  Related reports/metrics: daily_wb_report, stock_risk_report, ads_efficiency_report.
  Related cabinets: нужно выбрать.
  Risks: Данные могут быть неполными.

- ID: MKT-KPI-THRESHOLDS
  Status: Pending
  Priority: Medium
  Description: Уточнить целевые thresholds для DRR, маржинальности, выкупа, out-of-stock risk, конверсии.
  Next step: Спросить владельца или вывести из исторических данных.
  Related reports/metrics: KPI definitions, decision rules.
  Related cabinets: all.
  Risks: Без thresholds рекомендации должны быть мягкими.

## Blocked

- ID: MKT-AUTO-OWNER-SUMMARY
  Status: Blocked
  Priority: Medium
  Description: Автоматическая weekly owner summary.
  Next step: Уточнить формат, канал и расписание.
  Related reports/metrics: weekly_owner_summary.
  Related cabinets: all active.
  Risks: Production automation and data freshness.

## Done Recently

- ID: MKT-WB-NIMBA-JUNE-PDF
  Status: Done
  Priority: High
  Description: Подготовлен и пересобран PDF-отчет по `WB Nimba (WB_1)` за 2026-06-01 - 2026-06-12 с продажами, остатками, оборачиваемостью, ключевыми финансовыми метриками и выводами. Детские товары показаны как `артикул + размер`; риск-таблица ограничена парео/туниками и исключает снятые с торговли артикулы.
  Next step: При необходимости отдельно разобрать причины низкого выкупа/отмен и излишков; не менять цены, рекламу или карточки без подтверждения.
  Related reports/metrics: `daily_wb_report`, `stock_risk_report`, `Заказано руб.`, `ДРР`, `ROMI %`, `Оборачиваемость, дн.`
  Related cabinets: `WB Nimba (WB_1)`.
  Risks: `SALES_PLAN_PERIOD` не был покрыт за период, поэтому план/факт исключен из PDF; рекомендации осторожные.

- ID: MKT-STOCK-RISK-DEFINITION
  Status: Done
  Priority: High
  Description: Уточнена и внедрена логика риска остатков: оборачиваемость считается из текущего sellable stock и средних не-возвратных продаж за 30 завершенных дней; `В норме` теперь отдельное состояние 14-120 дней покрытия.
  Next step: На следующей проверке `/stocks` смотреть `Нет продаж` отдельно от `Нет остатка`; перед поставочными выводами проверять свежесть `wb_sales`/`realization_reports`.
  Related reports/metrics: `stock_risk_report`, `Оборачиваемость, дн.`, latest `stock_snapshots`, `wb_sales`, `realization_reports`.
  Related cabinets: all.
  Risks: При устаревшем sales/report coverage товары могут попадать в `Нет продаж`; не делать поставочные рекомендации без freshness check.

- ID: MKT-PAREO-TUNICS-MAY-2026
  Status: Done
  Priority: High
  Description: Проанализированы продажи за 2026-05-01 - 2026-05-31 и текущие остатки детских парео Galioni и детских туник Nimba; создана Google Sheet `Анализ детских парео и туник — май 2026`.
  Next step: При планировании поставки точечно пополнить Nimba: белый 134-152/152-164, розовый 134-152/152-164; по Galioni детские парео не пополнять без нового сигнала спроса.
  Related reports/metrics: `realization_reports`, latest `stock_snapshots`, days-to-stockout.
  Related cabinets: `WB Galioni (WB_2)`, `WB Nimba (WB_1)`.
  Risks: `SALES_PLAN_PERIOD` coverage was only through 2026-05-23, so May sales totals were based on financial reports, not `wb_sales`.

- ID: MKT-MORNING-WB-GALIONI-FILL
  Status: Done
  Priority: High
  Description: Filled Google Sheet `Утренний отчет WB`, tab `WB Galioni`, for 2026-05-01 - 2026-05-24 from local DB-backed report data.
  Next step: Fill 2026-05-25 only after local coverage exists; do not write zeroes for uncovered current-day data.
  Related reports/metrics: `daily_wb_report`, `Заказано руб.`, `ДРР`, `ROMI %`, `Оборачиваемость, дн.`
  Related cabinets: `WB Galioni (WB_2)`.
  Risks: Current-day data may be incomplete; avoid ad-hoc WB API calls and broad historical resyncs.

- ID: MKT-ORDERED-RUB-DEFINITION
  Status: Done
  Priority: High
  Description: Corrected `Заказано руб.` to include all WB orders, including cancelled orders.
  Next step: Refresh `/reports`; no new sync is required if `wb_orders` is already populated for the period.
  Related files: `src/lib/services/report-calculator.ts`, `docs/marketplace/KPI_DEFINITIONS.md`.
  Risks: Excluding `isCancel = true` makes ordered rubles too close to sales and contradicts buyout logic.

- ID: MKT-ORDERED-RUB-SYNC-FIX
  Status: Done
  Priority: High
  Description: Corrected `Заказано руб.` freshness for Galioni morning-report prep; it now refreshes through report sync.
  Next step: Re-run the report sync for the target period before filling the Google Sheet.
  Related files: `src/lib/services/sync-orders.ts`, `src/lib/queue/sync-processor.ts`.
  Risks: Orders API rate limit; avoid broad historical sync without confirmation.

- ID: MKT-MORNING-WB-GALIONI-PREP
  Status: Done
  Priority: High
  Description: Подготовить метрики для будущего заполнения Google Sheet `Утренний отчет WB`.
  Next step: Перечитать лист `WB Galioni`, выбрать период, проверить freshness и только потом заполнять таблицу.
  Related reports/metrics: `daily_wb_report`, `Заказано руб.`, `ROMI %`, `Оборачиваемость, дн.`
  Related cabinets: `WB Galioni (WB_2)`.
  Risks: Google Sheets 429; orders/sales freshness must be checked before filling.

- ID: MKT-DOCS-PLAYBOOK
  Status: Done
  Priority: High
  Description: Создать playbook и документы аналитика WB.
  Next step: Использовать при первой marketplace-задаче.
  Related reports/metrics: all.
  Related cabinets: all selected WB accounts.
  Risks: Thresholds require owner confirmation.

- ID: MKT-DOCS-3-ZONES
  Status: Done
  Priority: High
  Description: Marketplace docs created under `docs/marketplace`.
  Next step: Keep logs updated after each analysis.
  Related reports/metrics: all.
  Related cabinets: all.
  Risks: none.
