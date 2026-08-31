# Marketplace Current Tasks

## Active

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

- ID: MKT-FBS-SHEET-DAILY-WORKFLOW
  Status: Done locally; disabled
  Priority: High
  Description: Implemented and verified the DB-first daily FBS lifecycle workflow. Initial live load through 2026-08-31 wrote 250 missing events and corrected 5 existing rows; retry verification found 255 unchanged events and no writes. Owner-confirmed duplicate listings map by stable tuple: `парео леопард/пятна → туника леопард/пятна` and `парео синяя полоска → туника синие волны`.
  Next step: Deploy code/migration normally and explicitly enable the production schedule after worker smoke-testing.
  Related reports/metrics: 251 orders, 3 pre-handoff cancellations, 1 accepted return, 0 failed accounts, 0 retry inserts/updates.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: Workflow is intentionally disabled; unknown tuples stop the run and shipped cancellation/defect alone never restores stock.

- ID: MKT-FBS-SHEET-AUTOMATION-BASELINE-2026-09-01
  Status: Done
  Priority: High
  Description: Prepared the live FBS movement workbook for daily automation and replaced manual order quantities through 2026-08-09 with 366 current production orders, one row per real WB order ID. Added stable `nmId`/`chrtId`, account, source, status, idempotency key, load timestamp, ten pre-shipment cancellation offsets, Moscow timezone, corrected/cancellation-aware formulas, protected calculation ranges, automation settings and a daily load-control tab. Preserved the pre-replacement journal in a hidden archive.
  Next step: Implement the daily workflow starting with 2026-08-10: read NimbaOS only, append missing events by idempotency key, update statuses without duplicating orders, create pre-shipment cancellation offsets, and write one control row per account/date. Do not convert shipped cancellations/defects into stock returns until actual return acceptance is recorded.
  Related reports/metrics: production `fbs_orders`, Moscow creation date, account + externalOrderId uniqueness, `nmId`, `chrtId`, idempotency keys, daily expected/written/skipped counts, physical and cabinet stock formulas.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: Product mapping is explicit for the 45 account/nmId/chrtId combinations present in the baseline and must be extended or rejected visibly when a new product appears. The 159 shipped client cancellations and four shipped defects remain subtracted until a real accepted-return event exists. Visual browser QA was unavailable because Computer Use could not establish the current Chrome URL, although API readback and formula validation passed.

- ID: MKT-FBS-SHEET-DAILY-RECONCILIATION-2026-09-01
  Status: Done
  Priority: High
  Description: Reconciled `ФБС перемещение — автоматизированная версия` against production `fbs_orders` for every Moscow day from 2026-07-28 through 2026-08-09. Sheet total is 345 versus 362 in NimbaOS, with no matching combined day; 7 August is absent in the journal and 8 August is materially overstated.
  Next step: Before creating the daily workflow, add stable account/order/product identifiers and idempotency, model cancellation/return events, restore the overwritten summary formula, and align the spreadsheet timezone to Europe/Moscow. Then backtest the new workflow on this fixed period without writing duplicate rows.
  Related reports/metrics: daily created FBS orders, `fbs_orders.createdAtWb`, account + externalOrderId uniqueness, sheet operation quantities, workflow idempotency.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: A blind append workflow will duplicate rows on retries; current formulas permanently subtract canceled orders from stock; text product names are not safe join keys. No source data or marketplace state was changed.

- ID: MKT-OZON-UNIT-3-FILL-2026-08-24
  Status: Done
  Priority: High
  Description: Filled the live `OZON Unit 3.0` Google Sheet with 56 current Nimba SKUs and 51 current Galioni SKUs from the supplied product, price, 90-day order, accrual and cost files. Cabinet-specific categories, FBO, volume-preserving package dimensions, costs, current prices/discounts/co-investment, 48% FBO commission, modal clusters, per-SKU buyout, advertising, tax/VAT and zero-cost assumptions are populated while formulas and workbook-wide settings remain intact.
  Next step: Review the calculated unit economics; refresh the same manual inputs when prices, commission, costs or the 90-day order window materially change.
  Related reports/metrics: Ozon SKU and seller article, category, package volume, cost, seller/base/buyer price, co-investment, buyout, clusters, commission, advertising per delivered unit and tax.
  Related cabinets: Ozon Nimba, Ozon Galioni.
  Risks: 42 Nimba legacy aliases use same-goods matching to the shared cost workbook; three cancellation-only SKUs use cabinet-average buyout; displayed dimensions are derived from Ozon volume because the exports do not contain physical package sides. The workbook-compatible tax form label is `УСН (с дохода)` with explicit 8%/7% rates.

- ID: MKT-COST-PRICE-TEMPLATE-PLUS-35-2026-08-21
  Status: Done
  Priority: High
  Description: Filled all 155 rows of the supplied cost-price template from the mini-PC production reference, adding 35 rubles per unit and preserving the workbook format.
  Next step: Upload or use `outputs/cost_price_fill_2026-08-21/costPriceTemplate_себестоимость_плюс_35.xlsx`; review the intentionally inherited 41-ruble values where the server reference itself is 6 rubles.
  Related reports/metrics: production `cost_prices`, current/historical article identity, unit cost plus 35 rubles.
  Related cabinets: WB Nimba and WB Galioni reference data; alternate marketplace article aliases mapped to their WB equivalents.
  Risks: 69 alternate article labels use explicit model/material/color/size-family equivalence rather than exact seller-article equality. No database or marketplace-side data was changed.

- ID: MKT-NIMBA-MARGIN-RECOVERY-PDF-2026-08-14
  Status: Done
  Priority: High
  Description: Exported the margin-recovery report to a visually matched six-page A4 landscape PDF and removed browser print headers/footers.
  Next step: Open `output/pdf/WB_Nimba_план_восстановления_маржи_01-12_августа_2026.pdf`.
  Related reports/metrics: Same content and metrics as the validated margin-recovery HTML report.
  Related cabinets: WB Nimba.
  Risks: None for delivery; no WB-side changes were made.

- ID: MKT-NIMBA-MARGIN-RECOVERY-PLAN-2026-08-13
  Status: Done
  Priority: High
  Description: Diagnosed WB Nimba's -3.93% operating margin for 1-12 August and prepared an article-level response plan. The 70,216.60-ruble commission, not advertising, is the main immediate driver; at July's effective commission the same August economics would produce about +46,966.23 rubles of operating profit.
  Next step: After owner approval, test a 7-10% price/discount adjustment only on the 17 negative SKUs whose static break-even threshold is within 15%, limit the 14 SKUs above 25%, and recalculate after three full days.
  Related reports/metrics: `output/reports/nimba_margin_recovery_august_2026/nimba_margin_recovery_august_2026.html`, operating profit, margin, commission, KVV, platform discount, average realized price, break-even price threshold.
  Related cabinets: WB Nimba.
  Risks: Static price thresholds assume unchanged volume, returns, KVV/SPP and ruble costs; exact WB seller price must be set in the cabinet and tested. No WB-side changes were made.

- ID: MKT-COMMISSION-REPORT-PORTABLE-DELIVERY-2026-08-13
  Status: Done
  Priority: High
  Description: Recovered the complete July/August WB Nimba commission diagnostic after the embedded artifact failed to open and packaged it as a self-contained browser-readable HTML report with corrected ruble labels and responsive compact summaries.
  Next step: Open `output/reports/commission_shift_august_2026/commission_shift_august_2026.html`; publish separately only if coworker sharing is needed.
  Related reports/metrics: commission, effective commission rate, KVV, platform discount, article contribution.
  Related cabinets: WB Nimba; WB Galioni control comparison retained.
  Risks: The strict packaged browser verifier reported the Windows vertical-scrollbar width as horizontal overflow, so final packaging used structural verification after a successful diagnostic render.

- ID: MKT-GALIONI-NEGATIVE-COMMISSION-AUDIT-2026-08-13
  Status: Done
  Priority: High
  Description: Проверена отрицательная комиссия WB Galioni за 1-30 апреля. Чистая комиссия -1 420,92 руб. является начислением в пользу продавца: средний КВВ 34,50% был немного ниже платформенной скидки 34,99%. Месяц в целом завершился с операционной прибылью 3 708,03 руб. и маржой 1,21%.
  Next step: При необходимости сверить назначение начисления с недельной детализацией финансового отчёта WB.
  Related reports/metrics: commission, `commissionPercent`, `ppvzSppPrc`, operating profit, marginality.
  Related cabinets: WB Galioni.
  Risks: Отрицательная комиссия улучшает взаиморасчёт, но сама по себе не означает прибыльность периода; нужны все расходы.

- ID: MKT-COMMISSION-SHIFT-AUDIT-2026-08-13
  Status: Done
  Priority: High
  Description: Проверена комиссия WB Nimba за 1-12 июля и 1-12 августа. Рост с 10 255,28 до 70 216,60 руб. (6,85x) корректен; основная причина — рост эффективной нагрузки с 0,97% до 11,19% из-за повышения КВВ и снижения платформенной скидки, а не рост продаж или дубли данных.
  Next step: В кабинете WB сопоставить дату изменения с историей категорийных тарифов и опциями «Конструктора тарифов»; до проверки считать августовскую нагрузку фактической.
  Related reports/metrics: commission, `commissionPercent`, `ppvzSppPrc`, sales before SPP, commission per unit.
  Related cabinets: WB Nimba; WB Galioni used as a control comparison.
  Risks: Локальный финансовый отчёт не содержит точного договорного основания изменения тарифа. Любые изменения цен, рекламы или карточек требуют отдельного подтверждения.

- ID: MKT-FBS-LATE-WITHDRAWAL-RECONCILIATION-2026-08-13
  Status: Done
  Priority: High
  Description: Removed the pointless unconfirmed withdrawal-then-return cycle for orders already known as pickup cancellation/defect. Reconciled 28 Nimba and 40 Galioni tasks while preserving return-expected physical status and all audit history.
  Next step: Discard the new 28-row Nimba withdrawal file. Generate a new Galioni file from the corrected queue before CRPT submission.
  Related reports/metrics: withdrawal queue, order WB status, KIZ circulation state, physical return state.
  Related cabinets: WB Nimba, WB Galioni.
  Risks: Do not treat `RETURN_EXPECTED` as physically received stock. Confirmed withdrawals still require a real return-to-circulation document after receipt.

- ID: MKT-FBS-FULL-HISTORY-AND-KPIS-2026-08-13
  Status: Done
  Priority: High
  Description: Full retained FBS history is now searchable/filterable/sortable through server pages of 25/50/100 rows. Added a shared history period plus total/article profitability and buyout percentage in analytics.
  Next step: Verify an old known order/KIZ after deployment and use the analytics explanation when comparing direct FBS OP with the complete Finance report.
  Related reports/metrics: FBS archive, direct FBS OP, margin, profitability, buyout percentage.
  Related cabinets: all FBS-enabled cabinets.
  Risks: Shared advertising remains excluded from direct FBS OP; unfinished orders are intentionally excluded from buyout percentage.

- ID: MKT-FBS-BOUNDED-HISTORY-AND-OP-2026-08-13
  Status: Done
  Priority: High
  Description: Preserved full FBS history in the database while bounding and paginating page data, added exact counters and table-header sorting, and extended article analytics with orders, cancellations, direct FBS OP and margin.
  Next step: Compare one deployed article/period to the Finance report and remember that shared advertising is excluded from direct FBS OP.
  Related reports/metrics: FBS orders/cancellations, realization expenses, cost price, tax rate, FBS revenue/transfer/direct OP/margin.
  Related cabinets: all FBS-enabled cabinets.
  Risks: The latest 100 history rows are sortable on the page; exact older records remain stored but require a future server-side history/archive view. FBS OP is not the full business OP because shared ads are not allocated.

- ID: MKT-FBS-CRPT-PRICE-AND-UNKNOWN-STOCK-2026-08-13
  Status: Done
  Priority: High
  Description: Added CRPT withdrawal per-unit prices from WB orders without a VAT markup, repaired four historical download files, and reconciled every apparent `IN_STOCK + Статус в ЧЗ не указан` KIZ to a historical pickup-cancellation/defect order.
  Next step: Use the matching corrected file in a CRPT draft; after deployment run only a normal bounded FBS operational sync to reclassify historical order-linked KIZs, then verify counts before any CRPT confirmation.
  Related reports/metrics: KIZ compliance tasks, WB FBS order converted price, local KIZ lifecycle events.
  Related cabinets: WB Nimba, WB Galioni.
  Risks: NimbaOS still has no live CRPT status read; do not mass-confirm circulation from inference alone.

- ID: MKT-FBS-KIZ-RETURN-SEMANTICS-2026-08-12
  Status: Done
  Priority: High
  Description: Corrected pickup-cancellation/defect handling so the original KIZ stays associated, clarified unknown CRPT state and document references, exposed CRPT-format identification codes to authorized users, and added filters across FBS.
  Next step: Use a normal operational sync after deployment to recover any affected order whose SGTIN is still returned by WB, then verify the order and KIZ tabs.
  Related reports/metrics: FBS order status, KIZ assignment, physical return, circulation task, CRPT document confirmation.
  Related cabinets: all FBS-enabled cabinets.
  Risks: Historical codes absent from both local event/task history and current WB metadata cannot be inferred safely.

- ID: MKT-FBS-KIZ-LEGACY-EXPORT-RECONCILIATION-2026-08-12
  Status: Done
  Priority: High
  Description: Converted the 163-row legacy Nimba KIZ export to the current CRPT one-column format and reconciled its count with 201 orders / 34 cancellations for 2026-07-28 - 2026-08-12.
  Next step: Upload the converted withdrawal file to the corresponding Chestny Znak document, then confirm the stored batch in NimbaOS only after CRPT accepts it.
  Related reports/metrics: FBS orders, cancellations, handoff state, KIZ assignment, withdrawal compliance task status.
  Related cabinets: `WB Nimba (WB_1)`.
  Risks: Three exported orders were canceled after handoff and remain in the withdrawal lifecycle; a physical return later requires return to circulation before resale.

- ID: MKT-FBS-KIZ-BULK-FILES-2026-08-12
  Status: Done
  Priority: High
  Description: Added separate XLSX queues for withdrawal and return to circulation and a one-click whole-file confirmation step, removing the normal need to confirm each KIZ separately.
  Next step: Use the corresponding CRPT document for each file and confirm the NimbaOS batch only after the document is accepted.
  Related reports/metrics: KIZ circulation state, compliance task status, exported operation batches, document number/date.
  Related cabinets: all FBS-enabled cabinets.
  Risks: Status is local and requires truthful operator confirmation until direct Chestny Znak API integration is implemented.

- ID: MKT-FBS-ANALYTICS-FIX-2026-08-12
  Status: Done
  Priority: High
  Description: Corrected FBS analytics and added orders, cancellations, buyouts, returns, net revenue and net transfer. Verified both active cabinets for 2026-08-01 - 2026-08-11 from the local DB.
  Next step: Use `/fbs` with the required period; if financial values are unexpectedly absent, check both FBS operational order coverage and `REPORTS_PERIOD` coverage before syncing.
  Related reports/metrics: `fbs_orders`, bounded `realization_reports`, FBS order ID matching, orders, cancellations, gross buyouts, returns, net revenue, net transfer.
  Related cabinets: `WB Nimba (WB_1)`, `WB Galioni (WB_2)`.
  Risks: Order/cancellation metrics use order creation date while financial metrics use operation date; KIZ withdrawal cannot legally wait for final buyout in the current distance-sale light-industry process.

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
2026-08-13 - Galioni corrected withdrawal files: completed. Use the corrected 11-row and 173-row XLSX files; do not upload the original 16-row and 179-row copies.
## FBS accounting sheet

- Status: WB stock snapshot and reconciliation are live in the Google Sheet; code rollout remains pending.
- Operator action: review 11 yellow `ВНЕСТИ ПОПОЛНЕНИЕ +N` rows and enter only the real missing local replenishments into the operations ledger.
- Do not edit the WB snapshot technical columns; they are hidden and maintained by stable tuple upsert.
