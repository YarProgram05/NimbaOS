# Фаза 5 — Финансовые отчёты: План реализации

## Контекст

Фазы 0–4 завершены. Платформа NimbaOS имеет: авторизацию, управление WB-кабинетами, синхронизацию карточек, справочники (себестоимость, самовыкупы, внешняя реклама, переименования). Фаза 5 добавляет финансовые отчёты — самый сложный модуль с 52 расчётными столбцами, загрузкой данных через WB API с лимитом 1 req/min, и Excel-экспортом.

**Что уже готово:**
- Prisma-модель `RealizationReport` (schema.prisma:203-248) — все 39+ полей
- `WbApiClient` с throttle 60с для домена `statistics` (constants.ts:19)
- Bull MQ очередь `SYNC_REALIZATION` (queue/index.ts:9)
- Справочники: CostPrice, SelfPurchase, ExternalAd, ArticleOverride
- Placeholder страницы `/reports`

---

## Файлы к созданию (в порядке реализации)

| # | Файл | Назначение |
|---|------|-----------|
| 1 | `src/types/reports.ts` | Типы: WbRealizationRow, ReportRow (52 col), ReportData, ReportSyncResult |
| 2 | `src/lib/wb-api/reports.ts` | fetchRealizationReportPage() — пагинация через rrdid |
| 3 | `src/lib/services/sync-reports.ts` | syncRealizationReport() — загрузка всех страниц, upsert в БД |
| 4 | `src/lib/services/report-calculator.ts` | calculateReport() — группировка по nmId, расчёт 52 столбцов |
| 5 | `src/lib/actions/reports.ts` | Server Actions: syncReportsAction, getReportData, exportReportXlsx |
| 6 | `src/app/(dashboard)/reports/columns.tsx` | 52 определения колонок + группы show/hide |
| 7 | `src/app/(dashboard)/reports/report-table.tsx` | Таблица: frozen cols, горизонтальный скролл, итоговая строка |
| 8 | `src/app/(dashboard)/reports/reports-client.tsx` | DateRangePicker, кнопка синхр., toggle групп колонок, экспорт |
| 9 | `src/app/(dashboard)/reports/page.tsx` | Перезапись placeholder → Server Component |

---

## Подзадача 1: Типы (`src/types/reports.ts`)

### WbRealizationRow — ответ WB API (snake_case)
```typescript
interface WbRealizationRow {
  rrd_id: number
  realizationreport_id: number
  date_from: string
  date_to: string
  nm_id: number
  vendor_code: string
  barcode: string | null
  doc_type_name: string          // "Продажа" | "Возврат"
  quantity: number
  retail_price: number
  retail_price_withdisc_rub: number
  ppvz_for_pay: number
  ppvz_spp_prc: number
  delivery_rub: number
  penalty: number
  additional_payment: number
  storage_fee: number
  deduction: number
  acceptance: number
  acquiring_fee: number
  commission_percent: number
  ppvz_sales_commission: number
  sale_percent: number
  bonus_type_name: string | null
  srid: string | null
  subject_name: string | null
  brand_name: string | null
  office_name: string | null
  supplier_oper_name: string | null
  order_dt: string | null
  sale_dt: string | null
  rr_dt: string | null
}
```

### ReportRow — 52 столбца (Decimal → string)
Все денежные поля — `string` (Decimal через Server Action boundary). Количественные — `number`.

### ReportData — обёртка для страницы
```typescript
{ rows: ReportRow[], summary: ReportRow, dateFrom: string, dateTo: string, lastSyncAt: string | null }
```

### ReportSyncResult
```typescript
{ totalRows: number, upserted: number, pages: number, errors: number, durationMs: number }
```

### ColumnGroup — для UI toggle
```typescript
type ColumnGroupId = 'identity' | 'sales' | 'quantities' | 'margins' | 'advertising' | 'logistics' | 'references' | 'fees' | 'detailed'
```

---

## Подзадача 2: WB API fetch (`src/lib/wb-api/reports.ts`)

**Паттерн:** как `fetchCardsList` в products.ts

```typescript
export async function fetchRealizationReportPage(
  client: WbApiClient,
  dateFrom: string,   // YYYY-MM-DD
  dateTo: string,
  rrdid?: number,
): Promise<{ rows: WbRealizationRow[]; lastRrdId: number | null; done: boolean }>
```

- `client.get<WbRealizationRow[] | null>('statistics', '/api/v5/supplier/reportDetailByPeriod', params)`
- Клиент уже обрабатывает 204 → null (client.ts:70-72)
- При `null` или пустом массиве → `{ rows: [], lastRrdId: null, done: true }`
- Иначе → `lastRrdId = rows[rows.length - 1].rrd_id`, `done: false`

---

## Подзадача 3: Sync service (`src/lib/services/sync-reports.ts`)

**Паттерн:** как `syncProducts` в sync-products.ts

```typescript
export async function syncRealizationReport(
  wbAccountId: string, dateFrom: string, dateTo: string,
): Promise<ReportSyncResult>
```

1. Получить и расшифровать API-ключ (decrypt)
2. Создать WbApiClient
3. Цикл пагинации через rrdid
4. Маппинг snake_case → camelCase
5. `prisma.realizationReport.createMany({ data: mapped, skipDuplicates: true })` — по rrdId unique constraint
6. Возврат статистики

**Важно:** throttle 60с уже встроен в WbApiClient для домена `statistics`. Дополнительных задержек не нужно.

---

## Подзадача 4: Report calculator (`src/lib/services/report-calculator.ts`) — САМАЯ СЛОЖНАЯ

```typescript
export async function calculateReport(
  wbAccountId: string, dateFrom: string, dateTo: string,
): Promise<ReportData>
```

### Алгоритм:
1. **Параллельная загрузка** из БД:
   - `realizationReport.findMany({ where: { wbAccountId, dateFrom >= , dateTo <= } })`
   - `costPrice.findMany({ where: { wbAccountId } })` → Map по vendorCode
   - `selfPurchase.findMany({ where: { wbAccountId, date >= , date <= } })` → Map по vendorCode
   - `externalAd.findMany({ where: { wbAccountId, date >= , date <= } })` → Map по vendorCode
   - `articleOverride.findMany({ where: { wbAccountId } })` → Map по vendorCode
   - `wbAccount.findUnique({ select: { taxRate: true } })`

2. **Группировка** rows по nmId → `Map<number, row[]>`

3. **Расчёт каждой группы** (52 столбца):

| Столбец | Формула |
|---------|---------|
| 4. Продажа | Σ retailPriceWithDisc(Продажа) − Σ retailPriceWithDisc(Возврат) |
| 5. К перечислению | Σ ppvzForPay(Продажа) − Σ ppvzForPay(Возврат) |
| 10. Цена ср. | Σ retailPriceWithDisc(Продажа) / кол-во Продаж |
| 11. Выкуплено | count(Продажа) − count(Возврат) |
| 12. Выкуп % | boughtWithReturns / boughtWithoutReturns × 100 |
| 18. Логистика | Σ deliveryRub |
| 20. Доставлено | count(supplierOperName = "Логистика") |
| 27. Себестоимость | costPriceUnit × boughtWithReturns |
| 32. Налоги | toTransfer × taxRate% |
| 7. ОП | toTransfer − adAll − externalAd − logistics − costPrice − storageFee − acceptance − additionalPayment − penalty − taxes − deductions − selfPurchaseAmount − cashbackDistributions |
| 6. Итого к оплате | toTransfer − adBalance − logistics − additionalPayment − penalty − storageFee − acceptance − deductions |
| 9. % от ОП | ОП_артикула / ОП_всего × 100 (двухпроходный расчёт) |

4. **Двухпроходный расчёт:** первый проход — все метрики кроме col 9. Суммируем totalOP. Второй проход — col 9 = op / totalOP × 100.

5. **Summary row:** те же формулы, но по ВСЕМ строкам без группировки.

6. **Хелпер:** `safeDivide(a, b, decimals = 2): string` — защита от деления на 0.

### Реклама (col 15-16):
- `adBalance = 0` и `adAll = 0` — данные появятся в Фазе 7 (Рекламные кампании)
- Структура расчёта уже заложена, просто значения = 0

### Col 39 (Отмены):
- `cancellations = 0` — данные из orders API, будет в Фазе 8

### Col 51 (Ярлыки):
- Пустая строка пока — можно обогатить из Product.tags позже

---

## Подзадача 5: Server Actions (`src/lib/actions/reports.ts`)

### syncReportsAction
```typescript
export async function syncReportsAction(wbAccountId: string, dateFrom: string, dateTo: string): Promise<ActionResult<ReportSyncResult>>
```
- requireSession() + валидация zod (даты, UUID)
- Вызов syncRealizationReport()

### getReportData
```typescript
export async function getReportData(wbAccountId: string, dateFrom: string, dateTo: string): Promise<ActionResult<ReportData>>
```
- requireSession()
- Вызов calculateReport()

### exportReportXlsx
```typescript
export async function exportReportXlsx(wbAccountId: string, dateFrom: string, dateTo: string): Promise<ActionResult<{ base64: string; filename: string }>>
```
- calculateReport() → генерация xlsx через библиотеку `xlsx`
- Возврат base64 (клиент декодирует и скачивает)

---

## Подзадача 6: Зависимости

```bash
npm install xlsx react-day-picker
```
- `xlsx` (SheetJS) — экспорт Excel
- `react-day-picker` — календарь для DateRangePicker (date-fns уже установлен)

---

## Подзадача 7: Column definitions (`columns.tsx`)

9 групп колонок:
1. **Артикул** (identity) — nmId, subjectName, vendorCode, brandName — always visible
2. **Продажи** — sale, toTransfer, totalToPay, ОП, ОПед, %ОП, ценаСр — default visible
3. **Количество** — выкуплено, выкуп%, безВозврата, возвраты — default visible
4. **Маржинальность** — маржинальность, рентабельность — default visible
5. **Реклама** — баланс, все, ДРР% — default visible
6. **Логистика** — логистика, лог.ед., доставлено, лог.отПродаж% — default visible
7. **Справочники** — внешн.реклама, себест.самовыкупов, кэшбек, суммаСамовыкупов, себестоимость — default visible
8. **Комиссии** — хранение%, хранение, приёмка, доплаты, штрафы, налоги, комиссия, самовыкупы, эквайринг — default visible
9. **Детализация** — 13 столбцов подробной разбивки — **hidden по умолчанию**

Форматирование: `formatRub()` для денег, `formatPercent()` для процентов, `toLocaleString('ru-RU')` для количеств.

---

## Подзадача 8: Report table (`report-table.tsx`)

- **Frozen columns:** первые 3 col (nmId, категория, артикул) — `position: sticky; left: 0; z-index: 10`
- **Горизонтальный скролл:** `overflow-x: auto` на контейнере
- **Summary row:** `<tfoot>` с итогами, sticky top, выделенный фон
- **TanStack React Table** с `columnVisibility` state для show/hide групп

---

## Подзадача 9: Client component (`reports-client.tsx`)

- **DateRangePicker:** react-day-picker + @radix-ui/react-popover (уже установлен)
- **Кнопка «Синхронизировать»:** useTransition → syncReportsAction → toast с результатом
- **Toggle групп колонок:** Dropdown с чекбоксами → управление columnVisibility
- **Экспорт Excel:** кнопка → exportReportXlsx → decode base64 → скачивание через `<a>` blob

---

## Подзадача 10: Server page (`page.tsx`)

Перезаписать placeholder. Паттерн как `cards/page.tsx`:
1. `searchParams: Promise<{ account?, dateFrom?, dateTo? }>`
2. Resolve wbAccountId (fallback на первый активный)
3. Дефолтный период: 1-е число текущего месяца → сегодня
4. `getReportData(wbAccountId, dateFrom, dateTo)`
5. Передать данные в `ReportsClient`

---

## Порядок реализации (подзадачи)

| Шаг | Подзадача | Зависимости |
|-----|-----------|-------------|
| 1 | Установка npm-пакетов (xlsx, react-day-picker) | — |
| 2 | Типы (`src/types/reports.ts`) | — |
| 3 | WB API fetch (`src/lib/wb-api/reports.ts`) | Типы |
| 4 | Sync service (`src/lib/services/sync-reports.ts`) | Типы, WB API fetch |
| 5 | Report calculator (`src/lib/services/report-calculator.ts`) | Типы |
| 6 | Server actions (`src/lib/actions/reports.ts`) | Sync service, Calculator |
| 7 | Column definitions (`columns.tsx`) | Типы |
| 8 | Report table (`report-table.tsx`) | Column definitions |
| 9 | Client component (`reports-client.tsx`) | Table, Actions |
| 10 | Server page (`page.tsx`) | Всё выше |

---

## Верификация

1. `npm run type-check` — без ошибок TypeScript
2. `npm run dev` → `/reports` — страница рендерится с DateRangePicker
3. Выбрать период → «Синхронизировать» → данные загружаются (проверить в БД)
4. Таблица отображает 52 столбца с группировкой по nmId
5. Toggle групп скрывает/показывает колонки
6. Frozen columns работают при горизонтальном скролле
7. Summary row содержит корректные итоги
8. Экспорт Excel скачивает .xlsx файл с данными
9. Проверить edge cases: пустой период, артикул без себестоимости, деление на 0

---

## Edge cases

- **Деление на 0:** `safeDivide()` хелпер — возвращает "0.00"
- **Нет данных:** пустое состояние с подсказкой синхронизировать
- **BigInt rrdId:** `Number()` при сериализации (безопасно для WB rrd_id)
- **Нет себестоимости:** costPrice = 0, маржинальность показывает прочерк
- **ExternalAd без vendorCode:** учитывается только в summary row
- **Таймаут синхронизации:** при 20 страницах = ~20 мин. Self-hosted, нет лимита. Phase 8 переведёт на Bull MQ workers
- **Повторная синхронизация:** `createMany({ skipDuplicates: true })` — идемпотентно
