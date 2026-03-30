# CLAUDE.md

> Детали архитектуры и API — в [SPECIFICATION.md](SPECIFICATION.md)
> История решений — в [docs/DECISIONS.md](docs/DECISIONS.md)

## Проект

**NimbaOS** — закрытая веб-платформа оцифровки кабинетов продавца на Wildberries.
Последнее обновление: **2026-03-30** | Текущая задача: **Фаза 6 (план продаж) — подзадачи 1–4a завершены, автозаполнение исправлено**

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
| **6** | **🔧** | **План продаж** — CRUD, UI списка/детализации, WB Orders/Sales/Funnel API, daily grid, Excel-экспорт |
| 7 | — | Рекламные кампании |
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

## Фаза 6 — План продаж (🔧 в работе)

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
- `src/lib/services/sync-orders.ts` — `syncOrders`: decrypt → paginate → createMany skipDuplicates
- `src/lib/services/sync-sales.ts` — `syncSales`: аналогично, `isReturn` по `saleID.startsWith('R')`
- `syncPlanDataAction` — оркестратор: mode (today/full/custom) → syncOrders → syncSales последовательно

### Что ещё предстоит (подзадачи 4b–7):
- 4b: WB API аналитика воронки (Prisma model WbFunnelStat, sync-funnel)
- 5: Калькулятор ежедневных метрик
- 6: UI daily grid (перевёрнутая таблица: метрики × даты)
- 7: Excel-экспорт + полировка

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

### Итог сессии 2026-03-30 — Фаза 6: автозаполнение плана + исправление lastSyncAt

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
- `spp-calculator` использует `priceWithDisc` (из-за смены источника на ProductSize, `finishedPrice` в расчётах не участвует, но поле сохраняется для будущих нужд)

#### 2. Что работает
- Автозаполнение цены, % выкупа и кол-ва продаж при добавлении артикулов в план — значения совпадают с данными финансовых отчётов за тот же период
- «Продажи, шт.» в таблице плана показывает корректные данные (при условии синхронизации отчётов)
- «Последняя синхронизация» в отчётах корректно обновляется после каждого синка

#### 3. Что осталось доделать
- Подзадача 4b: аналитика воронки (WbFunnelStat, sync-funnel)
- Подзадача 5: калькулятор ежедневных метрик
- Подзадача 6: UI daily grid
- Подзадача 7: Excel-экспорт + полировка

#### 4. Известные баги
- Подтверждённых багов нет.
- `WbSale.finishedPrice` у старых строк = NULL (до пересинхронизации). В `spp-calculator` это не используется (источник — ProductSize), но для будущих расчётов на основе `WbSale` нужен пересинк.

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
