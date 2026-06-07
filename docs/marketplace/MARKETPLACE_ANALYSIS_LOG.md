# Marketplace Analysis Log

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
