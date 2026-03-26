# CLAUDE.md

> Детали архитектуры и API — в [SPECIFICATION.md](SPECIFICATION.md)
> История решений — в [docs/DECISIONS.md](docs/DECISIONS.md)

## Проект

**NimbaOS** — закрытая веб-платформа оцифровки кабинетов продавца на Wildberries.
Последнее обновление: **2026-03-26** | Следующая задача: **Фаза 5 — UI отчётов (подзадачи 5–10)**

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
| **5** | **⏳** | **Финансовые отчёты** — бэкенд готов, UI в работе |
| 6 | — | План продаж |
| 7 | — | Рекламные кампании |
| 8 | — | Фоновая синхронизация (Bull MQ) |
| 9 | — | Финальная доработка (Excel, responsive, Docker prod) |

## Фаза 5 — Финансовые отчёты (текущая задача)

### Готово (подзадачи 1–4):
- `src/types/reports.ts` — WbRealizationRow (snake_case API), ReportRow (52 столбца), ReportData, ReportSyncResult, ColumnGroup
- `src/lib/wb-api/reports.ts` — fetchRealizationReportPage(): rrdid-пагинация, стоп на 204/пустой массив
- `src/lib/services/sync-reports.ts` — syncRealizationReport(): цикл страниц → createMany({ skipDuplicates }) по rrdId unique
- `src/lib/services/report-calculator.ts` — calculateReport(): группировка по nmId, 52 формулы, двухпроходный расчёт (col 9 = ОП/totalОП), summary row, safeDivide(), обогащение из CostPrice/SelfPurchase/ExternalAd/ArticleOverride
- Зависимости: `xlsx`, `react-day-picker` установлены

### Осталось (подзадачи 5–10):
```
5. src/lib/actions/reports.ts — Server Actions: syncReportsAction, getReportData, exportReportXlsx
6. reports/columns.tsx — 52 определения колонок, 9 групп (identity/sales/quantities/margins/advertising/logistics/references/fees/detailed)
7. reports/report-table.tsx — frozen первые 3 col (sticky CSS), горизонтальный скролл, summary row в <tfoot>
8. reports/reports-client.tsx — DateRangePicker (react-day-picker), кнопка синхр., toggle групп колонок, экспорт Excel
9. reports/page.tsx — Server Component: searchParams (account, dateFrom, dateTo), дефолт = текущий месяц
```

### Заглушки (будут заполнены в следующих фазах):
- Col 15-16 (Реклама баланс/все) = 0 → Фаза 7
- Col 39 (Отмены) = 0 → Фаза 8 (orders API)
- Col 51 (Ярлыки) = "" → можно обогатить из Product.tags

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
