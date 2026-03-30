# CLAUDE.md

> Детали архитектуры и API — в [SPECIFICATION.md](SPECIFICATION.md)
> История решений — в [docs/DECISIONS.md](docs/DECISIONS.md)

## Проект

**NimbaOS** — закрытая веб-платформа оцифровки кабинетов продавца на Wildberries.
Последнее обновление: **2026-03-30** | Текущая задача: **Фаза 7 (рекламные кампании) — ◑ реализована, нужна живая верификация и полировка**

## Стек

Node.js 22 · Next.js 14 App Router · TypeScript strict · PostgreSQL 16 + Prisma 7 ·
Redis + Bull MQ · Tailwind CSS v4 + shadcn/ui · NextAuth.js · Docker Compose

## Фазы

| Фаза | Статус | Описание |
|------|--------|----------|
| 0 | ✅ | Инициализация: Next.js, Tailwind v4, shadcn/ui, Docker, Prisma schema (все 16 моделей) |
| 1 | ✅ | Auth: NextAuth Credentials, роли, приглашения, dashboard layout, /admin/users |
| 2 | ✅ | Настройки: кабинеты WB, AES-256 шифрование, WB API клиент, AccountSelector |
| 3 | ✅ | Карточки: синхронизация WB, таблица, поиск/фильтры/сортировка, редактирование цен |
| 4 | ✅ | Справочники: себестоимость, самовыкупы, внешняя реклама, переименования |
| **5** | **✅** | **Финансовые отчёты** — UI, формулы, сортировка, DnD колонок, фильтры, группировка; Storage API (paid-storage per-article) |
| **6** | **✅** | **План продаж** — CRUD, UI списка/детализации, WB Orders/Sales/Funnel API, daily grid, Excel-экспорт |
| 7 | ◑ | Рекламные кампании: базовая реализация готова, нужна живая проверка и добивка паузы |
| 8 | — | Фоновая синхронизация (Bull MQ) |
| 9 | — | Финальная доработка (Excel, responsive, Docker prod) |

## Фаза 5 — Финансовые отчёты (✅ завершена, точечные доработки позже)

### Что сделано:
- `src/types/reports.ts` — типы
- `src/lib/wb-api/reports.ts` — WB API fetch (rrdid-пагинация)
- `src/lib/services/sync-reports.ts` — sync → DB
- `src/lib/services/report-calculator.ts` — 52 формулы + vendorCode fallback из Products
- `src/lib/actions/reports.ts` — Server Actions (sync, getReportData, exportXlsx)
- `src/app/(dashboard)/reports/columns.tsx` — 52 колонки, 9 групп, тултипы, ширины
- `src/app/(dashboard)/reports/report-table.tsx` — frozen cols, ресайз, сортировка, DnD колонок, sticky Итого, localStorage порядок
- `src/app/(dashboard)/reports/reports-client.tsx` — DateRangePicker, sync, export Excel, фильтры (Бренд/Категория/Ярлык), группировка
- `src/app/(dashboard)/reports/page.tsx` — Server Component
- `src/components/date-range-picker.tsx` — пресеты, 2 месяца, кнопка «Применить»
- `scripts/debug-report.ts` — debug-check для сверки ppvzForPay

### Ключевые факты о данных WB API:
- `reportDetailByPeriod` возвращает **пустой `vendor_code`** для всех строк (баг WB API)
- Фикс: `report-calculator.ts` строит `nmVendorMap` из таблицы `Products` (Phase 3) и использует как fallback
- `ppvzForPay` для Возврат строк приходит **положительным** (как и для Продаж); формула `salesForPay - returnsForPay` верна
- `toTransfer` (К перечислению) для WB Galioni 16-22.02.2026: 83 991.92 ₽ ✓
- `sale` = `Σ retailPriceWithDisc × (1−sppPrc/100)` (с учётом WB СПП) — расчёт выручки по цене покупателя
- `delivered` = salesCount + cancellationsCount (отправлено к покупателю: продажи + отмены)
- **Хранение**: WB возвращает storage строки с `nmId=0` (не по артикулам). Распределяется пропорционально outbound-доставкам по артикулу.
- **Отмены**: `bonusTypeName = 'К клиенту при отмене'` в Логистика-строках — уже в БД, считаем как `cancellationsCount`
- **Маржинальность** = ОП / Продажи × 100 (не (продажа - себест.) / продажа)
- **% от ОП** = ОП_артикула × 100 / ОП_всего
- **Выкуп %** = boughtWithReturns × 100 / (salesCount + cancellationsCount)
- Итоговый расчёт summary: reference-based поля (costPrice, extAd, selfPurchase) агрегируются из per-item rows

### Хранение по артикулам — реализовано (Фаза 5.x):
- Используется **корректный task-based flow WB Seller Analytics API**:
  - `POST /api/v1/paid_storage`
  - `GET /api/v1/paid_storage/tasks/{task_id}/status`
  - `GET /api/v1/paid_storage/tasks/{task_id}/download`
- Синхронизация хранения вынесена в `src/lib/wb-api/paid-storage.ts` и `src/lib/services/sync-paid-storage.ts`
- Период режется на чанки до 8 дней, каждая задача дожидается статуса `done`, затем данные скачиваются и сохраняются в `paid_storage`
- Новая модель Prisma: `PaidStorage` (таблица `paid_storage`, unique: `[wbAccountId, date, nmId, chrtId]`)
- В отчёте используется **фактическое поартикульное хранение из WB**, а не распределение по строкам с `nmId=0`
- В отчёт попадают также артикулы без продаж/возвратов, если по ним есть хранение или другие начисления/списания
- `syncReportsAction` запускает оба синка последовательно: realization → paid-storage

### Формулы (исправленные):
- **Налоги** = Продажи × ставка/100 (УСН доходы, ставка из настроек кабинета)
- **Лог. ед.** = Логистика / Выкуплено (boughtWithReturns = продажи − возвраты)

### Заглушки (следующие фазы):
- Col 15-16 (Реклама) = 0 → Фаза 7
- Col 51 (Ярлыки) = "" → Product.tags

### Финальный итог сессии 2026-03-27

#### 1. Что сделано
- Фаза 5 по финансовым отчётам доведена до завершения.
- Исправлена выгрузка платного хранения на документированный WB flow `create task -> status -> download`.
- Добавлена отдельная синхронизация `paid_storage` с сохранением по `date + nmId + chrtId`.
- Пересобран расчёт отчёта так, чтобы в него попадали артикулы без продаж, но с хранением или другими начислениями/списаниями.
- Итоговая строка и групповые итоги переведены на суммирование уже рассчитанных строк отчёта.
- Исправлены сравнения WB-типов операций, из-за которых часть колонок могла уходить в нули.
- Доработаны формулы и защиты от некорректных значений:
  - `avgPrice = 0`, если продаж/выкупов нет.
  - `buyoutPercent`, `logisticsFromSalesPercent`, `storageFromSalesPercent` не могут быть отрицательными.
  - `marginality = 0`, если и `operatingProfit`, и `sale` одновременно отрицательные.
  - `commission` и `acquiringFee` считаются как нетто: `sale - return`.
- Исправлен отбор данных для произвольных периодов: отчёт теперь читается по `rrDt` как по фактической дате операции.
- Проведена ручная сверка календарных диапазонов против прямого ответа WB API: лишних недельных дней в расчётах нет.

#### 2. Что работает
- Синхронизация отчётов WB (`reportDetailByPeriod`) и синхронизация платного хранения.
- Поартикульное хранение в таблице и попадание storage-only артикулов в отчёт.
- Фильтры, группировка, sticky `Итого`, DnD колонок и Excel-экспорт.
- Общий итог и групповые итоги считаются из тех же строк, которые отображаются в таблице.
- Формулы для `Продажа`, `К перечислению`, `Комиссия`, `Эквайринг`, `Цена ср.`, `Выкуп %`, `Маржинальность`, `Лог. от продаж %`, `Хранение %` и связанных итогов сведены к корректному поведению.
- Календарные диапазоны считаются по дням операций, а не по недельным границам WB-выгрузки.
- Фаза 5 на текущий момент считается завершённой.

#### 3. Что осталось доделать
- Перейти к Фазе 6: план продаж.
- При необходимости позже можно вернуться к редким, новым или слабо документированным WB-операциям, если они появятся на живых данных.
- При желании можно вынести отдельно «нераспределённые» расходы, если понадобится показывать их вне строк артикулов.

#### 4. Известные баги
- На момент завершения Фазы 5 подтверждённых багов нет.
- Если `nmId` есть в `paid_storage`, но карточки нет в `products`, строка отчёта появится, но часть справочных полей может быть пустой.
- После изменения Prisma schema IDE иногда держит старый кэш типов; помогает `npx prisma generate` и `TypeScript: Restart TS Server`.

---

### Итог сессии 2026-03-29 — UX-улучшения: себестоимость и артикулы ВБ

#### 1. Что сделано

**Справочник «Себестоимость» — полный редизайн (`cost-price-tab.tsx`):**
- Все товары кабинета отображаются сразу, даже без заданной себестоимости (ранее нужно было добавлять каждый артикул отдельно)
- Инлайн-редактирование: поле ввода прямо в строке, при изменении значения появляется зелёная галочка; подтверждение кликом или Enter
- Поиск по артикулу продавца и по артикулу ВБ (клиентский фильтр в реальном времени)
- Новые столбцы: «Артикул ВБ» (ссылка + фото-тултип) и «Категория»
- Сортировка по всем столбцам (клик по заголовку, повторный — меняет направление)
- Экспорт шаблона `.xlsx`: скачивает все артикулы с текущими значениями себестоимости
- Импорт `.xlsx`: читает колонки «Артикул продавца» + «Себестоимость», обновляет через `bulkUpsertCostPrices`
- Увеличен шрифт и padding во всей таблице
- Лимит страницы: 100 артикулов (ранее 20), аналогично обновлено во всех других вкладках справочника

**Новые Server Actions (`src/lib/actions/references.ts`):**
- `getCostPriceItems` — возвращает все продукты кабинета, смёрженные с их себестоимостью (если задана)
- `bulkUpsertCostPrices` — массовый upsert для импорта из Excel
- `exportCostPriceTemplate` — генерирует xlsx с текущими данными (через XLSX server-side)

**Новый тип `CostPriceItem` (`src/types/references.ts`):**
- Объединяет поля из `Product` (nmId, category, photoUrl, title) и `CostPrice` (id, costPrice, updatedAt), где costPrice может быть null

**Артикулы ВБ — кликабельные ссылки с фото:**
- Новый компонент `src/components/wb-article-link.tsx` — ссылка на WB + фото товара при наведении
- Фото рендерится через `createPortal(…, document.body)` с `position: fixed; z-index: 9999` — гарантированно поверх любых sticky-заголовков, overflow-контейнеров и stacking-контекстов таблицы
- Используется в обоих местах: вкладка «Себестоимость» и таблица финансовых отчётов (колонка «Арт. ВБ»)
- `photoUrl` добавлен в `ReportRow` и заполняется в `report-calculator.ts` из таблицы `Products`

#### 2. Что работает
- Все товары кабинета отображаются в себестоимости без предварительного добавления
- Инлайн-редактирование с зелёной галочкой подтверждения
- Поиск, сортировка по всем столбцам
- Экспорт и импорт xlsx-шаблона себестоимости
- Фото-тултип при наведении на артикул ВБ — в себестоимости и в отчётах, всегда поверх контента
- Лимит 100 строк на странице во всех вкладках справочника

#### 3. Что осталось доделать
- Перейти к Фазе 6: план продаж.

#### 4. Известные баги
- Подтверждённых багов нет.

---

## Фаза 6 — План продаж (✅ завершена)

> Детальный план подзадач — в [PHASE6_PLAN.md](PHASE6_PLAN.md)

### Подзадача 1 (✅): Prisma schema + типы + CRUD Server Actions
- Модели `WbOrder`, `WbSale` + relations; `SalesPlan`, `SalesPlanItem` уже были
- `src/types/sales-plan.ts` — WB API types, internal types, sync results, daily metrics
- `src/lib/actions/sales-plan.ts` — 11 Server Actions (CRUD + sync + search)

### Подзадача 2 (✅): UI списка планов + создание плана
- `src/app/(dashboard)/sales-plan/page.tsx` — Server Component: resolve account, fetch plans
- `src/app/(dashboard)/sales-plan/sales-plan-client.tsx` — карточки планов, удаление с подтверждением, пустое состояние
- `src/app/(dashboard)/sales-plan/create-plan-dialog.tsx` — Dialog: название, период (DateRangePicker), ДРР %

### Подзадача 3 (✅): Детализация плана — управление артикулами
- `src/app/(dashboard)/sales-plan/[planId]/page.tsx` — Server Component
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — шапка (inline-edit), таблица артикулов (inline-edit план/цена/выкуп%), сортировка, dropdown «Добавить артикулы» (из остатков / по-отдельности), удаление артикулов
- `src/app/(dashboard)/sales-plan/[planId]/add-article-dialog.tsx` — поиск по nmId/vendorCode, чекбоксы, массовое добавление
- `src/lib/services/spp-calculator.ts` — `getAutoFillByNmId`: средний % выкупа и средняя цена из `RealizationReport` за прошлый месяц (auto-fill при добавлении)

### Подзадача 4a (✅): WB API — заказы и продажи + sync-сервисы
- `src/lib/wb-api/orders.ts` — `fetchOrdersPage` (statistics domain, lastChangeDate пагинация)
- `src/lib/wb-api/sales.ts` — `fetchSalesPage` (аналогично)
- `src/lib/services/sync-orders.ts` — `syncOrders`: decrypt → paginate → createMany skipDuplicates, **инкрементальный синк**
- `src/lib/services/sync-sales.ts` — `syncSales`: аналогично, `isReturn` по `saleID.startsWith('R')`, **инкрементальный синк**
- `syncPlanDataAction` — оркестратор: orders+sales → параллельно с funnel

### Подзадача 4b (✅): WB API — аналитика воронки
- `prisma/schema.prisma` — модель `WbFunnelStat` (unique: `[wbAccountId, nmId, date]`)
- `src/lib/wb-api/analytics.ts` — `fetchFunnelHistory` (analytics domain, батч nmIds по 20)
- `src/lib/services/sync-funnel.ts` — `syncFunnel`: upsert в WbFunnelStat
- `src/types/sales-plan.ts` — WB API типы, `FunnelSyncResult`, расширение `DailyMetrics` и `PlanSyncResult`

### Подзадача 5 (✅): Калькулятор ежедневных метрик
- `src/lib/services/plan-calculator.ts` — `calculatePlanDetail`: 5 параллельных DB-запросов, индексация по `nmId:date`, 10 метрик, Decimal→string
- `src/lib/actions/sales-plan.ts` — `getPlanMetricsAction`

### Подзадача 6 (✅): UI daily grid
- `src/app/(dashboard)/sales-plan/[planId]/article-detail-grid.tsx` — перевёрнутая таблица (метрики × даты), 5 sticky колонок, цветовая индикация
- `src/app/(dashboard)/sales-plan/[planId]/plan-metrics-rows.ts` — 9 метрик с formatters
- `plan-detail-client.tsx` — expand/collapse, кнопки «Получить данные»/«Показать метрики», колонки «Факт»/«%»

### Подзадача 7 (✅): Excel-экспорт + полировка
- `src/lib/actions/sales-plan.ts` — `exportPlanXlsxAction`: 2 листа (Сводка + Детализация), base64
- `plan-detail-client.tsx` — кнопка «Экспорт Excel», пустые состояния

### WB API endpoints для Фазы 6:
- `GET /api/v1/supplier/orders` — statistics domain, пагинация lastChangeDate, стоп на `[]`
- `GET /api/v1/supplier/sales` — statistics domain, аналогичная пагинация
- `POST /api/analytics/v3/sales-funnel/products/history` — analytics domain, воронка по дням

### Итог сессии 2026-03-29 — Фаза 6: подзадачи 2–4a

#### 1. Что сделано
- UI списка планов: карточки с названием, периодом, ДРР, кол-вом артикулов
- Создание плана через диалог (название, описание, DateRangePicker, ДРР %)
- Удаление планов из списка с диалогом подтверждения
- Детализация плана: шапка (inline-edit), таблица артикулов (inline-edit по 3 полям: план шт., цена, выкуп %)
- Добавление артикулов: «Из остатков» (все Products аккаунта) и «По-отдельности» (поиск по nmId/vendorCode)
- Удаление артикулов из плана (иконка корзины)
- Автозаполнение % выкупа и средней цены из RealizationReport за прошлый календарный месяц
- WB API: fetchOrdersPage / fetchSalesPage (statistics domain, lastChangeDate пагинация)
- Sync-сервисы: syncOrders / syncSales → createMany skipDuplicates
- syncPlanDataAction: оркестратор синхронизации (today/full/custom)

#### 2. Что работает
- Полный CRUD планов: создание, просмотр списка, переход в детализацию, удаление
- Управление артикулами: добавление из остатков / поштучно, inline-редактирование, удаление
- Автозаполнение цены и выкупа из данных прошлого месяца при добавлении артикулов
- Навигация: `/sales-plan` → `/sales-plan/[planId]` с `?account=` параметром
- Sync-сервисы для заказов и продаж WB (слой данных готов)

#### 3. Что осталось доделать
- Подзадача 4b: аналитика воронки (WbFunnelStat, sync-funnel)
- Подзадача 5: калькулятор ежедневных метрик
- Подзадача 6: UI daily grid
- Подзадача 7: Excel-экспорт + полировка

#### 4. Известные баги
- Подтверждённых багов нет.

---

### Итог сессии 2026-03-30 (1) — Фаза 6: автозаполнение плана + исправление lastSyncAt

#### 1. Что сделано

**Автозаполнение при добавлении артикулов (`spp-calculator.ts`) — полный пересмотр:**
- **Цена** → `ProductSize.price × (1 − discount/100)`, среднее по размерам — та же цена, что в разделе «Карточки», без СПП
- **Кол-во продаж** → `Σ quantity` строк «Продажа» из `RealizationReport` за прошлый календарный месяц (с OR-фильтром для строк с `rrDt = null`)
- **% выкупа** → формула идентична `report-calculator.ts`: `(salesCount − returnsCount) / (salesCount + cancellationsCount) × 100`, где `cancellationsCount` = строки `supplierOperName='Логистика'` + `bonusTypeName='К клиенту при отмене'`
- Фоллбэк: если за прошлый месяц нет данных по артикулу — берём последние 3 месяца
- Источник данных: `RealizationReport` (тот же, что синхронизируется в разделе «Отчёты»), не `WbSale`

**Новая колонка «Продажи, шт.» в таблице плана:**
- Показывает кол-во продаж (Продажа-строки) за прошлый месяц из `RealizationReport`
- Исправлен источник: был `wbSale.groupBy` (пустая таблица) → стал `realizationReport` с тем же OR-фильтром по дате
- Сортируемая колонка с тултипом о периоде

**Исправление `lastSyncAt` в отчётах:**
- Проблема: `createMany({ skipDuplicates: true })` при повторном синке существующих строк не обновляет `fetchedAt`, поэтому `max(fetchedAt)` показывал старую дату
- Решение: `syncReportsAction` после успешного синка обновляет `WbAccount.lastSyncAt = now()`; `calculateReport` читает `lastSyncAt` из `WbAccount`, а не вычисляет из строк

**Schema (`WbSale.finishedPrice`):**
- Добавлено nullable поле `finishedPrice` — фактическая цена покупателя с учётом СПП
- `sync-sales.ts` теперь сохраняет его при синхронизации

#### 2. Что работает
- Автозаполнение цены, % выкупа и кол-ва продаж при добавлении артикулов в план
- «Продажи, шт.» в таблице плана
- «Последняя синхронизация» корректно обновляется после каждого синка

#### 3. Что осталось доделать
- Подзадачи 4b–7

#### 4. Известные баги
- `WbSale.finishedPrice` у старых строк = NULL (до пересинхронизации)

---

### Итог сессии 2026-03-30 (2) — Фаза 6: подзадачи 4b–7 + оптимизация синхронизации

#### 1. Что сделано

**Подзадача 4b — аналитика воронки:**
- Модель `WbFunnelStat` в Prisma schema (unique: `[wbAccountId, nmId, date]`)
- `fetchFunnelHistory` — WB Analytics API, батч nmIds по 20 штук
- `syncFunnel` — upsert каждой строки day×nmId
- Типы: `WbFunnelHistoryRequest`, `WbFunnelHistoryDay`, `WbFunnelHistoryCard`, `WbFunnelHistoryResponse`, `FunnelSyncResult`
- Интеграция в `syncPlanDataAction`

**Подзадача 5 — калькулятор метрик:**
- `plan-calculator.ts` — 5 параллельных DB-запросов, индексация `nmId:date`, 10 метрик, Decimal→string
- `getPlanMetricsAction` — Server Action для UI

**Подзадача 6 — UI daily grid:**
- `article-detail-grid.tsx` — перевёрнутая таблица: метрики × даты, 5 sticky колонок, цветовая индикация (зелёный/красный/голубой)
- `plan-metrics-rows.ts` — 9 метрик с formatters (rub, number, percent) и summary accessors
- Expand/collapse строк артикулов, колонки «Факт»/«%» при загруженных метриках
- Кнопки «Получить данные» (dropdown: Сегодня/Полная), «Показать метрики» (без синхронизации)

**Подзадача 7 — Excel-экспорт + полировка:**
- `exportPlanXlsxAction` — 2 листа: Сводка (артикулы + план/факт) и Детализация (per-article, 9 метрик × даты)
- Кнопка «Экспорт Excel» с индикатором, пустое состояние
- `stopPropagation` на интерактивных элементах внутри раскрываемых строк

**Оптимизация синхронизации:**
- **Инкрементальный синк** в `syncOrders` и `syncSales`: перед запросом проверяется `MAX(lastChangeDate)` в БД; если данные уже есть, используется `flag=1` (только новые/изменённые записи) вместо `flag=0` (полная выгрузка)
- **Параллельная воронка**: funnel (analytics domain, 20s) запускается параллельно с orders+sales (statistics domain, 60s) через `Promise.all`

#### 2. Что работает
- Полный цикл плана продаж: создание → добавление артикулов → синхронизация → просмотр метрик → экспорт Excel
- Перевёрнутая таблица с ежедневной детализацией (9 метрик × даты), sticky-колонки
- Цветовая индикация план/факт, подсветка сегодняшнего дня
- Аналитика воронки: переходы, корзина, заказы из WB Analytics API
- Инкрементальный синк: повторная синхронизация загружает только новые данные
- Excel с двумя листами (Сводка + Детализация)

#### 3. Что осталось доделать
- Перейти к Фазе 7: рекламные кампании
- Тестирование на живых данных — возможны баги в расчётах и отображении

#### 4. Известные баги
- `WbSale.finishedPrice` у старых строк = NULL (до пересинхронизации)
- `syncFunnel` использует поштучный `upsert` (не batch) — может быть медленным при большом количестве артикулов × дней
- Цветовая индикация ФАКТ/МЕС и ФАКТ/ДЕНЬ работает только для строки «Выкупили, шт.» (единственная с plan-данными); для остальных метрик plan-данных нет
- Не реализованы: выбор произвольного периода синхронизации в UI (есть только Сегодня/Полная), отображение «Цена с СПП» (tooltip)
- Ширины sticky-колонок в `article-detail-grid.tsx` захардкожены (140px + 90px × 4); при масштабировании шрифта могут смещаться

---

### Итог сессии 2026-03-30 (3) — Фаза 7: рекламные кампании + ревизия реализации

#### 1. Что сделано
- Добавлена Prisma-модель `AdActionLog` и связь `actionLogs` у `AdCampaign`.
- Реализованы типы рекламного домена, WB advert API layer, sync services и server actions для кампаний, статистики, кластеров, журнала и Excel-экспорта.
- Собран UI раздела `/advertising`: список кампаний, детальная страница и 4 вкладки `Статистика`, `Кластеры`, `Разбивка`, `Журнал`.
- Добавлены действия управления: изменение ставки, пополнение бюджета, запуск и завершение кампании.
- Проведена локальная ревизия Phase 7, после которой обновлены документы и уточнены реальные WB-статусы.

#### 2. Что работает
- `npm run type-check` проходит.
- `npx prisma validate` проходит.
- Список кампаний, детальная страница, статистика, кластеры, разбивка и журнал собраны end-to-end на уровне кода.
- Журнал объединяет локальный `AdActionLog` и WB `upd` history.
- Тип ставки в UI показывается по-русски: `Ручная` / `Единая`.

#### 3. Что осталось доделать
- Провести живую проверку на реальном WB-аккаунте по основным сценариям: sync, fullstats, clusters, log, Excel.
- Вывести отдельное действие `Пауза` в server actions и UI; сейчас доведены только `Возобновить / Завершить`.
- При необходимости добавить отдельный debug-script под advert endpoints для ручной верификации ответов WB.

#### 4. Известные баги
- Отдельное багфикс-тестирование Phase 7 ещё не проводилось; ожидаем, что скрытые баги в живых данных есть и их будем проверять позже.
- `pauseCampaign` уже есть в WB API слое, но не подключён в actions/UI, поэтому сценарий паузы кампании пока не завершён.
- После `depositBudgetAction` бюджет обновляется локально оптимистично; без повторной синхронизации кампаний возможна временная рассинхронизация с фактическим бюджетом WB.
- Полный `npm run lint` по репозиторию сейчас не зелёный из-за существующих ошибок вне Phase 7 (`reports`, `sales-plan`, `cards`).

## Критические особенности Prisma 7

```typescript
// ПРАВИЛЬНО: new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
// НЕПРАВИЛЬНО: new PrismaClient()  ← ошибка без adapter
```

## WB API — домены и лимиты

```typescript
const WB_API_DOMAINS = {
  content:   'https://content-api.wildberries.ru',      // 100 req/min
  prices:    'https://discounts-prices-api.wildberries.ru',
  statistics:'https://statistics-api.wildberries.ru',   // 1 req/min
  analytics: 'https://seller-analytics-api.wildberries.ru',
  advert:    'https://advert-api.wildberries.ru',       // 5 req/sec
  common:    'https://common-api.wildberries.ru',
  finance:   'https://finance-api.wildberries.ru',
  marketplace:'https://marketplace-api.wildberries.ru',
} as const
// prices API v2 возвращает рубли (не копейки)!
// reportDetailByPeriod: rrdid-пагинация, стоп на 204, лимит 1 req/min
// orders/sales: пагинация через lastChangeDate, стоп на []
```

## Ключевые паттерны

- **Server Actions** для всех мутаций (не API Routes). API Routes — только вебхуки/Bull MQ.
- **Server Components** по умолчанию. `'use client'` — только при state/effects.
- **`?account=id` в URL** — все NavLinks включают выбранный кабинет. Server Components читают его из searchParams.
- **`checkRole(session, role)`** — src/lib/auth/check-role.ts. Иерархия: ADMIN(3) > MANAGER(2) > VIEWER(1).
- **Prisma transactions** для операций на несколько таблиц.

## Правила кода

1. Никогда `any` — создавай типы в `src/types/`
2. Не хардкодь URL WB API — используй WB_API_DOMAINS
3. try/catch + WbApiError / AuthError везде
4. Шифруй API-ключи (lib/encryption), никогда не храни открыто
5. console.log — только dev. В prod — pino/winston

## Команды

```bash
npm run dev            # http://localhost:3000
npm run type-check     # TypeScript без сборки
npm run db:push        # schema → БД (dev)
npm run db:seed        # создать ADMIN (из ADMIN_EMAIL / ADMIN_PASSWORD)
npm run docker:dev     # поднять PostgreSQL + Redis
```

---

### Итог сессии 2026-03-31 — Фаза 7: багфиксы рекламных кампаний

#### 1. Что сделано
- На странице списка рекламных кампаний добавлена сортировка по всем видимым столбцам: `Название`, `Статус`, `Бюджет`, `Тип ставки`, `Оплата`, `Размещение`.
- Исправлена синхронизация статистики рекламных кампаний из WB:
  - парсер `fullstats` теперь поддерживает актуальные поля ответа `days` и `apps`, а также fallback на старые `daily_stats` / `app_type_stats`;
  - в рекомендательный трафик добавлен `appType=64` наряду с уже поддерживаемыми типами;
  - сохранение статистики по датам переведено на безопасную нормализацию `YYYY-MM-DD -> T00:00:00.000Z` для `@db.Date`.
- Исправлена работа с датами в рекламных вкладках, где ранее использовался `toISOString().slice(0, 10)` и период мог сдвигаться на сутки из-за таймзоны браузера.
- Выравнена работа с датами в выборке/экспорте статистики и кластеров (`getCampaignStatsAction`, `getCampaignClustersAction`, `exportAdStatsXlsxAction`, `syncAdClusters`).
- Проведена локальная проверка изменений через `npm run type-check`.

#### 2. Что работает
- Список рекламных кампаний поддерживает сортировку по всем заголовкам таблицы.
- Синхронизация статистики больше не завязана только на устаревший формат WB `fullstats` и должна корректно сохранять дневные строки в `AdCampaignStat`.
- Разбивка и вкладка статистики используют корректные даты без сдвига по часовому поясу.
- Выгрузка Excel по рекламе и чтение кластеров используют ту же нормализацию дат, что и синхронизация/просмотр.
- `npm run type-check` проходит без ошибок.

#### 3. Что осталось доделать
- Провести живую проверку Phase 7 на реальном WB-аккаунте после этих багфиксов: список кампаний, статистика, кластеры, разбивка, Excel.
- Собрать и зафиксировать следующие найденные баги уже по результатам ручного тестирования.
- При необходимости отдельно доработать UX таблицы кампаний (например, сохранить выбранную сортировку в query/localStorage), если это понадобится в работе.

#### 4. Известные баги
- Да, по Phase 7 баги однозначно ещё есть, но на текущей сессии мы закрыли только два подтверждённых дефекта: сортировку списка кампаний и неработающую синхронизацию статистики.
- Полное багфикс-тестирование на живых данных ещё не проведено; оставшиеся проблемы будем целенаправленно выявлять и исправлять следующим этапом.
