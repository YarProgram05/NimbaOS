# KPI Definitions

Определения ключевых метрик. Last updated: 2026-05-25.

## Orders

Что означает: оформленные заказы WB. Данные: `wb_orders`/plan services. Ошибка: считать отмененные заказы как финальные продажи без проверки.

## Ordered Rub

Формула: сумма `wb_orders.finishedPrice` по всем оформленным заказам за период, включая `isCancel = true`. Данные: локальная таблица `wb_orders`, синхронизируется через `reports.period` и `sales-plan.period`. Ошибка: исключать отмены и тем самым смешивать заказанную сумму с фактическими продажами/выкупами.

## Sales

Что означает: фактические продажи/выкупы после WB report logic. Данные: `realization_reports`, `wb_sales`, report services. Ошибка: смешивать gross orders and net sales.

## Buyout Percent

Что означает: доля доставленных товаров, которые выкуплены. Данные: realization report formulas. Ошибка: игнорировать returns.

## Stock

Что означает: текущий остаток по latest stock snapshot. Данные: `stock_snapshots`, `stock_items`. Ошибка: считать старый snapshot актуальным.

## Turnover / Coverage

Формула: stock quantity / average daily sales. Данные: stocks + sales. Ошибка: считать по слишком короткому периоду.

## Days To Out Of Stock

Формула: available stock / average daily sales. Если sales zero, нужна ручная интерпретация.

## Conversion

Формула зависит от доступной воронки: orders or carts divided by views/open count. Данные: `wb_funnel_stats`. Ошибка: сравнивать разные периоды freshness.

## Cart Adds

Корзины из funnel/ad stats. Использовать для диагностики карточки и рекламы.

## CPC

Cost per click = ad spend / clicks. Данные: ad stats.

## CPM

Cost per mille = spend / views * 1000. Данные: ad stats/clusters.

## CPO

Cost per order = ad spend / orders. Если orders zero, показатель считать рисковым, но не делить без проверки.

## Cart Cost

Spend / cart adds. Помогает найти рекламу, которая приводит в корзину слишком дорого.

## DRR

Доля рекламных расходов = ad spend / sales. В отчетах использовать project report/dashboard formulas.

## ROMI

Формула для NimbaOS: `(operating profit + ad spend) / ad spend * 100`, где ad spend = `Реклама (все)`. Если рекламных расходов нет, показывать `0.00`. Ошибка: сравнивать ROMI с DRR как одинаковые метрики.

## Plan/Fact

Факт / план по quantity/revenue/profit. Данные: sales plans + synced sales/orders/funnel.

## Plan Deviation

Факт минус план, absolute and percent. Ошибка: игнорировать прошедшую долю периода.

## Average Daily Sales

Sales quantity or revenue divided by days with valid data. Проверять период и выбросы.

## Stock Turnover Days

Формула для остатков: текущий sellable stock (`quantity`) / средние не-возвратные продажи в день за последние 30 завершенных дней относительно даты снимка остатков. В пути к клиенту/от клиента не включается. Если продаж нет, показатель пустой/`Нет продаж`.

## Typical Interpretation Mistakes

- Делать вывод без freshness check.
- Сравнивать кабинеты или периоды с разным coverage.
- Считать WB API live response источником отчета.
- Рекомендовать price/ad changes без проверки margin, stock and card quality.
