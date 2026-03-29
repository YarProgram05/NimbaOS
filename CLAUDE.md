# CLAUDE.md

> Детали архитектуры и API — в [SPECIFICATION.md](SPECIFICATION.md)
> История решений — в [docs/DECISIONS.md](docs/DECISIONS.md)

## Проект

**NimbaOS** — закрытая веб-платформа оцифровки кабинетов продавца на Wildberries.
Последнее обновление: **2026-03-29** | Следующая задача: **Фаза 6 (план продаж)**

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

### Подзадача 1 (✅ завершена): Prisma schema + типы + CRUD Server Actions

**Новые модели Prisma:**
- `WbOrder` (таблица `wb_orders`, unique: `[wbAccountId, srid]`) — заказы из WB statistics API
- `WbSale` (таблица `wb_sales`, unique: `[wbAccountId, srid]`) — продажи из WB statistics API
- `SalesPlan` и `SalesPlanItem` — уже были в схеме (Phase 0)

**Новые файлы:**
- `src/types/sales-plan.ts` — типы: WB API responses (`WbOrderRow`, `WbSaleRow`), internal types (`SalesPlanRow`, `SalesPlanDetail`, `SalesPlanItemRow`), input types, sync results, daily metrics (`DailyMetrics`, `ArticleDetailData`, `PlanMetricsData`)
- `src/lib/actions/sales-plan.ts` — 9 Server Actions: `getPlansAction`, `createPlanAction`, `getPlanDetailAction`, `updatePlanAction`, `deletePlanAction`, `addPlanItemsAction`, `addItemsFromStockAction`, `updatePlanItemAction`, `removePlanItemAction`

**Ключевые решения:**
- `getPlanDetailAction` обогащает items данными из Products (photoUrl, category, title, brand)
- `addItemsFromStockAction` проверяет дубликаты по nmId перед добавлением
- Decimal-поля сериализуются в string (как в reports)

### Что ещё предстоит (подзадачи 2–8):
- UI списка планов (карточки) + диалог создания
- Детализация плана с inline-редактированием артикулов
- WB API интеграция: Orders + Sales (statistics domain) + Analytics Funnel (analytics domain)
- Калькулятор ежедневных метрик
- UI daily grid (перевёрнутая таблица: метрики × даты)
- Аналитика воронки (Переходы, Корзина %, Корзина шт., Заказ %)
- Excel-экспорт + полировка

### WB API endpoints для Фазы 6:
- `GET /api/v1/supplier/orders` — statistics domain, пагинация lastChangeDate, стоп на `[]`
- `GET /api/v1/supplier/sales` — statistics domain, аналогичная пагинация
- `POST /api/analytics/v3/sales-funnel/products/history` — analytics domain, воронка по дням

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
