# Marketplace Analysis Log

## 2026-08-24 - Ozon Unit 3.0 filled for Nimba and Galioni

### Request
Fill every manual field in the live `OZON Unit 3.0` Google Sheet for Nimba and Galioni from the supplied Ozon exports and shared cost workbook while leaving formula fields and workbook-wide settings unchanged.

### Data Used
Per cabinet: current product and price exports dated 2026-08-24, accrual detail for 2026-05-26 through 2026-08-23, and order CSV covering the same completed 90-day window. Cost source: `costPriceTemplate_себестоимость.xlsx`. No local NimbaOS database, Ozon API or Ozon-side mutation was used.

### Mapping And Calculations
Loaded 56 Nimba and 51 Galioni current product rows; all are FBO. Ozon product types were kept cabinet-specific: Nimba has 43 `Парео`, 7 `Накидка пляжная` and 6 `Халат`; Galioni has 19 `Накидка пляжная` and 32 `Туника`. All 51 Galioni articles and 14 Nimba articles matched the cost file exactly; 42 Nimba legacy aliases were mapped to the same model/material/color/size family. Base price is the price before discount, seller discount is derived from current promotion/strategy price, Ozon co-investment is derived from buyer versus seller price, and the current FBO commission is 48% for every row.

Per-SKU buyout is delivered quantity divided by delivered plus canceled quantity during the 90-day window. Cabinet totals were 53.52% for Nimba and 55.15% for Galioni. One Nimba and two Galioni SKUs had cancellations but no delivered units; cabinet-level buyout was used for those rows because zero causes the template's return-logistics formula to divide by zero. Shipment and delivery clusters are the quantity-weighted per-SKU modes, with cabinet mode only when a SKU has no cluster observations. Nimba had no promotion accruals in the source period. Galioni promotion charges were allocated per delivered unit to SKU `4626053277` at 172.48 rubles and SKU `4626177701` at 354.29 rubles.

Ozon exports provide volume but not three physical package sides. To preserve the value used by the workbook's logistics formula, dimensions were derived as height x 35 x 25 cm from each exported volume. Owner assumptions were applied as instructed: internal per-unit and additional expenses zero, paid acceptance `Нет`, VAT and VAT recovery zero, Nimba tax 8%, Galioni tax 7%, and workbook-wide defaults unchanged. The tax dropdown uses the workbook-compatible `УСН (с дохода)` label for both rates.

### Validation
API readback matched all written manual values. Product-name counts are exactly 56 and 51 with no stale rows through row 200. Each tab retains 24 row-9 formula anchors. After the three buyout fallbacks, the populated ranges contain no spreadsheet formula errors. Both tabs were opened in Google Sheets and visually checked; dropdown chips, links, dimensions, volumes, costs and preserved formatting render correctly.

### Follow-up
Recalculate when the 90-day window, price/commission export or shared costs materially change. If exact physical package dimensions become available, replace the derived sides while keeping the same package volume unless Ozon itself reports a changed volume. No Ozon price, product card, advertising, stock or setting was changed.

## 2026-08-24 - Ozon Unit 3.0 source and export mapping

### Request
Inspect the live Google Sheet `OZON Unit 3.0`, understand which cells are manual, and identify the minimum Ozon Seller files and exact export paths needed to fill both Nimba and Galioni.

### Sources And Safety
Read the workbook structure through connected Google Drive/Sheets and inspected the current logged-in Ozon Seller interface in read-only fashion. No spreadsheet cell, Ozon setting, marketplace data, local database row or source file was changed. No report was downloaded. Buyer personal data was neither needed nor collected.

### Workbook Mapping
The workbook has visible sheets `INFO`, `UNIT 1 Nimba` and `UNIT 1 Ozon Galioni`; the two working tabs have the same 75-column layout. One product/Ozon SKU is filled per row from row 10. Manual or dropdown inputs are product name, Ozon SKU, seller article, cabinet-specific category, fulfillment type, package dimensions, internal cost and seller-paid per-unit costs, base price/seller discount/Ozon co-investment, optional manual commission, supply/delivery clusters, buyout percentage, paid acceptance, extra Ozon charges, advertising, tax/VAT and optional additional expenses. All other working columns are formula-driven. The hidden tariff reference reports update date 2026-07-15.

### Minimum Export Pack
For each cabinet request: (1) `Товары` from `Товары -> Список товаров -> Скачать шаблоны -> Товары`; (2) price XLSX from `Цены и акции -> Цены -> Скачать шаблон xlsx`; (3) FBO order XLSX for the latest 90 completed days from `Аналитика -> Моя аналитика -> Отчёты -> Заказы -> Заказы со складов Ozon`, with analytical data enabled and buyer/jewelry options disabled; (4) accrual detail for the same period from `Финансы -> Начисления и документы -> Экономика магазина -> Детализация начислений -> Скачать отчёт`. Request `Заказы с моих складов` only for a cabinet that actually uses FBS. Product analytics XLSX is not required and may be Premium-only.

### Remaining Owner Inputs
Ozon reports cannot establish internal purchase cost, seller-paid transport/packaging/fulfillment, tax and VAT settings or the desired paid-acceptance scenario. The owner must also confirm whether to keep workbook defaults of 1.5% acquiring, 14 storage days, 1.5% last mile and tax calculation after Ozon co-investment. Match cross-cabinet products by Ozon SKU plus seller article and map categories separately rather than inheriting Nimba categories into Galioni.

## 2026-08-21 - Cost-price template filled from mini-PC production DB

### Request
Fill the supplied 155-row cost-price workbook from the current server database, add 35 rubles to each unit cost, and do not change the database.

### Data Used
Read-only access to the mini-PC production PostgreSQL reference tables for active WB accounts. No `.env` values, API keys or decrypted secrets were read or printed. No WB API or synchronization was invoked.

### Mapping And Result
85 rows matched `cost_prices` directly by normalized seller article. The current cream article was linked through its historical `nmId` to the existing server cost reference. The remaining 69 alternate marketplace labels were mapped explicitly to the equivalent WB model/material/color/size family, and the matched server cost was used. Each exported value equals the selected database cost plus 35 rubles. All 155 target cells are numeric and nonblank; the exported range has no formula errors and the preserved two-column layout passed visual inspection.

### Output And Safety
Created `outputs/cost_price_fill_2026-08-21/costPriceTemplate_себестоимость_плюс_35.xlsx`. The source workbook was left unchanged. No production database row, WB-side setting, price, card, stock, advertising state or sync state was modified.

## 2026-08-13 - Portable delivery repair for August commission report

The previously rendered MCP artifact for the WB Nimba July/August commission diagnostic did not open in the desktop interface. The complete validated report was recovered from its canonical artifact payload and repackaged as a self-contained HTML file at `output/reports/commission_shift_august_2026/commission_shift_august_2026.html`. The wide comparison tables were converted to equivalent compact narrative summaries and the grouped bar chart was changed to a two-series line chart using the same daily data. Currency labels were fixed to rubles. Canonical validation and packaging passed; browser QA was limited to structural verification because the packaged reader's strict Windows overflow check detected the vertical-scrollbar width, although the diagnostic browser render itself loaded the report content correctly. No analytical values, database rows, sync state or WB-side data changed.

## 2026-08-13 - Negative WB commission audit: Galioni, 1-30 April

### Question
Означает ли отрицательная комиссия WB Galioni за 1-30 апреля прибыль продавца и почему комиссия стала отрицательной?

### Data Used
Локальная БД NimbaOS, штатный `calculateReport` и независимая агрегация `realization_reports` для `WB Galioni (WB_2)`. Для трактовки механизма использована официальная документация WB по КВВ и детализации финансового отчёта. WB API и повторная историческая синхронизация не вызывались.

### Freshness Check
`REPORTS_PERIOD` полностью покрывает 2026-04-01 - 2026-04-30. Проверено 2 396 финансовых строк, все `rrdId` уникальны, даты операций охватывают весь месяц. Штатный отчёт и независимый расчёт комиссии совпали до копейки.

### Findings
Комиссия по продажам составила -2 016,15 руб.; возвраты сторнировали 595,23 руб. начисления, поэтому чистая комиссия равна -1 420,92 руб. Средневзвешенный КВВ был 34,50%, а платформенная скидка — 34,99%, поэтому по части продаж итоговое вознаграждение WB стало отрицательным и увеличило взаиморасчёт в пользу продавца. Это не равно прибыли периода: после логистики 80 894,76 руб., хранения 16 192,42 руб., рекламы 6 265,69 руб., себестоимости 163 212 руб. и налогов 24 433,53 руб. операционная прибыль составила 3 708,03 руб., маржа 1,21%.

### Recommendations
Отрицательную комиссию трактовать как начисление/компенсацию в пользу продавца внутри взаиморасчётов WB. Для оценки фактической прибыльности всегда использовать операционную прибыль после всех учтённых расходов, а не знак одной строки комиссии.

### Follow-up
При необходимости бухгалтерского подтверждения сопоставить строки недельных детализаций WB за апрель по полям КВВ, платформенной скидки и итогового вознаграждения.

## 2026-08-13 - WB Nimba commission shift: 1-12 July vs 1-12 August

### Question
Почему комиссия за 1-12 августа почти в семь раз выше, чем за 1-12 июля, и корректен ли расчёт?

### Data Used
Локальная БД NimbaOS, штатный `calculateReport` и независимая агрегация строк `realization_reports` для `WB Nimba (WB_1)`. Для внешней проверки механизма использованы официальные справочные материалы WB по КВВ, платформенной скидке и тарифам. WB API и повторная историческая синхронизация не вызывались.

### Freshness Check
`REPORTS_PERIOD` полностью покрывает оба окна. Синхронизация завершена 2026-08-13 по московскому времени. Проверено 4 912 июльских и 3 450 августовских финансовых строк; все `rrdId` уникальны, даты операций покрывают 1-12 число, штатный отчёт и независимый расчёт совпали до копейки.

### Findings
Комиссия выросла с 10 255,28 до 70 216,60 руб., то есть в 6,85 раза (+59 961,32 руб.), хотя продажи снизились на 36,07%, а чистые продажи в штуках — на 40,55%. Эффективная комиссия к базе до платформенной скидки выросла с 0,97% до 11,19%. Средневзвешенный КВВ поднялся с 36,38% до 44,04% (+7,66 п.п.), а платформенная скидка уменьшилась с 35,17% до 30,43% (-4,73 п.п.). Рост распределён широко: 52 из 64 августовских артикулов дали положительный вклад; топ-5 объясняют только 32,34% разницы. Контрольный кабинет Galioni показал аналогичный сдвиг комиссии в 5,71 раза при снижении продаж, поэтому это не ошибка одного кабинета.

### Recommendations
Считать августовскую комиссию реальным расходом и использовать фактическую нагрузку около 11-12% базы до платформенной скидки при расчёте маржи. В кабинете WB проверить историю раздела «Тарифы», категорийные комиссии и подключённые опции «Конструктора тарифов». Не менять цены, рекламу или карточки без отдельного подтверждения.

### Follow-up
Локальные данные доказывают механизм роста, но не хранят договорное основание изменения тарифа. Для точной атрибуции нужно сопоставить период изменения КВВ с историей тарифов/новостями конкретного кабинета WB.

## 2026-08-13 - Late FBS withdrawal audit: Nimba and Galioni

Official CRPT guidance requires light-industry remote-sale withdrawal after shipment, within three working days and before actual delivery. That remains the normal prospective rule. A historical sync can first reveal the order/KIZ after WB already reports pickup cancellation or defect. If NimbaOS has no confirmed withdrawal in that case, submitting a late withdrawal solely to immediately return the code to circulation adds no useful state transition and creates avoidable operator work.

Local account audit found Nimba's latest 28-row export contained 27 pickup cancellations and one defect, all unconfirmed and already `RETURN_EXPECTED`. Galioni had 40 open unconfirmed withdrawal tasks on canceled orders; 11 were present in two prior export files. All 68 tasks were canceled locally with audit records, circulation was restored to `IN_CIRCULATION`, and physical state remained `RETURN_EXPECTED`. Confirmed withdrawal records were not changed. Final audit found zero open canceled-order withdrawal tasks in either cabinet. Future state transitions and export selection now enforce the same rule.

## 2026-08-13 - FBS archive access, profitability and buyout

The FBS page now preserves fast initial rendering while making all retained account history searchable. Heavy journals query the server with account, optional date range, query/filter, sort and page size; only the requested page reaches the browser. KIZ exact-text search preserves encrypted-at-rest storage and is evaluated only inside the trusted application process. Local smoke checks demonstrated matches beyond the former 100-row window.

Analytics adds two distinct ratios. Margin uses direct FBS OP divided by net revenue. Profitability uses direct FBS OP divided by modeled total FBS expenses (`revenue - OP`). Buyout uses net sold units divided by completed sale/cancellation outcomes, so orders still being assembled or delivered do not lower the ratio. Shared advertising is still excluded from direct FBS OP due to the absence of a reliable FBS/FBO allocation key.

## 2026-08-13 - FBS article OP and KIZ correction

Article-level FBS analytics now joins operational FBS orders with account-scoped realization rows. Orders/cancellations use order creation dates; buyouts/returns/revenue/transfer/direct expenses use finance operation dates. Direct FBS OP subtracts realization logistics/storage/acceptance/additions/penalties/deductions, current cost-price references and the account tax rate. Shared ad spend is excluded because it has no auditable FBS/FBO allocation, so this metric is a fulfillment contribution view rather than the complete company OP.

The user-authorized KIZ correction was preceded by exact encrypted-code verification. One unit matched, its current order is sold, and its prior test withdrawal/return events matched the user's description. Its local circulation state changed once from `IN_CIRCULATION` to `WITHDRAWN`, with an audit event recording the correction. The operation did not contact WB or CRPT; the user stated they would perform the actual Chestny Znak withdrawal separately.

## 2026-08-13 - CRPT MOD/FIAS rejection for remote-sale withdrawal

The exact processing error was `МОД по указанным ИНН 501709065638, КПП null, ФИАС null не найдены`. The 12-digit INN identifies an individual entrepreneur, for whom a null KPP is normal. The failure is caused by the absent FIAS ID / registered place of business. Current official light-industry guidance states that from 2026-03-01 remote-sale withdrawal requires MOD/FIAS data and that all market participants must register the place under the relevant product group in the CRPT profile. Required recovery: add an active MOD in `Профиль -> МОД -> Легкая промышленность`, use that location in a newly created withdrawal document, and resubmit the same KIZ file. CRPT documents processed with errors are not accounted for, so the codes were not withdrawn by those failed documents and must not be returned to circulation first.

## 2026-08-13 - CRPT withdrawal prices and apparent warehouse KIZ audit

The CRPT withdrawal upload requires a numeric `Цена за единицу с НДС`. The local withdrawal queue has a linked FBS order price for every audited task. Future files use `convertedPriceRaw / 100` in rubles; no VAT is added because the seller uses VAT 0%. Four prior withdrawal workbooks were rebuilt as separate corrected copies containing 9, 16, 163 and 179 unique rows. All 367 source rows matched, no duplicate code existed within a file, and price ranges were 622-1,582; 992-1,399; 622-1,993.36; and 614-1,879 rubles respectively. The originals and application data were not changed.

A bounded read-only audit found 57 units displayed as physical `IN_STOCK` with unspecified CRPT circulation: 29 Galioni and 28 Nimba. All 57 were imported from `wb_fbs_metadata` on 2026-08-11, none was manually imported/scanned, every unit had a historical order link, and all linked orders were post-handoff `complete/canceled_by_client` or `complete/defect`. Therefore these are not anonymous warehouse labels. They are historical records created by the old cancellation classification, which cleared the current order and left the initial circulation unknown. The already implemented state-machine/workspace repair can recover them on the next normal bounded operational sync; no sync, DB write, WB write or CRPT operation was executed during this audit.

## 2026-08-12 - FBS canceled/defect KIZ and unknown circulation audit

### Question
Почему отменённые при получении и бракованные FBS-заказы показывают отсутствие КИЗа, что означает неопределённый оборот и как заполнять номер документа ЧЗ?

### Data Used
Локальная схема и сервисы FBS, ограниченный read-only аудит связей заказов/KIZ/compliance events, интерфейс пользователя и официальная инструкция CRPT. WB API, CRPT API и production writes не вызывались; сырые КИЗы не выводились.

### Findings
`canceled_by_client` и `defect` ошибочно попадали в отмену до передачи при позднем локальном shipment flag и могли отвязать код. `UNKNOWN` создаётся при импорте/WB metadata без явно подтверждённого исходного состояния ЧЗ; это не сигнал о перемаркировке. Поля CRPT отмечаются обязательными символом `*`; показанные пользователем номер/дата/наименование первичного документа без звёздочек необязательны.

### Recommendations
Сохранять исходный КИЗ за заказом до физического возврата и проверки. В NimbaOS после обработки файла фиксировать реальный номер или ID подписанного документа из списка документов ЧЗ, а не случайные значения. Для старых записей сначала выполнить обычную ограниченную FBS-синхронизацию: связь восстановится, если WB ещё отдаёт SGTIN; код нельзя угадывать, если его нет ни в WB, ни в локальной истории.

### Follow-up
После выкладки визуально проверить фильтр «Отмена при получении / брак», отображение `01GTIN21serial`, статус «Статус в ЧЗ не указан» и массовое подтверждение одного CRPT-файла.

## 2026-08-12 - Nimba legacy KIZ export reconciliation

For 2026-07-28 - 2026-08-12, Nimba has 201 FBS orders and 34 currently canceled orders, leaving 167 non-canceled orders. This is not the denominator for withdrawal: six non-canceled orders had not reached handoff and therefore had no withdrawal task, and one withdrawal task had already been confirmed before the legacy export. The file also contains three tasks for orders canceled after handoff; they remain in the withdrawal lifecycle because the goods had already been handed over. Reconciliation: `167 - 6 - 1 + 3 = 163` exported KIZs.

The provided legacy workbook contained 163 unique tasks, 163 unique orders and 163 unique KIZs, all `WITHDRAWAL_REMOTE_SALE`. It was converted to one first-sheet column `Код маркировки`; every value was converted to the KIZ identification part and checked for uniqueness and the absence of Excel GS escape suffixes. No DB, WB or CRPT data was changed.

## 2026-08-12 - Mass Chestny Znak file workflow

NimbaOS tracks KIZ circulation locally through lifecycle events and compliance tasks; it does not currently read the authoritative live status from Chestny Znak. To make Stage 1 operational at volume, withdrawal and return-to-circulation are now separate XLSX exports, and each generated file is a tracked batch. Download changes tasks to `EXPORTED` only. After CRPT accepts the document, one batch confirmation changes all relevant tasks and KIZ states and records the shared document number/date. Single-KIZ confirmation remains only for exceptions.

The CRPT upload file contains one `Код маркировки` column on the first sheet. Codes use the identification part `01 + GTIN + 21 + serial`; the verification key and crypto signature are omitted. No live WB/CRPT call or data mutation was made during implementation and verification.

## 2026-08-12 - FBS analytics repair and KIZ withdrawal timing

### Problem and evidence
`/fbs` showed zero after applying a period. A bounded local-DB audit found non-zero FBS activity, but `deliveryMethod=FBS` appeared mainly on logistics rows with `quantity=0`; connected sale/return rows had an empty delivery method. The reliable local identity is `realization_reports.orderId -> fbs_orders.externalOrderId`.

### Corrected metrics
For 2026-08-01 - 2026-08-11, Nimba: 161 orders, 26 cancellations, 52 buyouts, 0 returns, 73,432.86 RUB net revenue and 52,763.15 RUB net transfer. Galioni: 199 orders, 34 cancellations, 33 buyouts, 0 returns, 43,925.11 RUB net revenue and 30,201.17 RUB net transfer. Orders/cancellations are grouped by FBS order creation date; buyouts/returns/revenue/transfer use financial operation date.

### KIZ conclusion
For light-industry distance sales, the official Chestny Znak guidance based on paragraph 76 of PPRF No. 1956 requires submitting withdrawal information no later than three business days after warehouse shipment and no later than actual delivery. Waiting for WB `sold`/buyout is therefore not a compliant default. NimbaOS correctly reserves a code on order, creates the withdrawal task only at handoff, and quarantines a returned unit until return-to-circulation or remarking is confirmed. Sources: `https://markirovka.ru/knowledge/tovarnye-gruppy/legkaya-promishlennost/onlayn-torgovlya-internet-magazin-vyvod-iz-oborota-legprom` and `https://markirovka.ru/knowledge/tovarnye-gruppy/legkaya-promishlennost/vozvrat-v-oborot-legprom`.

### Safety
No WB API call, sync, WB write, migration, historical rewrite or production mutation was performed. Verification used bounded local database reads only.

## 2026-07-30 - Nimba July 28 KIZ recovery and metadata semantics

Nine Nimba `complete/sorted` orders from 2026-07-28 required SGTIN but had no KIZ after successful jobs. The jobs covered the date; two stale workers were executing code loaded before automatic ingestion. A bounded repair created/assigned all 9 codes, and a queued job through the restarted worker confirmed 9 already assigned with no duplicate, reject, conflict or GTIN mismatch.

`Метаданные: Заблокировано` was not evidence that WB withheld the codes. The UI incorrectly treated `IN_CIRCULATION` as the only ready state, while handed-over units correctly move to `WITHDRAWAL_REQUIRED`. WB metadata and Chestny Znak circulation are now displayed as separate concepts; all 9 repaired orders show `Метаданные WB: Получены`.

## 2026-07-30 - WB API as the FBS order-to-KIZ source

### Question
Can WB API identify the exact KIZ attached to each physical FBS unit/order after fulfillment packs and ships it?

### Evidence
Official FBS metadata documentation returns `orders[].id` together with `meta.sgtin.value[]` and explicitly says an uploaded marking code can be retrieved through the metadata method. A bounded live read through the existing wrapper checked 24 latest local orders across two cabinets: 20 had a non-empty SGTIN array. No raw marking code was printed or logged.

### Conclusion
Yes, provided fulfillment scans/attaches the code in WB. Physically applying a label without entering it in WB does not make the code discoverable. The WB metadata endpoint is the preferred operational source for the post-packing order-to-KIZ mapping; the delayed Finance report `orderId + kiz` can be a reconciliation fallback.

### Implementation result
NimbaOS now extracts the SGTIN before sanitization, securely registers/assigns the KIZ, and keeps only redacted metadata JSON. A bounded two-cabinet run created/assigned 20 encrypted units with no reject, conflict or GTIN mismatch; a second identical run created zero duplicates. The same run created 20 remote-sale withdrawal tasks at handoff. PDF decoding remains optional for tracking the unused code pool before packing.

## 2026-07-30 - Practical FBS KIZ workflow with outsourced fulfillment

### Question
How should KIZ accounting work when the seller sends Chestny Znak PDFs and fulfillment staff print, apply and ship the labels?

### Findings
NimbaOS currently accepts a full DataMatrix manually or from XLSX, not directly from PDF. A PDF batch alone identifies available labels but does not prove which serialized code was placed on the unit for a particular WB order. Reliable lifecycle accounting therefore requires fulfillment to capture and return the exact `WB order ↔ DataMatrix` mapping.

### Recommendations
Add a secure local PDF decoder only after testing a representative source PDF. Operationally, give fulfillment a minimal phone/USB-scanner screen: open the WB order, scan the applied KIZ, validate its GTIN/article and assign it. The seller then processes the Chestny Znak remote-sale withdrawal task; a pre-handoff cancellation releases the code, while a physically returned code withdrawn earlier stays quarantined until return to circulation is confirmed.

### Follow-up
Obtain one representative PDF with sensitive values redacted only if the DataMatrix remains decodable, decide whether fulfillment can use a phone camera, and define who confirms Chestny Znak documents. Direct True API remains a separate stage.

## 2026-07-25 - Both-cabinet stock and August-September supply plan

### Question
Проанализировать заказы 2026-06-15 - 2026-07-19 и свежие текущие остатки обоих кабинетов, полностью исключив Электросталь, Краснодар, Невинномысск, СПБ/СЦ Шушары и Котовск; дать простой размерный план поставки на август-сентябрь с целью закончить сезон почти без остатка.

### Data Used
Только локальная PostgreSQL NimbaOS. Заказы взяты из ограниченного диапазона `wb_orders`; нетто-выкупы и размерный след детских товаров Nimba — из `realization_reports`; остатки — из последних `stock_snapshots`/`stock_items` с привязкой к `warehouses` и `product_sizes`. WB API и sync не вызывались, данные WB/БД не изменялись. Воспроизводимый запрос: `scripts/stock-supply-analysis.sql`. Итог: `outputs/wb_supply_2026-07-25/Рекомендации_по_поставке_август-сентябрь_2026.xlsx`.

### Freshness Check
`REPORTS_PERIOD` покрыт за 2026-06-15 - 2026-07-19 по обоим кабинетам; фактические диапазоны `wb_orders` и финансовых строк совпадают с периодом. Снимки остатков: Nimba 2026-07-25 00:03 МСК, Galioni 2026-07-25 00:18 МСК. Входящие/возвратные количества в пути исключены. Учитываемый остаток + исключенный остаток полностью сверяется с общим `quantity`; отрицательных остатков и дублированных SKU-ключей не обнаружено.

### Findings
Nimba: 2,523 заказа, 837 отмен (33.2%), 1,399 нетто-выкупов. Из 2,787 шт общего остатка в расчет вошло 896 шт, а 1,891 шт на проблемных складах признаны нулем. Умеренный сезонный сценарий дает 1,108 шт спроса в августе и 647 шт в сентябре; поартикульный дефицит к поставке сейчас — 1,488 шт по 54 строкам.

Galioni: 2,544 заказа, 834 отмены (32.8%), 1,479 нетто-выкупов. Из 1,252 шт общего остатка в расчет вошло 416 шт, а 836 шт исключено. Прогноз: 1,095 шт в августе и 637 шт в сентябре; к поставке сейчас — 1,726 шт по 51 строке.

Для Nimba отдельно показаны только детские размерные позиции (`артикул + размер`); взрослые многомерные товары оставлены на уровне артикула. Размерный финансовый след отличается от точного кабинетного итога `wb_orders` на 1 заказ, что отмечено в книге.

### Recommendations
Использовать колонку `К поставке сейчас` как основной список комплектации; строки уже отсортированы по дефициту. Приоритетные детские размеры Nimba: розовый 134-152 — 63 шт, розовый 112-134 — 45, розовый 152-164 — 45, розовый 92-110 — 34, голубой 152-164 — 28, голубой 134-152 — 21, белый 134-152 — 10, белый 152-164 — 3. Перед физической отгрузкой повторно проверить остатки и учесть внешние/производственные партии.

### Method Caveat
База спроса: 40% среднего нетто-выкупа за весь период + 60% темпа 2026-07-01 - 2026-07-19. Для оставшихся дней июля применено 90%, для августа 75%, для сентября 45%. Это умеренный сценарий снижения после летнего пика, а не прямое продолжение июльской скорости. Излишек одного артикула/размера не компенсирует дефицит другого.

## 2026-07-21 - Both-cabinet sales, stock and supply Excel, 2026-05-01 - 2026-07-19

### Question
Create a polished Excel analytical report for both WB cabinets covering 2026-05-01 - 2026-07-19: orders, sales, cancellations, returns, current total stock across all warehouses excluding in-way quantities, separate cabinet analysis, best/worst articles, a second-half-June and July focus, and a cabinet comparison. Split only WB Nimba child products by `article + size`.

### Data Used
Local NimbaOS DB only. Financial metrics and article rows use `calculateReport`; orders use bounded `wb_orders`; current stock uses the latest total-warehouse stock service. No WB API call, sync, historical rewrite or WB-side change was performed. Workbook: `outputs/wb_analytics_2026-07-21/WB_аналитика_01.05.2026-19.07.2026.xlsx`.

### Freshness Check
`REPORTS_PERIOD` is covered through 2026-07-19 for both cabinets. Financial rows and `wb_orders` span 2026-05-01 - 2026-07-19. Latest stock snapshots: Nimba 2026-07-21 06:51 UTC; Galioni 2026-07-21 07:04 UTC. `wb_sales` is incomplete (Nimba only through 2026-05-25; Galioni through 2026-05-06), so it was not used for sales/returns. All detailed sales/OP/stock totals were reconciled to cabinet summaries; workbook formula scan found no errors and every sheet was rendered for visual QA.

### Findings
Full period: Nimba had 3,566 orders, 1,980 net sold units, 2,730,399.55 rub sales, 234,218.42 rub OP, 8.6% margin and 1,200 sellable units. Galioni had 3,650 orders, 2,059 net sold units, 2,616,749.06 rub sales, 74,489.45 rub OP, 2.9% margin and 528 sellable units. Galioni led unit volume, but Nimba led sales rubles, OP and margin.

Second-half June favored Galioni volume: 32.73 net units/day and 40,905.29 rub/day versus Nimba 24.60 and 36,290.93. Nimba still led OP/day: 2,283.27 rub vs 1,654.96. In July, Nimba moved ahead: 52.79 net units/day, 61,055.71 rub/day, 3,939.14 rub OP/day and 27.7% order cancellation rate versus Galioni 50.42, 56,996.37, 1,630.89 and 29.8%.

Nimba July volume leaders include `крем`, `туника/черный/лист`, `парео квадр/черный шиф`, `парео/хлопок/желтый` and `парео оранж`; several high-volume rows are loss-making, especially `туника/черный/лист` (-6,240.05 rub OP) and `парео/хлопок/желтый` (-3,922.29). Galioni volume leaders include `парео зеленый`, `парео черный шифон` and `парео синий шиф/квадр`; major July losses include `жираф длин бел/черн` (-4,397.40 rub) and `парео малина` (-3,363.89).

Nimba child size supply signals: pink 152-164 has 0 stock with about 1.03 recent net units/day; pink 134-152 has 1 unit and about 0.8 days coverage; pink 112-134 has 8 units and about 7.8 days; pink 92-110 has 1 unit and about 1.4 days; blue 152-164 has 2 units and about 3.4 days; blue 134-152 has 13 units and about 18.4 days. White 134-152 and 152-164 also have zero sellable stock but lower recent pace. In-way quantities are not included.

### Recommendations
Plan replenishment from the size/article priority tables, not from parent cards. Prioritize profitable zero/low-stock rows with sustained recent demand; treat high-volume negative-OP rows as review items rather than automatic replenishment. Recheck the stock snapshot immediately before shipment and add external/in-production stock. Do not change WB prices, cards, advertising or stocks without separate confirmation.

### Method Caveat
Ordinary article order/cancellation counts come from `wb_orders`. Nimba child size rows use the financial-report trace because `wb_orders` has no size/barcode. Three technical reconciliation rows preserve parent-versus-size financial expenses so detailed Nimba totals exactly match the cabinet summary; they are excluded from leader/risk/supply rankings.

## 2026-06-28 - WB Unit 3.0 price/SPP refresh

### Question
Update Google Sheet `WB Unit 3.0` for tabs `UNIT WB Nimba (WB_1)` and `UNIT WB Galioni (WB_2)`: base price, discount, estimated SPP, and add all DB products with costPrice > 50 RUB.

### Data Used
Local NimbaOS DB after standard product/price sync for both accounts. SPP estimate used average buyer price from local `realization_reports` for the latest available 14-day window ending 2026-06-27, with 30-day fallback and product price API fallback. No WB-side prices/cards/ads/stocks were changed.

### Result
Updated existing rows, refreshed current cost prices where they differed, renamed current Galioni article names where WB vendorCode changed, added 10 Nimba rows and 9 Galioni rows while copying existing row formulas/formatting. Verified by Google Sheets readback.

## 2026-06-28 - Morning WB Google Sheet update through 2026-06-26

### Question
Update Google Sheet `Утренний отчет WB` for both cabinets: remove `ROMI`, add bought units and net profit per unit, add `Итого с начала года`, and fill data through 2026-06-26 without running the workflow.

### Data Used
Local NimbaOS DB only via `getMorningReportData`/financial report services. No WB API calls, no sync services, no WB-side changes, and the morning workflow itself was not enqueued.

### Freshness Check
The one-off fill used local data for daily rows 2026-06-01 - 2026-06-26 and YTD totals 2026-01-01 - 2026-06-26 for `WB Nimba (WB_1)` and `WB Galioni (WB_2)`.

### Result
Updated tabs `WB Nimba` and `WB Galioni`: `Выкупили, шт` is right of `Выкупили, руб`, `ЧП на 1 ед` is right of `ЧП`, `ROMI` is removed, row 34 is `Итого с начала года`, plan/fact/progress rows are shifted down, and charts are anchored below the progress block. Verified by Google Sheets readback.

### Follow-up
After 2026-06-27 was synchronized locally, a manual automation run exposed an overly strict full-year advertising coverage check. The workflow was adjusted to require YTD report coverage from 2026-01-01 and advertising coverage for the current month window. A direct verification run updated both tabs through 2026-06-27.

## 2026-06-27 - WB Nimba cancellation/product loss diagnosis, 2026-06-22 - 2026-06-25

### Question
Самостоятельно разобрать причины отмен `WB Nimba (WB_1)` за 2026-06-22 - 2026-06-25: какие товары/размеры создают плохие заказы, просадку выкупа и потери.

### Data Used
Local NimbaOS DB only. Used `calculateReport` with persisted ad stats, local `wb_orders`, `ad_campaign_nm_stats`, latest stock rows and product metadata. No WB API calls, sync or WB-side changes. Added reproducible script `scripts/analyze-nimba-cancellations.ts`. Output workbook: `output/excel/wb_nimba_cancellations_2026-06-22_2026-06-25.xlsx`.

### Findings
Problem categories: `Парео` had 60 financial cancellations across problematic rows and negative OP (-2,216.08 rub); `Туники` had 44 financial cancellations but remained slightly profitable (+2,513.71 rub) due to strong child tunic rows. Biggest cancellation/problem rows: `туника/детск/голубой 152-164` (7 cancellations, buyout 22.22%, OP -395.52), `парео зеленый` (6 cancellations, 0 sales, OP -1,237.88), `парео малиновый` (6 cancellations, buyout 50%), `парео/хлопок/белый` (5 cancellations, OP -175.50), `туника/детская/розовый 134-152` and `112-134` (5 cancellations each, low buyout). Main advertising loss row: `туника с поясом леопард пятна` spent 2,017.93 rub, had 9,793 views / 410 clicks, only 1 ad order, 0 sales, OP -2,473.41.

### Recommendations
Do not raise total Nimba ad budget until poor rows are excluded. First restrict/stop `туника с поясом леопард пятна` in ads and audit campaign `Кампания от 03.06.2026`. Remove or downrank products with cancellations but no sales (`парео зеленый`, `парео/хлопок/зеленый`) from promotion. Push budget only to rows with confirmed sales, positive OP and buyout at least 55-60%, after checking size-level stock.

## 2026-06-26 - WB Galioni vs WB Nimba factor analysis, 2026-06-22 - 2026-06-25

### Question
Проанализировать оба кабинета полностью за 2026-06-22 - 2026-06-25 и объяснить, почему `WB Galioni (WB_2)` продает больше и имеет выше маржинальность. Отдельно разобрать рекламу и все доступные факторы, подготовить Excel и письменные выводы.

### Data Used
Локальная БД NimbaOS only. Финансы считались через `calculateReport` с persisted ad stats (`preferLiveAdCostTotals=false`), плюс ограниченные чтения по локальным таблицам заказов, рекламных кампаний/stat/nm-stat, остатков, отзывов и вопросов. WB API напрямую не вызывался, sync не запускался, цены/карточки/реклама/остатки не менялись. Добавлен воспроизводимый скрипт `scripts/generate-cabinet-factor-report.ts`. Output workbook: `output/excel/wb_cabinet_factor_analysis_2026-06-22_2026-06-25.xlsx`.

### Freshness Check
`REPORTS_PERIOD` covered for both cabinets through 2026-06-25. `ADVERTISING_STATS` covered for both cabinets for the requested range. Latest stock snapshots were 2026-06-26 (`WB Galioni` 12:36 UTC, `WB Nimba` 12:22 UTC). Reviews/questions refresh covered the range. `SALES_PLAN_PERIOD`, `wb_sales`, and `wb_funnel_stats` were not covered/empty for this period, so funnel and sales-plan conclusions are not used as primary evidence.

### Findings
`WB Galioni`: sales 163,996.39 rub, ordered 287,284.95 rub, OP 11,148.30 rub, margin 6.80%, 130 bought-with-returns units, buyout 59.91%, ad spend 2,747.02 rub, DRR 1.68%, logistics 19.13% of sales, storage 0.90%.

`WB Nimba`: sales 112,431.20 rub, ordered 265,600.00 rub, OP 751.48 rub, margin 0.67%, 72 bought-with-returns units, buyout 40.22%, ad spend 2,892.56 rub, DRR 2.57%, logistics 28.50% of sales, storage 2.83%.

Galioni did not win by higher price: Nimba average price was higher (1,567.68 rub vs 1,277.92 rub). Galioni won through volume and cleaner economics: 1.81x more bought units, +19.69 pp buyout, much lower logistics/storage/commission burden, and better ad conversion. Nimba's orders were close to Galioni in rubles, but many did not convert into profitable sales: 105 cancellations and only 40.22% buyout.

Category mix: Galioni is almost entirely `Парео` with positive OP (160,937.28 rub sales / 11,433.18 rub OP / 7.10% margin). Nimba `Парео` was negative (59,660.67 rub sales / -2,060.87 rub OP / -3.45% margin), while `Туники` partially saved the period (51,206.47 rub sales / 2,513.71 rub OP / 4.91% margin).

Advertising: Galioni spent slightly less than Nimba but got stronger ad result. Galioni ad stats: 2,747.02 rub spend, 31 ad orders, 56,772 rub ad order sum. Nimba ad stats: 2,892.56 rub spend, 7 ad orders, 13,793 rub ad order sum. Nimba campaign `Кампания от 03.06.2026` spent 2,018.35 rub for only 3 ad orders / 6,661 rub order sum, while Galioni campaign `Кампания от 05.05.2026` spent 842.48 rub for 18 ad orders / 32,896 rub order sum.

Stocks: Galioni latest stock 1,784 units / 1,179,943 rub cost value; Nimba 3,768 units / 2,466,276 rub cost value. Nimba has heavier overstock/no-sales pressure (35 overstock SKU and 12 with stock/no sales), increasing storage drag and reducing operational flexibility.

### Recommendations
Do not increase Nimba ad budgets until the two active campaigns are audited by campaign/article: current spend is not the bottleneck; conversion and post-order economics are. First investigate Nimba cancellation/buyout causes by top loss articles, especially `туника с поясом леопард пятна`, `парео зеленый`, `парео/хлопок/зеленый`, and low-buyout size rows. For Nimba, protect and replenish only profitable tunic size rows after fresh size stock check; reduce pressure on loss-making pareo/zero-sale stock through pricing/card/ad review only after owner confirmation. For Galioni, keep supporting profitable pareo winners but watch stockouts on top sellers with zero/low stock.

### Follow-up
If card conversion/funnel needs to be quantified, first run/confirm local `SALES_PLAN_PERIOD`/funnel coverage for 2026-06-22 - 2026-06-25, then regenerate the workbook. Any WB-side price, card, bid, budget or stock action requires explicit confirmation.

## 2026-06-19 - WB Unit 3.0 price/discount/SPP refresh

### Question
Update Google Sheets file `WB Unit 3.0`, tabs `UNIT WB Nimba (WB_1)` and `UNIT WB Galioni (WB_2)`, with current base prices, seller discounts, and estimated SPP values. Then report margin for current demping candidates, excluding new `poyas`/belt articles.

### Data Used
Local NimbaOS DB only for current `products/product_sizes` prices and discounts. SPP was estimated from buyer average price in local financial rows for 2026-06-01 - 2026-06-14, with fallback to current product-size SPP price when period sales were absent. Google Sheets file updated directly through the Google Drive connector; no WB API calls, no WB-side price/card changes, no DB writes.

### Result
Updated 62 rows on `UNIT WB Nimba (WB_1)` and 54 rows on `UNIT WB Galioni (WB_2)`, writing only manual columns `Base price before discount`, `Seller discount %`, and `Current SPP %`. Formula columns were left intact and verified by readback on control rows.

## 2026-06-19 - Article profitability Excel with loss comparison, 2026-06-01 - 2026-06-14

### Question
Prepare the same styled two-cabinet Excel profitability report for 2026-06-01 - 2026-06-14, using the previous formatted workbook as the template. Remove the `Sold before returns` column, add total stock, and add two comparison sheets: one following the user-provided `loss_items` workbook articles/prices, and one Codex-selected comparison for WB Nimba articles with zero or negative margin against logical WB Galioni analogs.

### Data Used
Local NimbaOS DB only, through existing report calculation and latest stock snapshot tables. No WB API calls, sync, code changes, DB writes, price/card/advertising changes, or historical resyncs. Output workbook: `output/excel/wb_article_profitability_2026-06-01_2026-06-14.xlsx`.

### Findings
`WB Galioni`: sales 348,118.03 rub, OP 32,074.11 rub, 45 sold rows, 23 no-sale rows. `WB Nimba`: sales 421,837.80 rub, OP 53,037.91 rub, 56 sold rows, 77 no-sale rows. Added `Stock` in place of `Sold before returns`, preserved formatted sheets, added `Comparison like yours` with 18 rows and `Codex comparison` with 16 rows. Workbook checks: no `???` factor text and no old `Sold before returns` header.

## 2026-06-18 - Article profitability Excel for both WB cabinets, 2026-01-01 - 2026-06-17

### Question
Подготовить Excel-отчет по обоим кабинетам WB на разных листах: какие артикулы принесли больше всего денег по ОП и выручке, сколько было выкупов, выкупаемость и ключевые метрики. Для `WB Nimba (WB_1)` размерные товары показывать отдельными строками `артикул + размер`; отдельно вывести товары без продаж.

### Data Used
Локальная БД NimbaOS, без WB API, без синхронизаций и без изменений БД/кода. Финансовые метрики рассчитаны через `calculateReport` с локальными persisted ad stats. Excel сохранен в `output/excel/wb_article_profitability_2026-01-01_2026-06-17.xlsx`.

### Freshness Check
`REPORTS_PERIOD` полностью покрыт за 2026-01-01 - 2026-06-17 по `WB Galioni (WB_2)` и `WB Nimba (WB_1)`. Фактические `realization_reports` есть с 2026-01-01 по 2026-06-17. `ADVERTISING_STATS` не покрывает весь январь-июнь, поэтому ДРР/рекламное влияние в отчете рассчитаны только по имеющимся локальным рекламным данным.

### Findings
2026-06-19 regenerated file after dated article versions were implemented. Current totals supersede the earlier rows below: Galioni sales 2,157,583.34 rub / OP 185,410.06 rub / 56 sold rows / 11 no-sale rows; Nimba sales 2,913,759.88 rub / OP 398,842.06 rub / 72 sold rows / 60 no-sale rows.
`WB Galioni (WB_2)`: выручка 2 157 583,34 руб., ОП 283 987,06 руб., 53 продававшихся строки, 11 строк без продаж.

`WB Nimba (WB_1)`: выручка 2 913 759,88 руб., ОП 398 842,06 руб., 70 продававшихся строк с размерной детализацией для Nimba, 61 строка без продаж.

### Follow-up
Если нужны выводы по рекламе за весь период, сначала проверить/досинхронизировать `ADVERTISING_STATS` за январь-март штатным sync-сервисом с подтверждением пользователя, затем пересобрать отчет.

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

## 2026-08-14 — PDF delivery of the WB Nimba margin recovery plan

### Result
Создан PDF с тем же содержанием и визуальным оформлением, что у проверенного HTML-отчёта: `output/pdf/WB_Nimba_план_восстановления_маржи_01-12_августа_2026.pdf`. Формат A4 landscape, 6 страниц. Цвета, карточки, график, таблица и типографика сохранены; служебные браузерные колонтитулы удалены.

### Validation
Все 6 страниц отрисованы через Poppler и визуально проверены. Нет обрезанного текста, наложений, сломанных таблиц и служебного пути `file:///...`. Ключевые разделы подтверждены извлечением текста. Аналитические данные и состояние WB не менялись.

## 2026-08-13 — WB Nimba margin recovery plan for 1-12 August

### Question
Что делать после резкого роста комиссии и падения маржинальности WB Nimba; могло ли снижение СПП быть причиной и какие конкретные артикулы нужно менять первыми.

### Data Used
Локальная БД NimbaOS: `calculateReport` за 2026-08-01 - 2026-08-12 и июльский контроль 2026-07-01 - 2026-07-12, ограниченная детализация `realization_reports`, локальная рекламная статистика. Финансовое и рекламное покрытие полное; 3 450 проверенных августовских `rrdId` уникальны. WB API и синхронизация не запускались. Расчёт сохранён в `output/analysis/nimba_margin_response_2026-08-01_12.json`; визуально проверенный самодостаточный отчёт — `output/reports/nimba_margin_recovery_august_2026/nimba_margin_recovery_august_2026.html`.

### Findings
Продажи 436 790,79 руб., ОП -17 149,00 руб., маржа -3,93%, комиссия 70 216,60 руб. (11,19% от базы до платформенной скидки). Реклама 0,49 руб. при полном покрытии и не объясняет убыток. При применении к августовской базе июльской эффективной комиссии 0,97% расчётная ОП составила бы +46 966,23 руб. и маржа 10,75%. Значит, переход в минус связан прежде всего с условиями КВВ/СПП: в предыдущем разложении рост КВВ объяснил около 62% расширения разрыва, снижение СПП — около 38%.

Из 64 релевантных строк 50 отрицательные: общий убыток -38 795,66 руб.; 10 крупнейших дают 57,08% потерь. 17 отрицательных SKU имеют статический порог безубыточности до +15% средней реализованной цены, 9 — от 15% до 25%, 14 — выше 25%, ещё 10 имеют расходы без продаж. 11 SKU уже дают маржу выше 5%, ещё 3 находятся в диапазоне 0-5%.

### Recommendations
Не делать общее повышение цены. После подтверждения владельца: временно ограничить 14 SKU с порогом выше 25%, если это не осознанная ликвидация; на 17 SKU с порогом до 15% начать ступенчатый тест +7-10% к цене продавца / уменьшения скидки продавца; прибыльные карточки не трогать. Через три полных дня пересчитать среднюю реализованную цену, заказы, выкуп, КВВ, СПП, комиссию и ОП по SKU. Параллельно проверить категорийный тариф, «Конструктор тарифов», уровень продавца и новости WB. Статический порог по кабинету: +5,6% для нулевой маржи и +12,8% для около 5%, но он не учитывает эластичность спроса и изменение СПП.

### Follow-up
После явного подтверждения пользователя подготовить точный список изменения цен/скидок для первой волны и контрольную таблицу на три дня. До подтверждения не менять цены, акции, рекламу, карточки и остатки WB.

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

## 2026-07-30 — FBS operating model and KIZ lifecycle

### Question
Как отдельно вести FBS-остатки, заказы, продажи, аналитику и КИЗ на всех этапах, включая отмены и возвраты?

### Data Used
Project architecture/schema and official WB endpoint contracts reviewed during planning. No live cabinet data, WB write or historical sync was used in implementation. The schema migration was applied later only to the local development database while resolving BUG-019.

### Freshness Check
Not applicable until rollout. The initial permitted history is fixed to `2026-07-20` - `2026-07-30`; its dry-run/execute script exists but was not run.

### Findings
FBS needs a separate seller-stock ledger and serialized KIZ lifecycle. Reservation must not reduce physical stock; pre-handoff cancellation releases both reserve and assignment; sold marked units create withdrawal tasks; post-handoff returns stay unavailable until physical inspection and, after withdrawal, return to circulation.

### Recommendations
Roll out in one controlled Stage 1: migrate, smoke-test read-only sync, run the bounded backfill, reconcile opening balances, then enable intervals selectively. Keep all WB write gates off until a separate owner-approved live write test. Configure owners/SLA for the manual Chestny Znak queue.

### Follow-up
Stage 2 direct True API requires separate credentials, certificate/signature and document-flow decisions.
## 2026-08-13 - Corrected Galioni withdrawal workbooks

Compared both historical Galioni export batches with the reconciled local compliance queue. The 2026-07-30 batch contains 11 still-required withdrawals and 5 canceled tasks; the 2026-08-12 batch contains 173 still-required withdrawals and 6 canceled tasks. Generated separate corrected copies with all 11 canceled rows removed, preserved numeric unit prices (VAT 0%), and verified 184 unique KIZs with no overlap across the two files.
