# KPI Definitions

Определения ключевых метрик. Last updated: 2026-06-07.

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

Формула: stock quantity / average daily sales. Для `/stocks` используется текущий sellable stock из latest stock snapshot и средние не-возвратные продажи за последние 30 завершенных дней перед снимком. Данные: `stock_snapshots`, `stock_items`, `wb_sales`, fallback `realization_reports`. Ошибка: считать показатель готовым полем WB или не проверять freshness продаж.

## Days To Out Of Stock

Формула: available stock / average daily sales. Если sales zero, нужна ручная интерпретация.

## Stock Risk State

Формула для `/stocks`: сначала считается `Оборачиваемость, дн.`. `Нет остатка` = общий sellable stock 0. `Низкий остаток` = положительный stock с покрытием до 14 дней. `В норме` = покрытие больше 14 и до 120 дней. `Излишек` = покрытие больше 120 дней и минимум 10 шт. `Нет продаж` = положительный stock, но в 30-дневном окне нет продаж. Ошибка: смешивать `Нет продаж` с `Нет остатка` или считать любой запас свыше 60 дней избытком.

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

Формула для остатков: текущий sellable stock (`quantity`) / средние не-возвратные продажи в день за последние 30 завершенных дней относительно даты снимка остатков. В пути к клиенту/от клиента не включается. Основной источник продаж: локальные `wb_sales`; fallback и размерная детализация: sale quantities из `realization_reports` по `nmId`/`barcode`. Если продаж нет, показатель пустой/`Нет продаж`.

## FBS Available Stock

`onHand - reserved` по `fbs_assortment_items`. Новый заказ увеличивает `reserved`, передача WB уменьшает `onHand` и снимает резерв. Возврат не увеличивает доступное количество до явного подтверждения пригодности/оборота.

## FBS Stock Mismatch

Сумма абсолютных расхождений `abs(local available - wbStock)` по FBS-ассортименту. Публикация локального значения в WB не является частью расчета и выполняется отдельно.

## FBS Compliance Backlog

Количество задач КИЗ со статусом `OPEN` или `EXPORTED`: ввод в оборот, вывод по дистанционной/B2B продаже, возврат в оборот, перемаркировка. Для операционного контроля также отслеживать срок `dueAt`, карантин и просроченные заказы.

## FBS Finance

Продажи, возвраты и сумма к перечислению считаются только по `realization_reports.deliveryMethod=FBS` за выбранный период. Нельзя подменять финансовую продажу статусом сборочного задания.

## Typical Interpretation Mistakes

- Делать вывод без freshness check.
- Сравнивать кабинеты или периоды с разным coverage.
- Считать WB API live response источником отчета.
- Рекомендовать price/ad changes без проверки margin, stock and card quality.
