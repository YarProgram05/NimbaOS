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

- ID: MKT-BOTH-CABINETS-AUG-SEP-SUPPLY-XLSX-2026-07-25
  Status: Done
  Priority: High
  Description: Created and visually/formula validated `outputs/wb_supply_2026-07-25/Рекомендации_по_поставке_август-сентябрь_2026.xlsx` from local DB data for orders 2026-06-15 - 2026-07-19 and latest 2026-07-25 stock snapshots. Stocks in Электросталь, Краснодар, Невинномысск, СПБ/СЦ Шушары and Котовск are treated as zero. Only Nimba child products are split by `article + size`.
  Next step: Recheck latest stock immediately before shipment, add external/in-production quantities, then use `К поставке сейчас` as the packing list. Current totals: Nimba 1,488 units across 54 rows; Galioni 1,726 across 51 rows.
  Related reports/metrics: `wb_orders`, bounded `realization_reports`, latest `stock_snapshots`/`stock_items`, `product_sizes`, current stock, cancellations, net sales, season-adjusted August/September demand.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: Forecast assumes moderate post-peak decline (August 75%, September 45% of blended base); size-level Nimba order trace differs from cabinet `wb_orders` by 1 order; any external stock or inbound production is outside the DB.

- ID: MKT-BOTH-CABINETS-SUPPLY-ANALYTICS-XLSX-2026-07-21
  Status: Done
  Priority: High
  Description: Created and visually validated `outputs/wb_analytics_2026-07-21/WB_аналитика_01.05.2026-19.07.2026.xlsx` with separate Nimba/Galioni analytics, full SKU tables, best/worst articles, current total sellable stock, second-half June, July and cross-cabinet comparison.
  Next step: Before planning the physical shipment, refresh/recheck the latest stock and add any external/in-production quantities not stored in NimbaOS; review loss-making high-volume rows before replenishing them.
  Related reports/metrics: `calculateReport`, `wb_orders`, latest stock snapshot, orders, cancellations, gross/net sales, returns, OP, margin, buyout, daily pace, recent stock coverage.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: `wb_sales` is stale and intentionally excluded; size-level orders/cancellations for Nimba child rows use the financial-report trace because `wb_orders` has no size/barcode. In-way stock is excluded.

- ID: MKT-WB-UNIT-3-PRICE-REFRESH-2026-06-28
  Status: Done
  Priority: High
  Description: Updated Google Sheet `WB Unit 3.0`, tabs `UNIT WB Nimba (WB_1)` and `UNIT WB Galioni (WB_2)`, from local DB/current product sync: base price, discount, estimated SPP, missing costPrice > 50 RUB products, and current cost prices.
  Next step: If unit margins look unusual, inspect formulas/category mapping for newly added non-standard categories such as `Кремы`.
  Related reports/metrics: product price cache, `cost_prices`, `realization_reports` buyer price/SPP estimate.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: No WB-side price/card changes were made; Google Sheet formulas depend on category dropdown mappings.

- ID: MKT-MORNING-WB-SHEET-UPDATE-2026-06-26
  Status: Done
  Priority: High
  Description: Updated live Google Sheet `Утренний отчет WB` for both cabinets: removed `ROMI`, added `Выкупили, шт`, added `ЧП на 1 ед`, added `Итого с начала года`, and filled daily rows through 2026-06-27 plus YTD 2026-01-01 - 2026-06-27.
  Next step: For the next daily run, ensure reports cover Jan 1 through target date and advertising covers the current month window.
  Related reports/metrics: `daily_wb_report`, `Заказано руб.`, `Выкупили, руб`, `Выкупили, шт`, `ЧП`, `ЧП на 1 ед`, `ДРР`, YTD totals.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: YTD financial totals depend on report coverage from Jan 1; advertising conclusions for wider YTD ranges are limited to locally saved ad stats.

- ID: MKT-NIMBA-CANCELLATION-DIAGNOSIS-2026-06-22
  Status: Done
  Priority: High
  Description: Diagnosed `WB Nimba (WB_1)` cancellation/product losses for 2026-06-22 - 2026-06-25 and created `output/excel/wb_nimba_cancellations_2026-06-22_2026-06-25.xlsx`.
  Next step: Before changing ads, review poor rows with owner: `туника с поясом леопард пятна`, zero-sale/high-cancel pareo rows, and low-buyout tunic sizes; any campaign/budget/card action needs separate confirmation.
  Related reports/metrics: `calculateReport`, `wb_orders`, `ad_campaign_nm_stats`, latest stocks, cancellations, buyout %, OP, ad CPO.
  Related cabinets: `WB Nimba (WB_1)`.
  Risks: Size-level WB order cancellations are not fully available from `wb_orders`; size conclusions rely mainly on financial report rows and stock size rows.

- ID: MKT-BOTH-CABINETS-FACTOR-ANALYSIS-2026-06-22
  Status: Done
  Priority: High
  Description: Created `output/excel/wb_cabinet_factor_analysis_2026-06-22_2026-06-25.xlsx` for `WB Galioni (WB_2)` vs `WB Nimba (WB_1)` with finance, daily, product, category, advertising, stock, reviews/questions and coverage sheets.
  Next step: Use the workbook to review Nimba low buyout/high cancellations and poor ad efficiency before changing prices, cards, bids or budgets; any WB-side action needs separate confirmation.
  Related reports/metrics: `calculateReport`, persisted ad stats, `Заказано руб.`, `ОП`, `Выручка`, `Выкуп %`, `ДРР`, latest stock snapshot, reviews/questions.
  Related cabinets: `WB Galioni (WB_2)`, `WB Nimba (WB_1)`.
  Risks: `REPORTS_PERIOD` and `ADVERTISING_STATS` are covered, but `wb_sales`/`wb_funnel_stats` were empty for the period; sales/funnel conclusions rely on financial reports, orders and ad stats.

- ID: MKT-BOTH-CABINETS-JUNE-LOSS-COMPARISON-XLSX
  Status: Done
  Priority: High
  Description: Created `output/excel/wb_article_profitability_2026-06-01_2026-06-14.xlsx` from the preserved formatted workbook structure for both cabinets, with stock replacing the old sold-before-returns column and with two comparison sheets for loss/profitability review.
  Next step: Use the workbook for June 1-14 loss review; before changing prices, cards, ads, or stock actions, confirm the action separately.
  Related reports/metrics: `calculateReport`, article versions, OP, sales, buyout %, margin, stock, latest stock snapshot, no-sale products.
  Related cabinets: `WB Galioni (WB_2)`, `WB Nimba (WB_1)`.
  Risks: Comparison analogs are logical/fuzzy matches where article names differ; review manually before making commercial decisions.

- ID: MKT-BOTH-CABINETS-ARTICLE-PROFIT-XLSX-REGEN
  Status: Done
  Priority: High
  Description: Regenerated `output/excel/wb_article_profitability_2026-01-01_2026-06-17.xlsx` after dated article versions were implemented, so article names and version-specific costs resolve by operation date.
  Next step: Use this regenerated workbook for 2026-01-01 - 2026-06-17; if advertising conclusions are needed for the full range, first complete `ADVERTISING_STATS` coverage.
  Related reports/metrics: `calculateReport`, article versions, `ОП`, `Выручка`, `Выкуп %`, `ДРР`, no-sale products.
  Related cabinets: `WB Galioni (WB_2)`, `WB Nimba (WB_1)`.
  Risks: `ADVERTISING_STATS` remains incomplete for the full January-June period; ad/DRR influence is based on locally available ad stats.

- ID: MKT-BOTH-CABINETS-ARTICLE-PROFIT-XLSX
  Status: Done
  Priority: High
  Description: Подготовлен Excel `output/excel/wb_article_profitability_2026-01-01_2026-06-17.xlsx` по обоим кабинетам: отдельные листы `WB Galioni` и `WB Nimba`, сводка, ранги по ОП/выручке, выкупы, выкупаемость, ключевые факторы прибыльности и отдельный лист `Не продавались`. Для Nimba размерные позиции показаны как `артикул + размер`.
  Next step: При необходимости пересобрать рекламные метрики после подтвержденной синхронизации `ADVERTISING_STATS` за январь-март.
  Related reports/metrics: `calculateReport`, `Заказано руб.`, `ОП`, `Выручка`, `Выкуп %`, `ДРР`, no-sale products.
  Related cabinets: `WB Galioni (WB_2)`, `WB Nimba (WB_1)`.
  Risks: `REPORTS_PERIOD` покрыт полностью за 2026-01-01 - 2026-06-17; `ADVERTISING_STATS` покрывает не весь период, поэтому рекламные выводы осторожные.

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

- ID: MKT-FBS-ROLLOUT
  Status: Pending rollout
  Priority: High
  Description: FBS workplace and KIZ/Chestny Znak Stage 1 are implemented at code level for all seller warehouses.
  Next step: Review and process the locally created remote-sale withdrawal tasks, including 9 repaired Nimba July 28 mappings; confirm that fulfillment consistently scans codes into WB; establish explicit local opening physical balances. Add PDF import later only if pre-packing code-pool accounting is required. Then, after separate production migration approval, execute only the fixed `2026-07-20` - `2026-07-30` backfill, reconcile local/WB stock and decide which schedules to enable. Do not enable WB write gates in this step.
  Related reports/metrics: local onHand/reserved/available, WB mismatch, open/overdue FBS orders, FBS sales/returns/revenue, compliance task backlog.
  Related cabinets: all active WB accounts after explicit rollout selection.
  Risks: only codes actually attached in WB appear in metadata; invalid/reused/mismatched codes require operator review; endpoint response drift, initial balance reconciliation, missing KIZ circulation status and overdue manual Chestny Znak operations.
