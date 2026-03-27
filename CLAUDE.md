# CLAUDE.md

> Детали архитектуры и API — в [SPECIFICATION.md](SPECIFICATION.md)
> История решений — в [docs/DECISIONS.md](docs/DECISIONS.md)

## Проект

**NimbaOS** — закрытая веб-платформа оцифровки кабинетов продавца на Wildberries.
Последнее обновление: **2026-03-27** | Следующая задача: **Фаза 5 (доработки: Storage API) → Фаза 6**

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
| **5** | **⚠️** | **Финансовые отчёты** — UI, формулы, сортировка, DnD колонок, фильтры, группировка; хранение per-article требует нового API |
| 6 | — | План продаж |
| 7 | — | Рекламные кампании |
| 8 | — | Фоновая синхронизация (Bull MQ) |
| 9 | — | Финальная доработка (Excel, responsive, Docker prod) |

## Фаза 5 — Финансовые отчёты (⚠️ в работе — требуются доработки)

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

### Хранение по артикулам — ограничение:
- WB `reportDetailByPeriod` возвращает хранение **только в строках nmId=0** (глобальный агрегат по дням)
- Пропорциональное распределение по артикулам из nmId=0 строк НЕ ТОЧНОЕ (зависит от объёма запасов×дни, которых у нас нет)
- Артикулы без продаж/логистики в периоде (только хранение) не попадают в отчёт
- Правильное решение: GET `https://seller-analytics-api.wildberries.ru/api/v1/analytics/paid-storage` — возвращает хранение по артикулу×день; требует отдельного синка в Phase 5.x

### Формулы (исправленные):
- **Налоги** = Продажи × ставка/100 (УСН доходы, ставка из настроек кабинета)
- **Лог. ед.** = Логистика / Выкуплено (boughtWithReturns = продажи − возвраты)

### Заглушки (следующие фазы):
- Col 15-16 (Реклама) = 0 → Фаза 7
- Col 51 (Ярлыки) = "" → Product.tags

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
