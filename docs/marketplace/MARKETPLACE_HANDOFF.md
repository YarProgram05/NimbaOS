# Marketplace Handoff

## Current Marketplace Objective

Использовать NimbaOS как базу для регулярной аналитики WB: продажи, остатки, реклама, карточки, отзывы, план/факт и рекомендации владельцу.

## Last Marketplace Session Summary

2026-06-18: created Excel report `output/excel/wb_article_profitability_2026-01-01_2026-06-17.xlsx` for both active WB cabinets, with separate sheets for `WB Galioni (WB_2)` and `WB Nimba (WB_1)`, plus `Сводка` and `Не продавались`. Used local DB only through `calculateReport`; no WB API, sync or DB/code changes. `REPORTS_PERIOD` was fully covered for 2026-01-01 - 2026-06-17. `ADVERTISING_STATS` did not cover the full January-June period, so ad/DRR influence is based only on available local ad stats. Main totals: Galioni sales 2,157,583.34 rub / OP 283,987.06 rub / 53 sold rows / 11 no-sale rows; Nimba sales 2,913,759.88 rub / OP 398,842.06 rub / 70 sold rows / 61 no-sale rows. For Nimba, size products are shown as `article + size`.

2026-06-13: created and revised PDF report `output/pdf/wb_nimba_report_2026-06-01_2026-06-12.pdf` for `WB Nimba (WB_1)` covering 2026-06-01 - 2026-06-12. Used local DB only through `getMorningReportData`; `REPORTS_PERIOD` and `ADVERTISING_STATS` were covered, latest stock snapshot was 2026-06-13 08:52 UTC, `SALES_PLAN_PERIOD` was not covered so plan/fact was excluded. Main findings: sales 352,246.94 rub / 202 units, ordered 648,048.13 rub, buyout 56.74%, operating profit 43,146.16 rub, margin 12.25%, ad spend 7,998.22 rub, DRR 2.27%; stock 3,755 units / 2,481,295 rub cost value, average turnover 624.4 days, 39 overstock SKU. User-requested revision: child products are shown as separate `article + size` rows; stock-risk table is only `Парео` and `Туники`, excluding stopped articles (`парео сирень2`, `парео фуксия`, listed long pareo, `пижама003`, `пижама004`).

2026-06-07: clarified and fixed stock risk interpretation in NimbaOS. `Оборачиваемость, дн.` is not a WB-provided field; it is calculated as current sellable stock divided by average daily non-return sales over the 30 completed days before the latest stock snapshot. `/stocks` now uses local `wb_sales` plus `realization_reports` sale quantities as fallback, and risk states are: `Нет остатка` when total sellable stock is zero; `Низкий остаток` up to 14 days; `В норме` 14-120 days; `Излишек` above 120 days with at least 10 units; `Нет продаж` when positive stock has no recent demand. Category filtering supports selecting multiple categories.

2026-06-01: created Google Sheet `Анализ детских парео и туник — май 2026` for child pareo/tunics supply planning. Used local DB only: `realization_reports` covered 2026-05-01 - 2026-05-31; latest stock snapshots were synced 2026-06-01. Main finding: Galioni child pareo stock is excessive versus May demand; Nimba child tunics need targeted replenishment in large sizes, especially white 134-152/152-164 and pink 134-152/152-164.

2026-05-25: filled Google Sheet `Утренний отчет WB`, tab `WB Galioni`, for 2026-05-01 - 2026-05-24 from local DB-backed report data. 2026-05-25 was left blank because the day was not covered yet; no ad-hoc WB API call or historical resync was performed.

2026-05-25: corrected `Заказано руб.` definition. It now includes all WB orders, including cancelled rows, so the metric reflects ordered ruble volume rather than non-cancelled/fulfilled order volume.

2026-05-25: fixed the ordered-rubles sync issue for morning-report prep. Report sync now refreshes the `wb_orders` source for the selected period.

2026-05-25: подготовлены метрики для будущего `Утренний отчет WB` по Galioni. `ДРР` уже был в фин. отчете; добавлены `Заказано руб.`, `ROMI %`, `Оборачиваемость, дн.` и локальный источник `getMorningReportData`. Google Sheet не заполнялся.

## Current Safe Next Step

For WB Nimba, next safe analysis step is to investigate low buyout/high cancellations and overstock causes before recommending price, card or advertising changes. For supply planning, prioritize Nimba child tunic large-size replenishment from the May analysis only after checking current size-level stock; do not create WB-side changes without confirmation.

## Active Marketplace Risks

- Нельзя менять цены, карточки, рекламу, ставки или остатки без подтверждения.
- Данные могут быть устаревшими или неполными; всегда проверять coverage.
- Для Galioni orders/sales могут отставать от financial reports; `Заказано руб.` зависит от `wb_orders`.
- Stock turnover and risk depend on local 30-day demand coverage; if recent `wb_sales` and `realization_reports` are stale, interpret `Нет продаж` cautiously.
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

2026-06-18 — created both-cabinet article profitability Excel for 2026-01-01 - 2026-06-17 and logged findings.
