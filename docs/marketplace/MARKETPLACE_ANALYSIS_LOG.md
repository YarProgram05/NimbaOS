# Marketplace Analysis Log

## 2026-06-13 - WB Nimba PDF report for 2026-06-01 - 2026-06-12

### Question
Подготовить красивый PDF-отчет по WB Nimba за 2026-06-01 - 2026-06-12: остатки, оборачиваемость, количество продаж, ключевые метрики и финансовые показатели, плюс короткая аналитика. После правки пользователя: детские товары показывать как отдельные артикулы по размеру (`артикул + размер`), а риск-таблицу ограничить парео и туниками без снятых с торговли артикулов.

### Data Used
Локальная БД NimbaOS, кабинет `WB Nimba (WB_1)`. Данные взяты через `getMorningReportData`: `calculateReport` для финансов, `getStocksSummary`/`getPaginatedStocks` для остатков и оборачиваемости. Детские финансовые и stock rows развернуты через `sizeRows`; parent row не дублировался там, где есть размерные строки. WB API напрямую не вызывался. PDF сохранен в `output/pdf/wb_nimba_report_2026-06-01_2026-06-12.pdf`.

### Freshness Check
`REPORTS_PERIOD` покрыт за 2026-06-01 - 2026-06-12, synced at 2026-06-13 08:39 UTC. `ADVERTISING_STATS` покрыт, synced at 2026-06-13 08:52 UTC. Остатки взяты по latest stock snapshot 2026-06-13 08:52 UTC. `SALES_PLAN_PERIOD` за период не покрыт, поэтому план/факт не включался в выводы.

### Findings
Продажи за период: 352 246,94 руб., 202 шт.; заказано 648 048,13 руб. Выкуп 56,74% при 356 доставленных и 150 отменах - главный операционный риск. Операционная прибыль 43 146,16 руб., маржинальность 12,25%. Реклама умеренная: 7 998,22 руб., ДРР 2,27%, ROMI 639,45%.

Остатки: 3 755 шт. на 2 481 295 руб. по себестоимости. Средняя оборачиваемость по позициям с продажами 624,4 дня; 39 SKU в излишке, 25 SKU без текущего остатка, 14 SKU с остатком без продаж. По продающимся товарам срочного out-of-stock риска не видно. Детские позиции в PDF показаны по размерам: например `туника/детская/розовый 152-164`, `туника/детская/белый 134-152`. Риск-таблица включает только категории `Парео` и `Туники`; исключены `парео сирень2`, `парео фуксия`, длинные парео из пользовательского списка, `пижама003`, `пижама004`.

### Recommendations
Сначала проверить и снижать излишки, особенно парео и туники с покрытием сотни дней. Отдельно разобрать причины отмен и низкого выкупа. По детским туникам держать контроль размеров/цветов, потому что они дают основной оборот периода. Не менять цены, рекламу или карточки без отдельного подтверждения.

### Follow-up
Если нужен план/факт по этому же периоду, сначала обеспечить локальное покрытие `SALES_PLAN_PERIOD`, затем пересобрать отчет или сделать отдельную таблицу плановых отклонений.

## 2026-06-07 - Stock risk definition clarified

### Question
Почему в остатках не видно товаров в состоянии `В норме` и откуда берется `Оборачиваемость, дн.`.

### Result
`Оборачиваемость, дн.` не приходит готовым полем из WB. NimbaOS считает ее как текущий sellable stock (`stock_items.quantity` из последнего `stock_snapshots`) / средние не-возвратные продажи в день за 30 завершенных дней перед снимком остатков. Для спроса используются локальные источники: `wb_sales` и, как более свежий/детальный fallback, `realization_reports` с sale quantities; для размеров используется barcode из финансового отчета.

### Risk Rules
`Нет остатка`: общий sellable stock = 0. `Низкий остаток`: положительный stock, но покрытие до 14 дней. `В норме`: покрытие 14-120 дней. `Излишек`: более 120 дней покрытия и минимум 10 шт. `Нет продаж`: положительный stock, но нет продаж в 30-дневном окне. Фильтр категорий в `/stocks` поддерживает выбор нескольких категорий.

## 2026-06-01 - Child pareo/tunics May supply analysis

### Question
Проверить продажи за 2026-05-01 - 2026-05-31 и текущие остатки детских парео/туник по размерам, понять на сколько дней хватит запасов и что планировать в поставку.

### Data Used
Локальная БД NimbaOS. Целевая группа найдена как детские `Парео` в `WB Galioni (WB_2)` и детские `Туники` в `WB Nimba (WB_1)`. Итоговая Google Sheet: `Анализ детских парео и туник — май 2026` (`https://docs.google.com/spreadsheets/d/19JOoSHZl-iK8-kgnCO2qz3txMjvLyrdwtX6-r1inM4U/edit`).

### Freshness Check
`REPORTS_PERIOD` покрыт до 2026-05-31 по обоим кабинетам; текущие остатки взяты из latest `stock_snapshots`, synced at 2026-06-01 19:16 UTC. `SALES_PLAN_PERIOD` покрывал только 2026-05-01 - 2026-05-23, поэтому для итогов мая использованы `realization_reports` с баркодами/размерами, а не `wb_sales`.

### Findings
Galioni child pareo: 11 SKU, 14 продаж, 0 возвратов, 278 шт текущего остатка, расчетное покрытие около 616 дней. Новую поставку не планировать; по части SKU есть большой остаток без майских продаж.

Nimba child tunics: 4 SKU, 158 продаж, 8 возвратов, 313 шт текущего остатка, общее покрытие около 61 дня. Риск не общий, а размерный: белый 134-152 и 152-164 уже без sellable stock; розовый 134-152 без sellable stock; розовый 152-164 имеет около 15 дней запаса.

### Recommendations
В ближайшую поставку приоритетно заложить Nimba: белый 134-152 (~70 шт на 60 дней), белый 152-164 (~40 шт), розовый 134-152 (~65 шт), розовый 152-164 (~25 шт). Розовый 112-134 можно довести примерно на 20 шт до 60-дневного покрытия. Galioni детские парео не пополнять без нового спроса.

### Follow-up
Перед фактической поставкой проверить остатки повторно свежим stock snapshot и учесть уже собранные/в пути партии, если они ведутся вне текущей БД.

## 2026-05-25 - Morning WB report fill for Galioni

### Question
Заполнить Google Sheet `Утренний отчет WB`, вкладка `WB Galioni`.

### Data Used
Локальная БД NimbaOS and DB-backed report/stock services for `WB Galioni (WB_2)`. Google Sheet structure was read before writing. No ad-hoc WB API call or full historical resync was performed.

### Freshness Check
Rows for 2026-05-01 - 2026-05-24 were covered by local financial/report data. 2026-05-25 was not covered at the time of the fill, so it was left blank. Latest stock snapshot used for turnover was synced on 2026-05-25.

### Findings
Filled daily rows 2026-05-01 - 2026-05-24 for ordered rubles, sales/buyout rubles, transfer amount, logistics, storage, turnover, cost, advertising, DRR, operating profit, taxes, tax rate, operating profit before ads, and ROMI. Existing monthly totals recalculated in the sheet.

### Follow-up
After the next local sync covers 2026-05-25, fill only the newly covered date range and re-check sheet formulas after writeback.

## 2026-05-25 - Ordered rub definition correction

`Заказано руб.` must include all WB orders, including cancellations. For Galioni `2026-01-01` - `2026-05-24`, non-cancelled orders were only 1846684.89, but all orders are 2783846.47 against sales 1571692.94 (`1.77x`), which matches a buyout near 58.66%.

## 2026-05-25 - Ordered rub sync correction

`Заказано руб.` remains a money metric. The sync path was corrected so report sync refreshes WB orders for the selected period and existing order rows are updated when WB changes price/cancellation state. Google Sheet was not filled.

Новые аналитические записи добавлять сверху.

## 2026-05-25 — Morning WB report prep for Galioni

### Question
Каких данных не хватало для будущего заполнения Google Sheet `Утренний отчет WB` по кабинету Galioni?

### Data Used
Локальная БД NimbaOS, код report/stock services, Google Sheet metadata. Google Sheet не заполнялся.

### Freshness Check
Кабинет `WB Galioni (WB_2)` найден. В базе есть financial reports до 2026-05-24, ad stats до 2026-05-23, latest stock snapshot 2026-05-25. Orders/sales на момент проверки были до 2026-05-06; для свежего `Заказано руб.` нужен `sales-plan.period` sync.

### Findings
`ДРР` уже был в финансовом отчете. Добавлены `Заказано руб.` из всех `wb_orders.finishedPrice`, `ROMI %` как `(ОП + Реклама все) / Реклама все × 100`, и `Оборачиваемость, дн.` по текущему sellable stock и средним продажам за 30 завершенных дней.

### Recommendations
Перед фактическим заполнением таблицы перечитать лист `WB Galioni`, проверить coverage нужного периода, при необходимости запустить штатный sync, затем брать данные из `getMorningReportData`.

### Follow-up
Заполнить Google Sheet только после повторного readback структуры листа и подтверждения периода.

## 2026-05-24 — Documentation baseline

### Question
Как организовать документы для будущего агента-менеджера/аналитика WB?

### Data Used
Исходный код и существующие `.md`; бизнес-данные WB не анализировались.

### Freshness Check
Не применимо: отчет по данным не строился.

### Findings
Проект хранит аналитику в PostgreSQL и должен использовать WB API только для sync. Для marketplace-задач нужны отдельные playbooks, KPI definitions, checklist and decision rules.

### Recommendations
Начинать каждый анализ с проверки кабинета, периода, coverage and sync status.

### Follow-up
Провести первую daily baseline проверку на выбранном кабинете.
