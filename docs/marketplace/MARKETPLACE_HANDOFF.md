# Marketplace Handoff

## Current Marketplace Objective

Использовать NimbaOS как базу для регулярной аналитики WB: продажи, остатки, реклама, карточки, отзывы, план/факт и рекомендации владельцу.

## Last Marketplace Session Summary

2026-05-25: filled Google Sheet `Утренний отчет WB`, tab `WB Galioni`, for 2026-05-01 - 2026-05-24 from local DB-backed report data. 2026-05-25 was left blank because the day was not covered yet; no ad-hoc WB API call or historical resync was performed.

2026-05-25: corrected `Заказано руб.` definition. It now includes all WB orders, including cancelled rows, so the metric reflects ordered ruble volume rather than non-cancelled/fulfilled order volume.

2026-05-25: fixed the ordered-rubles sync issue for morning-report prep. Report sync now refreshes the `wb_orders` source for the selected period.

2026-05-25: подготовлены метрики для будущего `Утренний отчет WB` по Galioni. `ДРР` уже был в фин. отчете; добавлены `Заказано руб.`, `ROMI %`, `Оборачиваемость, дн.` и локальный источник `getMorningReportData`. Google Sheet не заполнялся.

## Current Safe Next Step

For the next morning update, fill only newly covered dates after checking local coverage. Current sheet has Galioni values through 2026-05-24; 2026-05-25 should be filled only after report/orders/sales/ads coverage exists in the local DB.

## Active Marketplace Risks

- Нельзя менять цены, карточки, рекламу, ставки или остатки без подтверждения.
- Данные могут быть устаревшими или неполными; всегда проверять coverage.
- Для Galioni orders/sales могут отставать от financial reports; `Заказано руб.` зависит от `wb_orders`.
- Рекомендации должны быть осторожными, особенно при низком объеме данных.

## Read Next If Needed

- `docs/marketplace/ANALYTICS_PLAYBOOK.md`
- `docs/marketplace/REPORTS_GUIDE.md`
- `docs/marketplace/KPI_DEFINITIONS.md`
- `docs/marketplace/DAILY_CHECKLIST.md`
- `docs/marketplace/DECISION_RULES.md`
- `docs/core/DATABASE_ACCESS_GUIDE.md`

## Do Not Do

- Не вызывать WB API ad-hoc для отчета.
- Не делать full historical sync без подтверждения.
- Не выдавать опасную рекомендацию как автоматическое действие.

## Last Updated

2026-05-25 — filled `Утренний отчет WB` / `WB Galioni` through 2026-05-24.
