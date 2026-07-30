# Marketplace Handoff

## Current Marketplace Objective

Использовать NimbaOS как базу для регулярной аналитики WB: продажи, остатки, реклама, карточки, отзывы, план/факт и рекомендации владельцу.

## Last Marketplace Session Summary

2026-07-25: created validated Excel `outputs/wb_supply_2026-07-25/Рекомендации_по_поставке_август-сентябрь_2026.xlsx` for `WB Nimba (WB_1)` and `WB Galioni (WB_2)`. Local DB only; no WB API/sync/WB-side changes. Orders and financial rows cover 2026-06-15 - 2026-07-19; stocks are from 2026-07-25 Moscow snapshots. The analysis treats Электросталь, Краснодар, Невинномысск, СПБ/СЦ Шушары and Котовск as zero stock and excludes in-way quantities. Nimba: 2,523 orders / 837 cancellations / 896 included stock / 1,891 excluded stock / 1,488 recommended supply units. Galioni: 2,544 / 834 / 416 / 836 / 1,726. Forecast applies a moderate post-peak decline: August 75% and September 45% of the blended demand base. Only Nimba child products are split as `article + size`.

2026-07-21: created validated Excel `outputs/wb_analytics_2026-07-21/WB_аналитика_01.05.2026-19.07.2026.xlsx` for `WB Nimba (WB_1)` and `WB Galioni (WB_2)`. Local DB only; no WB API/sync/WB-side changes. `REPORTS_PERIOD`, `wb_orders` and financial data cover 2026-05-01 - 2026-07-19; stocks are from 2026-07-21 snapshots. Full-period results: Nimba 3,566 orders / 1,980 net sold units / 2,730,399.55 rub sales / 234,218.42 rub OP / 8.6% margin / 1,200 sellable units; Galioni 3,650 orders / 2,059 net sold units / 2,616,749.06 rub sales / 74,489.45 rub OP / 2.9% margin / 528 sellable units. July daily pace shifted to Nimba: 52.79 net units/day vs Galioni 50.42, while second-half June was led by Galioni at 32.73 vs 24.60. Nimba child products are split only as `article + size`; all other products remain article-level. In-way quantities are excluded from stock.

2026-06-28: updated live Google Sheet `Утренний отчет WB` for both `WB Nimba` and `WB Galioni` from local DB only. Removed `ROMI`; added `Выкупили, шт` after `Выкупили, руб`; added `ЧП на 1 ед` after `ЧП`; added `Итого с начала года`. Daily June rows are filled through 2026-06-27 after verification; YTD totals cover 2026-01-01 - 2026-06-27. Plan/fact/progress rows and charts shifted down. Workflow guard was fixed so full-year reports are required for YTD, while ad coverage is checked for the current month window.

2026-06-27: diagnosed `WB Nimba (WB_1)` cancellations/product losses for 2026-06-22 - 2026-06-25 and created Excel `output/excel/wb_nimba_cancellations_2026-06-22_2026-06-25.xlsx`. Local DB only; no WB API/sync/WB-side changes. Added reusable script `scripts/analyze-nimba-cancellations.ts`. Key findings: Nimba cancellation pressure concentrated in `Парео` (60 cancellation rows in problematic subset, negative OP -2,216.08 rub) and several tunic size rows; worst ad loss was `туника с поясом леопард пятна` with 2,017.93 rub spend, 9,793 views / 410 clicks, 1 ad order, 0 sales and OP -2,473.41. Next safe step: restrict/stop poor ad rows and move budget only after checking stock and confirming action.

2026-06-26: created Excel `output/excel/wb_cabinet_factor_analysis_2026-06-22_2026-06-25.xlsx` comparing `WB Galioni (WB_2)` and `WB Nimba (WB_1)` across finance, products, categories, ads, stocks, reviews/questions and coverage. Used local DB only via `calculateReport` with persisted ad stats plus bounded Prisma reads; no WB API/sync/WB-side changes. Coverage: `REPORTS_PERIOD` and `ADVERTISING_STATS` covered for both cabinets; latest stock snapshots from 2026-06-26; `wb_sales` and `wb_funnel_stats` had no rows for the period, so sales/funnel conclusions rely on financial reports, orders and ad stats. Main totals: Galioni sales 163,996.39 rub / OP 11,148.30 rub / margin 6.80% / buyout 59.91% / ad spend 2,747.02 rub; Nimba sales 112,431.20 rub / OP 751.48 rub / margin 0.67% / buyout 40.22% / ad spend 2,892.56 rub. Key drivers: Galioni sold 1.81x more units with better buyout and much lower logistics/storage/commission load; Nimba ads spent slightly more but produced fewer ad orders and much weaker order sum.

2026-06-19: created Excel `output/excel/wb_article_profitability_2026-06-01_2026-06-14.xlsx` for both WB cabinets from the preserved formatted workbook structure. Local DB only, no WB API/sync/code/DB changes. Replaced `Sold before returns` with total stock, kept the key profitability tables, no-sale sheet, and added two comparison sheets: user-style comparison from the provided loss-items workbook and Codex logical comparison of WB Nimba zero/negative margin rows against WB Galioni analogs. Totals: Galioni sales 348,118.03 rub / OP 32,074.11 rub / 45 sold rows / 23 no-sale rows; Nimba sales 421,837.80 rub / OP 53,037.91 rub / 56 sold rows / 77 no-sale rows. Workbook checks: no `???` factor text and no old sold-before-returns header.

2026-06-19: regenerated Excel `output/excel/wb_article_profitability_2026-01-01_2026-06-17.xlsx` after dated article versions were implemented. Local DB only, no WB API/sync. Current totals: Galioni sales 2,157,583.34 rub / OP 185,410.06 rub / 56 sold rows / 11 no-sale rows; Nimba sales 2,913,759.88 rub / OP 398,842.06 rub / 72 sold rows / 60 no-sale rows. `???` factor text was checked and not present.

2026-06-18: created Excel report `output/excel/wb_article_profitability_2026-01-01_2026-06-17.xlsx` for both active WB cabinets, with separate sheets for `WB Galioni (WB_2)` and `WB Nimba (WB_1)`, plus `Сводка` and `Не продавались`. Used local DB only through `calculateReport`; no WB API, sync or DB/code changes. `REPORTS_PERIOD` was fully covered for 2026-01-01 - 2026-06-17. `ADVERTISING_STATS` did not cover the full January-June period, so ad/DRR influence is based only on available local ad stats. Main totals: Galioni sales 2,157,583.34 rub / OP 283,987.06 rub / 53 sold rows / 11 no-sale rows; Nimba sales 2,913,759.88 rub / OP 398,842.06 rub / 70 sold rows / 61 no-sale rows. For Nimba, size products are shown as `article + size`.

2026-06-13: created and revised PDF report `output/pdf/wb_nimba_report_2026-06-01_2026-06-12.pdf` for `WB Nimba (WB_1)` covering 2026-06-01 - 2026-06-12. Used local DB only through `getMorningReportData`; `REPORTS_PERIOD` and `ADVERTISING_STATS` were covered, latest stock snapshot was 2026-06-13 08:52 UTC, `SALES_PLAN_PERIOD` was not covered so plan/fact was excluded. Main findings: sales 352,246.94 rub / 202 units, ordered 648,048.13 rub, buyout 56.74%, operating profit 43,146.16 rub, margin 12.25%, ad spend 7,998.22 rub, DRR 2.27%; stock 3,755 units / 2,481,295 rub cost value, average turnover 624.4 days, 39 overstock SKU. User-requested revision: child products are shown as separate `article + size` rows; stock-risk table is only `Парео` and `Туники`, excluding stopped articles (`парео сирень2`, `парео фуксия`, listed long pareo, `пижама003`, `пижама004`).

2026-06-07: clarified and fixed stock risk interpretation in NimbaOS. `Оборачиваемость, дн.` is not a WB-provided field; it is calculated as current sellable stock divided by average daily non-return sales over the 30 completed days before the latest stock snapshot. `/stocks` now uses local `wb_sales` plus `realization_reports` sale quantities as fallback, and risk states are: `Нет остатка` when total sellable stock is zero; `Низкий остаток` up to 14 days; `В норме` 14-120 days; `Излишек` above 120 days with at least 10 units; `Нет продаж` when positive stock has no recent demand. Category filtering supports selecting multiple categories.

2026-06-01: created Google Sheet `Анализ детских парео и туник — май 2026` for child pareo/tunics supply planning. Used local DB only: `realization_reports` covered 2026-05-01 - 2026-05-31; latest stock snapshots were synced 2026-06-01. Main finding: Galioni child pareo stock is excessive versus May demand; Nimba child tunics need targeted replenishment in large sizes, especially white 134-152/152-164 and pink 134-152/152-164.

2026-05-25: filled Google Sheet `Утренний отчет WB`, tab `WB Galioni`, for 2026-05-01 - 2026-05-24 from local DB-backed report data. 2026-05-25 was left blank because the day was not covered yet; no ad-hoc WB API call or historical resync was performed.

2026-05-25: corrected `Заказано руб.` definition. It now includes all WB orders, including cancelled rows, so the metric reflects ordered ruble volume rather than non-cancelled/fulfilled order volume.

2026-05-25: fixed the ordered-rubles sync issue for morning-report prep. Report sync now refreshes the `wb_orders` source for the selected period.

2026-05-25: подготовлены метрики для будущего `Утренний отчет WB` по Galioni. `ДРР` уже был в фин. отчете; добавлены `Заказано руб.`, `ROMI %`, `Оборачиваемость, дн.` и локальный источник `getMorningReportData`. Google Sheet не заполнялся.

## Current Safe Next Step

Use the 2026-07-25 supply workbook for the physical shipment list. Recheck the stock snapshot immediately before shipment and include external/in-production quantities outside NimbaOS. The current child-size priorities are Nimba pink 134-152 (63 units), pink 112-134 (45), pink 152-164 (45), pink 92-110 (34), blue 152-164 (28), blue 134-152 (21), white 134-152 (10) and white 152-164 (3). Do not replenish high-volume but loss-making rows solely because demand is high; first review economics for Nimba `туника/черный/лист`, `парео/хлопок/желтый` and Galioni loss leaders. Any price, card, advertising or WB-side stock action still requires owner confirmation.

## Active Marketplace Risks

- Нельзя менять цены, карточки, рекламу, ставки или остатки без подтверждения.
- Данные могут быть устаревшими или неполными; всегда проверять coverage.
- Для Galioni orders/sales могут отставать от financial reports; `Заказано руб.` зависит от `wb_orders`.
- Stock turnover and risk depend on local 30-day demand coverage; if recent `wb_sales` and `realization_reports` are stale, interpret `Нет продаж` cautiously.
- Рекомендации должны быть осторожными, особенно при низком объеме данных.
- FBS operational accounting is available under `/fbs`, and its migration is applied to the local development database only. Read-only WB contracts were smoke-tested for one local cabinet: 16 FBS positions and 215 WB stock units are now visible after checking the full local product-size catalog. No production migration, historical backfill or WB write was run. Local physical stock is authoritative; WB stock is a separate reconciliation value until an explicit publication.
- Marked FBS units must be tracked individually. Cancellation before handoff releases the KIZ; post-handoff returns stay quarantined until inspection and, when needed, return-to-circulation confirmation.
- Current KIZ intake supports a full DataMatrix code manually or via XLSX (`КИЗ` plus `chrtId` or `barcode`); direct PDF decoding is not implemented. A secure PDF importer needs a representative PDF/template and must decode locally without exposing full codes.
- If fulfillment scans/attaches the KIZ in WB while packing, WB FBS metadata provides the exact `orderId -> sgtin[]` mapping. This was live-verified for 20 of 24 latest orders across both local cabinets. NimbaOS should pull this mapping securely; a separate fulfillment screen is needed only if fulfillment does not record the code in WB.
- NimbaOS now pulls this mapping securely. Live execution created/assigned 20 encrypted KIZ units and 20 remote-sale withdrawal tasks with no reject, conflict or GTIN mismatch; an immediate rerun was fully idempotent.
- Nine additional Nimba KIZ mappings for 2026-07-28 were repaired after replacing stale workers. All 9 now show `Метаданные WB: Получены`; the former `Заблокировано` state was a UI conflation with Chestny Znak circulation, not a WB metadata failure.
- PDF labels alone are still insufficient when fulfillment only sticks the label physically and never scans it into WB. PDF import remains useful for knowing the pre-packing KIZ pool, but is not required for post-packing order mapping when WB metadata is populated.
- For marked FBS, the seller remains responsible for Chestny Znak documents. Before handoff cancellation only releases the assignment; after withdrawal and physical return, use return to circulation, while damaged/missing marking requires the applicable remarking path.

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

2026-07-30 — implemented the FBS/KIZ Stage 1 workplace and verified read-only WB synchronization, including live order-to-SGTIN metadata for 20 of 24 latest FBS orders; no WB write action was performed.

2026-07-25 — created and validated the two-cabinet August-September supply workbook with five warehouse exclusions and Nimba child size-level rows.

2026-07-21 — created and validated the two-cabinet sales/stock/supply Excel for 2026-05-01 - 2026-07-19; logged freshness, size-level Nimba logic and current supply risks.

2026-06-28 — updated `Утренний отчет WB` layout/data through 2026-06-26 and logged findings.

2026-06-28 - updated Google Sheet `WB Unit 3.0` tabs `UNIT WB Nimba (WB_1)` and `UNIT WB Galioni (WB_2)`: refreshed local product/price cache via the standard product sync, updated base price/discount/SPP, added DB products with costPrice > 50 RUB, and refreshed current cost prices. No WB-side price/card changes were made.
