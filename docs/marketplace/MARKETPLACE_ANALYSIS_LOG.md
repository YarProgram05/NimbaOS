# Marketplace Analysis Log

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
