# Analytics Playbook

Как проводить marketplace-аналитику в NimbaOS. Last updated: 2026-05-24.

## Before Any Report

1. Выбрать `wbAccountId`.
2. Выбрать период.
3. Проверить coverage/status sync.
4. Если данных нет или они устарели, использовать штатный sync-сервис для недостающего диапазона.
5. Строить выводы из базы.

## Sales

Источник: financial report service (`report-calculator`) and/or `wb_sales` through plan/dashboard services. Смотреть продажи, возвраты, net sales, operating profit, margin, average daily sales.

## Orders

Источник: `wb_orders` through plan/dashboard services. Смотреть заказы, отмены, динамику по дням, связь с рекламой и funnel.

## Buyout

Источник: realization reports and report formulas. Выкуп считать как bought-with-returns over delivered count where report logic supports it.

## Stocks And OOS Risk

Источник: latest stock snapshot through `getStocksSummary`/`getPaginatedStocks`. Сравнивать текущий остаток со средними продажами в день и планом.

## Plan/Fact

Источник: `calculatePlanDetail`, sales plan actions. Проверять отклонение по quantity/revenue/profit and daily pace.

## Prices

Источник: local `products`, `product_sizes`, report realized prices. Не менять цены без подтверждения. Анализировать цену вместе с margin, conversion, stock, ad spend.

## Advertising

Источник: `ad_campaigns`, `ad_campaign_stats`, `ad_campaign_nm_stats`, report/dashboard services. Смотреть spend, orders, cart adds, CPO, CPC, CPM, DRR, stale stats.

## Cards

Источник: local products, funnel conversion, reviews/questions. Ищем низкую конверсию, слабые фото/описание/размерную сетку как гипотезу, не как факт без проверки карточки.

## Raw vs Normalized vs Aggregate

- Regular report: service/calculator first.
- Point investigation: normalized/project tables.
- Raw table: only bounded by account and period.
- Aggregate tables/views: не обнаружены; если появятся, использовать для long-period analysis.

## Output Format

- Question.
- Data used.
- Freshness check.
- Findings.
- Recommendation.
- Risk/confirmation needed.
- Follow-up.

