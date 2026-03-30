# Фаза 6 — План продаж

## Context

Фазы 0-5 завершены. NimbaOS умеет синхронизировать карточки, формировать финансовые отчёты, вести справочники. Следующий шаг — **план продаж**: пользователь создаёт план на период, добавляет артикулы с целевыми показателями (план шт., цена, % выкупа), синхронизирует фактические данные из WB (заказы, продажи, воронка) и видит ежедневную детализацию план/факт.

**Маршрут:** `/sales-plan` (список) → `/sales-plan/[planId]` (детализация)

## Решения

- **Список планов** — карточки (название, период, ДРР, кол-во артикулов)
- **Реклама (РК)** — скрыта до Фазы 7 (нет строк в daily grid)
- **Аналитика воронки** — реализуется в подзадаче 4b (Переходы, Корзина %, Корзина шт., Заказ %)
- **Excel-экспорт** — включён (план + факт данные)

## Новые модели Prisma

3 модели для хранения синхронизированных данных WB. Модели `SalesPlan` и `SalesPlanItem` уже есть в schema.

```
WbOrder:      id, wbAccountId, srid (unique), nmId, vendorCode, date, lastChangeDate, finishedPrice, isCancel
WbSale:       id, wbAccountId, srid (unique), nmId, vendorCode, date, lastChangeDate, finishedPrice (nullable), priceWithDisc, forPay, isReturn
WbFunnelStat: id, wbAccountId, nmId, date, openCount, addToCartCount, addToCartConversion, cartCount, cartToOrderConversion, ordersCount, ordersSumRub
```

## Подзадачи

---

### Подзадача 1: Prisma schema + типы + CRUD Server Actions ✅

**Цель:** Создать слой данных. Можно создавать/читать/удалять планы через server actions.

**Файлы:**
- `prisma/schema.prisma` — добавлены модели `WbOrder`, `WbSale` + relations на `WbAccount`
- `src/types/sales-plan.ts` — типы: `SalesPlanRow`, `SalesPlanItemRow`, `SalesPlanCreateInput`, `SalesPlanItemInput`, `DailyMetrics`, `ArticleDetailData`, `OrdersSyncResult`, `SalesSyncResult`
- `src/lib/actions/sales-plan.ts` — 9 Server Actions (getPlans, createPlan, getPlanDetail, updatePlan, deletePlan, addPlanItems, addItemsFromStock, updatePlanItem, removePlanItem)

**Статус:** Завершена. TypeScript без ошибок, БД синхронизирована.

---

### Подзадача 2: UI списка планов + создание плана ✅

**Цель:** Заменить заглушку на рабочий список планов с карточками и диалогом создания.

**Файлы:**
- `src/app/(dashboard)/sales-plan/page.tsx` — Server Component: resolve account, fetch plans, render client
- `src/app/(dashboard)/sales-plan/sales-plan-client.tsx` — Client Component:
  - Карточки планов (name, dateFrom–dateTo, drrPercent, itemCount, createdAt)
  - Кнопка «Создать план» → открывает диалог
  - Клик по карточке → переход на `/sales-plan/[planId]?account=...`
  - Пустое состояние: «Нет планов. Создайте первый.»
  - Удаление плана: иконка корзины на карточке (hover) + диалог подтверждения
- `src/app/(dashboard)/sales-plan/create-plan-dialog.tsx` — Dialog с формой:
  - Поля: название, описание (optional), dateFrom, dateTo, целевой ДРР %
  - Submit → `createPlanAction` → redirect на детализацию

**Статус:** Завершена.

---

### Подзадача 3: Детализация плана — управление артикулами ✅

**Цель:** Страница плана позволяет добавлять/удалять/редактировать артикулы inline.

**Файлы:**
- `src/app/(dashboard)/sales-plan/[planId]/page.tsx` — Server Component: fetch plan detail, render client
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — Client Component:
  - Шапка плана (название, ДРР — inline-редактируемые)
  - Таблица артикулов: Арт. ВБ (WbArticleLink), Артикул поставщика, Категория, План шт. (edit), Цена (edit), Выкуп % (edit)
  - Inline-редактирование по паттерну из `cost-price-tab.tsx` (editValues, dirty, save on Enter/checkmark)
  - Кнопка «Добавить артикулы» с dropdown: «Из остатков» / «По-отдельности»
  - Удаление артикулов (иконка корзины в строке)
  - Сортировка по всем столбцам
- `src/app/(dashboard)/sales-plan/[planId]/add-article-dialog.tsx` — поиск по nmId/vendorCode, чекбоксы, массовое добавление
- `src/lib/services/spp-calculator.ts` — `getAutoFillByNmId(wbAccountId, nmIds[])`:
  - **Цена:** `ProductSize.price × (1 − discount/100)`, среднее по размерам (та же цена, что в разделе «Карточки»)
  - **Кол-во продаж / % выкупа:** из `RealizationReport` за прошлый месяц; формула идентична `report-calculator.ts`; OR-фильтр для строк с `rrDt=null`
- `src/lib/actions/sales-plan.ts` — `searchProductsForPlanAction` + в `getPlanDetailAction` подтягивается `salesCount` из `RealizationReport`
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — добавлена сортируемая колонка «Продажи, шт.» (кол-во Продажа-строк за прошлый месяц)
- `src/types/sales-plan.ts` — добавлено поле `salesCount: number | null` в `SalesPlanItemRow`

**Статус:** Завершена.

---

### Подзадача 4a: WB API — заказы и продажи + sync-сервисы ✅

**Цель:** Получать данные о заказах и продажах из WB API, хранить в БД.

**Файлы:**
- `src/lib/wb-api/orders.ts` — `fetchOrdersPage(client, dateFrom, lastChangeDate?)`: `GET /api/v1/supplier/orders` (statistics domain, пагинация через flag=1 + lastChangeDate, стоп на `[]`)
- `src/lib/wb-api/sales.ts` — `fetchSalesPage(client, dateFrom, lastChangeDate?)`: аналогично для `/api/v1/supplier/sales`
- `src/lib/services/sync-orders.ts` — `syncOrders(wbAccountId, dateFrom)`: decrypt key → WbApiClient → paginate → createMany skipDuplicates → return OrdersSyncResult
- `src/lib/services/sync-sales.ts` — `syncSales(wbAccountId, dateFrom)`: аналогично, `isReturn` определяется по `saleID.startsWith('R')`
- `src/lib/actions/sales-plan.ts` — `syncPlanDataAction(planId, mode, customFrom?, customTo?)`: оркестратор sync orders → sync sales последовательно

**Статус:** Завершена.

---

### Подзадача 4b: WB API — аналитика воронки + sync-сервис + модель Prisma ✅

**Цель:** Получать данные воронки продаж (переходы, корзина, заказы) из WB Analytics API, хранить в БД.

**Файлы:**
- `prisma/schema.prisma` — модель `WbFunnelStat` (unique: `[wbAccountId, nmId, date]`)
- `src/lib/wb-api/analytics.ts` — `fetchFunnelHistory(client, nmIds[], dateFrom, dateTo)`:
  - `POST /api/analytics/v3/sales-funnel/products/history` (analytics domain, 3 req/min)
  - Батч nmIds по 20 штук, возвращает per-nmId per-day аналитику
- `src/lib/services/sync-funnel.ts` — `syncFunnel(wbAccountId, nmIds[], dateFrom, dateTo)`:
  - decrypt key → WbApiClient → fetch → upsert в WbFunnelStat
  - Return `FunnelSyncResult { totalRows, upserted, errors, durationMs }`
- `src/types/sales-plan.ts` — WB API типы (`WbFunnelHistoryRequest`, `WbFunnelHistoryDay`, `WbFunnelHistoryCard`, `WbFunnelHistoryResponse`), `FunnelSyncResult`, расширение `DailyMetrics` и `PlanSyncResult`

**Статус:** Завершена.

---

### Подзадача 5: Калькулятор плана — ежедневные метрики ✅

**Цель:** Чистая функция, которая из сырых данных в БД вычисляет daily breakdown для каждого артикула плана.

**Файлы:**
- `src/lib/services/plan-calculator.ts` — `calculatePlanDetail(planId, wbAccountId, dateFrom, dateTo)`:
  1. 5 параллельных DB-запросов: plan+items, WbOrder, WbSale, WbFunnelStat, Products
  2. Индексация по `nmId:date` ключу для быстрого доступа
  3. 10 ежедневных метрик: revenueOrders, ordersCount, revenueSales, boughtQty, avgPrice, visits, cartPercent, cartQty, orderPercent
  4. Итоги: ПЛАН/МЕС, ФАКТ/МЕС, ПЛАН/ДЕНЬ, ФАКТ/ДЕНЬ
  5. Decimal → string для сериализации на клиент
- `src/lib/actions/sales-plan.ts` — `getPlanMetricsAction(planId)`: вызывает `calculatePlanDetail`

**Статус:** Завершена.

---

### Подзадача 6: UI ежедневной детализации (daily grid) ✅

**Цель:** Раскрываемая детализация артикула с ежедневными метриками.

**Файлы:**
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — расширен:
  - Кнопка «Получить данные» с dropdown (Сегодня / Полная)
  - Кнопка «Показать метрики» — загрузка из БД без синхронизации
  - Индикатор синхронизации (spinner, результат)
  - Каждая строка артикула — раскрываемая (chevron, expand/collapse)
  - Колонки «Факт» и «%» в основной таблице при загруженных метриках
- `src/app/(dashboard)/sales-plan/[planId]/article-detail-grid.tsx` — перевёрнутая таблица:
  - 5 sticky колонок: метрика + ПЛАН/МЕС + ФАКТ/МЕС + ПЛАН/ДЕНЬ + ФАКТ/ДЕНЬ
  - Даты с горизонтальным скроллом
  - Цветовая индикация: зелёный (факт >= план), красный (отстаёт), голубой (сегодня)
- `src/app/(dashboard)/sales-plan/[planId]/plan-metrics-rows.ts` — 9 метрик с accessors, formatters, summary accessors

**Статус:** Завершена.

---

### Подзадача 7: Excel-экспорт + полировка ✅

**Цель:** Экспорт плана в xlsx, обработка edge cases, финальные штрихи.

**Файлы:**
- `src/lib/actions/sales-plan.ts` — `exportPlanXlsxAction(planId)`:
  - 2 листа: «Сводка» (артикулы + план/факт итоги) и «Детализация» (per-article, 9 метрик × даты)
  - Возвращает `{ base64, filename }` для скачивания на клиенте
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx`:
  - Кнопка «Экспорт Excel» с индикатором загрузки
  - Пустое состояние: «Нажмите "Получить данные"…»
  - `stopPropagation` на inputs/links/buttons внутри раскрываемых строк

**Статус:** Завершена.

---

## Порядок выполнения

```
Подзадача 1 (Schema + Types + Actions) ✅
  → Подзадача 2 (Plan List UI) ✅
    → Подзадача 3 (Article Management) ✅
      → Подзадача 4a (WB API: Orders + Sales) ✅
        → Подзадача 4b (WB API: Analytics Funnel) ✅
          → Подзадача 5 (Calculator + Funnel) ✅
            → Подзадача 6 (Daily Grid UI + Funnel rows) ✅
              → Подзадача 7 (Excel + Polish) ✅
```

## Ключевые файлы для переиспользования

| Паттерн | Файл-образец |
|---------|-------------|
| Server Actions | `src/lib/actions/reports.ts` |
| Sync service | `src/lib/services/sync-reports.ts` |
| WB API client | `src/lib/wb-api/client.ts`, `src/lib/wb-api/reports.ts` |
| Task-based WB API | `src/lib/wb-api/paid-storage.ts` |
| Calculator | `src/lib/services/report-calculator.ts` |
| Inline editing | `src/app/(dashboard)/references/cost-price-tab.tsx` |
| Table sticky cols | `src/app/(dashboard)/reports/report-table.tsx` |
| DateRangePicker | `src/components/date-range-picker.tsx` |
| WbArticleLink | `src/components/wb-article-link.tsx` |
| Types pattern | `src/types/reports.ts` |

## Верификация (end-to-end)

1. Создать план на месяц, добавить артикулы из остатков
2. Отредактировать план шт., цену, % выкупа inline
3. Синхронизировать данные (кнопка «Получить данные» → «Сегодня»)
4. Раскрыть артикул — увидеть daily grid с фактическими данными
5. Проверить метрики воронки (Переходы, Корзина %, Корзина шт., Заказ %)
6. Сверить выручку заказов/продаж с данными в личном кабинете WB
7. Экспортировать в Excel — проверить корректность (включая воронку)
8. Удалить план — подтверждение, план удалён
