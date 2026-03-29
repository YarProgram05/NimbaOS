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
WbSale:       id, wbAccountId, srid (unique), nmId, vendorCode, date, lastChangeDate, priceWithDisc, forPay, isReturn
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

### Подзадача 2: UI списка планов + создание плана

**Цель:** Заменить заглушку на рабочий список планов с карточками и диалогом создания.

**Файлы:**
- `src/app/(dashboard)/sales-plan/page.tsx` — Server Component: resolve account, fetch plans, render client
- `src/app/(dashboard)/sales-plan/sales-plan-client.tsx` — Client Component:
  - Карточки планов (name, dateFrom–dateTo, drrPercent, itemCount, createdAt)
  - Кнопка «Создать план» → открывает диалог
  - Клик по карточке → переход на `/sales-plan/[planId]?account=...`
  - Пустое состояние: «Нет планов. Создайте первый.»
- `src/app/(dashboard)/sales-plan/create-plan-dialog.tsx` — Dialog с формой:
  - Поля: название, описание (optional), dateFrom, dateTo, целевой ДРР %
  - Submit → `createPlanAction` → redirect на детализацию

**Паттерны:** shadcn Dialog, Card; DateRangePicker из `src/components/date-range-picker.tsx`; `useTransition` для loading

**Проверка:** Открыть `/sales-plan`, создать план, увидеть карточку, кликнуть — попасть в детализацию.

---

### Подзадача 3: Детализация плана — управление артикулами

**Цель:** Страница плана позволяет добавлять/удалять/редактировать артикулы inline.

**Файлы:**
- `src/app/(dashboard)/sales-plan/[planId]/page.tsx` — Server Component: fetch plan detail, render client
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — Client Component:
  - Шапка плана (название, период, ДРР — редактируемые)
  - Таблица артикулов: Арт. ВБ (WbArticleLink), Артикул поставщика, Категория, План шт. (edit), Цена (edit), Выкуп % (edit)
  - Inline-редактирование по паттерну из `cost-price-tab.tsx` (editValues, dirty, save on Enter/checkmark)
  - Кнопка «Добавить артикулы» с dropdown: «Из остатков» / «По-отдельности»
  - «Из остатков» → `addItemsFromStockAction` (все Products аккаунта)
  - «По-отдельности» → диалог поиска
  - Удаление артикулов (иконка корзины в строке)
- `src/app/(dashboard)/sales-plan/[planId]/add-article-dialog.tsx` — поиск по nmId/vendorCode, выбор, подтверждение
- `src/lib/services/spp-calculator.ts` — `getAvgSppByNmId(wbAccountId, nmIds[], days=14)`: средний SPP из `RealizationReport` для auto-fill buyoutPercent

**Паттерны:** `WbArticleLink` из `src/components/wb-article-link.tsx`; inline edit из `cost-price-tab.tsx`

**Проверка:** Добавить артикулы из остатков, отредактировать план/цену/выкуп inline, удалить артикул. SPP автозаполняется.

---

### Подзадача 4a: WB API — заказы и продажи + sync-сервисы

**Цель:** Получать данные о заказах и продажах из WB API, хранить в БД.

**Файлы:**
- `src/lib/wb-api/orders.ts` — `fetchOrdersPage(client, dateFrom, lastChangeDate?)`: `GET /api/v1/supplier/orders` (statistics domain, пагинация через lastChangeDate, стоп на `[]`)
- `src/lib/wb-api/sales.ts` — `fetchSalesPage(client, dateFrom, lastChangeDate?)`: `GET /api/v1/supplier/sales` (statistics domain, аналогичная пагинация)
- `src/lib/services/sync-orders.ts` — `syncOrders(wbAccountId, dateFrom)`: decrypt key → WbApiClient → paginate → createMany skipDuplicates → return OrdersSyncResult
- `src/lib/services/sync-sales.ts` — `syncSales(wbAccountId, dateFrom)`: аналогично
- `src/lib/actions/sales-plan.ts` — добавить:
  - `syncPlanDataAction(planId, mode: 'today'|'full'|'custom', customFrom?, customTo?)` — orchestrates: sync orders → sync sales → sync funnel (последовательно)

**Rate limits:** statistics domain = 1 req/min. Оба API на одном домене → синхронизация последовательная.

**Паттерны:** `WbApiClient` из `src/lib/wb-api/client.ts`; sync pattern из `src/lib/services/sync-reports.ts`

**Проверка:** Вызвать `syncPlanDataAction`, проверить записи в `wb_orders` и `wb_sales` в БД.

---

### Подзадача 4b: WB API — аналитика воронки + sync-сервис + модель Prisma

**Цель:** Получать данные воронки продаж (переходы, корзина, заказы) из WB Analytics API, хранить в БД.

**Файлы:**
- `prisma/schema.prisma` — добавить модель `WbFunnelStat`:
  ```
  WbFunnelStat {
    id                    UUID PK
    wbAccountId           UUID FK → WbAccount
    nmId                  Int
    date                  DateTime @db.Date
    openCount             Int @default(0)          // Переходы (открытия карточки)
    addToCartCount        Int @default(0)          // Добавлено в корзину
    addToCartConversion   Decimal @db.Decimal(6,4) // Корзина %
    cartCount             Int @default(0)          // Корзина, шт.
    cartToOrderConversion Decimal @db.Decimal(6,4) // Заказ %
    ordersCount           Int @default(0)          // Заказы из воронки
    ordersSumRub          Decimal @db.Decimal(12,2)// Сумма заказов
    fetchedAt             DateTime @default(now())

    @@unique([wbAccountId, nmId, date])
    @@index([wbAccountId, date])
    @@map("wb_funnel_stats")
  }
  ```
- `src/lib/wb-api/analytics.ts` — `fetchFunnelHistory(client, nmIds[], dateFrom, dateTo)`:
  - `POST /api/analytics/v3/sales-funnel/products/history` (analytics domain, 3 req/min)
  - Принимает массив nmIds (батч если > лимита API)
  - Возвращает per-nmId per-day аналитику
- `src/lib/services/sync-funnel.ts` — `syncFunnel(wbAccountId, nmIds[], dateFrom, dateTo)`:
  - decrypt key → WbApiClient → fetch → upsert в WbFunnelStat
  - Return `FunnelSyncResult { totalRows, upserted, errors, durationMs }`
- `src/types/sales-plan.ts` — добавить:
  - `WbFunnelHistoryRow` (WB API response type)
  - `FunnelSyncResult`
  - Расширить `DailyMetrics` полями воронки: `visits`, `cartPercent`, `cartQty`, `orderPercent`
  - Расширить `PlanSyncResult` полем `funnel: FunnelSyncResult`

**WB API endpoint:**
- `POST /api/analytics/v3/sales-funnel/products/history` — analytics domain (`seller-analytics-api.wildberries.ru`), rate limit 3 req/min (20s throttle уже в constants.ts)

**Интеграция с syncPlanDataAction:** после sync orders + sales запускается sync funnel для nmIds из плана.

**Проверка:** `npx prisma db:push`, вызвать `syncPlanDataAction`, проверить записи в `wb_funnel_stats` в БД.

---

### Подзадача 5: Калькулятор плана — ежедневные метрики

**Цель:** Чистая функция, которая из сырых данных в БД вычисляет daily breakdown для каждого артикула плана.

**Файлы:**
- `src/lib/services/plan-calculator.ts` — `calculatePlanDetail(planId, wbAccountId, dateFrom, dateTo)`:
  1. Параллельно из БД: plan+items, WbOrder за период, WbSale за период, WbFunnelStat за период, avg SPP
  2. Для каждого item × каждого дня:
     - `revenueOrders` = Σ finishedPrice (WbOrder, nmId, date, !isCancel)
     - `ordersCount` = count WbOrder
     - `revenueSales` = Σ priceWithDisc (WbSale, nmId, date, !isReturn)
     - `boughtQty` = count WbSale (!isReturn)
     - `avgPrice` = revenueSales / boughtQty (или 0)
     - `visits` = WbFunnelStat.openCount
     - `cartPercent` = WbFunnelStat.addToCartConversion
     - `cartQty` = WbFunnelStat.cartCount
     - `orderPercent` = WbFunnelStat.cartToOrderConversion
     - Реклама = 0 (stub, Phase 7)
  3. Итоги: ПЛАН/МЕС, ФАКТ/МЕС, ПЛАН/ДЕНЬ, ФАКТ/ДЕНЬ
  4. Return `ArticleDetailData[]`

- `src/lib/actions/sales-plan.ts` — добавить:
  - `getPlanMetricsAction(planId)` — вызывает `calculatePlanDetail`, возвращает данные для UI

**Паттерны:** чистая функция как `report-calculator.ts`; Decimal → string для сериализации

**Проверка:** Синхронизировать данные, вызвать `getPlanMetricsAction`, сверить с данными WB.

---

### Подзадача 6: UI ежедневной детализации (daily grid)

**Цель:** Раскрываемая детализация артикула с ежедневными метриками.

**Файлы:**
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — расширить:
  - Кнопка «Получить данные» с dropdown (Сегодня / Полная / Выбрать период)
  - Индикатор синхронизации (spinner, результат)
  - Каждая строка артикула — раскрываемая (expand/collapse)
- `src/app/(dashboard)/sales-plan/[planId]/article-detail-grid.tsx` — Client Component:
  - **Перевёрнутая таблица**: метрики как строки, даты как столбцы
  - Структура:
    ```
    |                  | ПЛАН/МЕС | ФАКТ/МЕС | ПЛАН/ДЕНЬ | ФАКТ/ДЕНЬ | 01.03 | 02.03 | ...
    | Выр. заказы      |   ...    |   ...     |   ...     |   ...     | 1234  | 2345  |
    | Кол-во заказов   |   ...    |   ...     |   ...     |   ...     | 12    | 23    |
    | Выр. продажи     |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    | Выкупили, шт.    |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    | Переходы, шт.    |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    | Корзина, %       |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    | Корзина, шт.     |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    | Заказ, %         |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    | Ср. цена         |   ...    |   ...     |   ...     |   ...     | ...   | ...   |
    ```
  - Frozen первая колонка (названия метрик) + 4 summary-колонки (sticky)
  - Горизонтальный скролл для дат
  - Цветовая индикация: зелёный если факт >= план, красный если отстаёт
- `src/app/(dashboard)/sales-plan/[planId]/plan-metrics-rows.ts` — определения строк метрик:
  - label, accessor в DailyMetrics, formatter (rub/number/percent)
  - ~9 строк: revenueOrders, ordersCount, revenueSales, boughtQty, visits, cartPercent, cartQty, orderPercent, avgPrice

**Паттерны:** HTML table (не TanStack — структура кардинально другая); sticky positioning как в `report-table.tsx`

**Проверка:** Синхронизировать данные, раскрыть артикул, увидеть ежедневную таблицу с корректными цифрами, включая метрики воронки.

---

### Подзадача 7: Excel-экспорт + полировка

**Цель:** Экспорт плана в xlsx, обработка edge cases, финальные штрихи.

**Файлы:**
- `src/lib/actions/sales-plan.ts` — добавить:
  - `exportPlanXlsxAction(planId)` — генерирует xlsx с артикулами + plan/fact + daily breakdown (включая воронку)
- `src/app/(dashboard)/sales-plan/[planId]/plan-detail-client.tsx` — кнопка «Экспорт Excel»

**Полировка:**
- Пустые состояния: нет items → «Добавьте артикулы»; нет данных → «Нажмите "Получить данные"»
- Подтверждение удаления плана (Dialog)
- Отображение «Цена с СПП» рядом с ценой (tooltip)
- Инкрементальная синхронизация: при повторном синке подхватываем с lastChangeDate
- URL: `?account=id` проброшен на все страницы

**Проверка:** Экспорт xlsx, открыть в Excel — данные корректны. Все edge cases обработаны.

---

## Порядок выполнения

```
Подзадача 1 (Schema + Types + Actions) ✅
  → Подзадача 2 (Plan List UI)
    → Подзадача 3 (Article Management)
      → Подзадача 4a (WB API: Orders + Sales)
        → Подзадача 4b (WB API: Analytics Funnel)
          → Подзадача 5 (Calculator + Funnel)
            → Подзадача 6 (Daily Grid UI + Funnel rows)
              → Подзадача 7 (Excel + Polish)
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
