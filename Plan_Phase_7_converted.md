# Phase 7: Рекламные кампании

## Статус после проверки 2026-03-30

- Подзадачи 1-11: ✅ реализованы
- Локальная проверка: `npm run type-check` ✅
- Prisma schema check: `npx prisma validate` ✅
- Полный `npm run lint`: ⚠️ не зелёный по репозиторию из-за уже существующих ошибок вне Phase 7 (`reports`, `sales-plan`, `cards`)
- Живая проверка на реальном WB-аккаунте: ⏳ не выполнялась в этой сессии
- Важный незакрытый пункт: в API-слое уже есть `pauseCampaign`, но в actions/UI Phase 7 пауза кампании пока не выведена

## Context

Фазы 0–6 завершены. Фаза 7 реализует раздел «Рекламные кампании» (`/advertising`).

Текущий `page.tsx` — заглушка. В Prisma schema уже есть модели `AdCampaign`, `AdCampaignStat`, `AdCampaignCluster`; нужно добавить только `AdActionLog` для журнала.

Домен `advert` с rate limit 200ms уже определён в `constants.ts`.

Цель: список кампаний → детализация с 4 вкладками (Статистика, Кластеры, Разбивка, Журнал) + управление (ставка, пополнение, пауза/запуск).

---

## Subtask 1 — Prisma: добавить `AdActionLog`

**Файл:** `prisma/schema.prisma`

```prisma

model AdActionLog {

  id          String   @id @default(uuid())

  campaignId  String

  action      String   // "bid_change" | "start" | "stop" | "deposit"

  valueBefore Decimal? @db.Decimal(10, 2)

  valueAfter  Decimal? @db.Decimal(10, 2)

  note        String?

  createdAt   DateTime @default(now())

  campaign    AdCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId])

  @@index([createdAt])

  @@map("ad_action_logs")

}

```

Добавить `actionLogs AdActionLog[]` в модель `AdCampaign`.

После изменений: `npm run db:push` + `npx prisma generate`.

---

## Subtask 2 — Типы

**Новый файл:** `src/types/advertising.ts`

Содержимое:

- WB API response types (snake_case): `WbAdvertListItem`, `WbFullStatsDayItem`, `WbFullStatsCampaign`, `WbFullStatsResponse`, `WbClusterStatsRequest/Response`, `WbUpdHistoryItem`

- Internal types (camelCase): `AdCampaignRow`, `AdCampaignDetail`, `AdStatRow`, `AdClusterRow`, `AdActionLogRow`

- `AdDailyMetrics` — агрегированный объект на дату (searchViews/Clicks/..., recoViews/Clicks/..., totals, cpo, bid)

- `AdCampaignMetrics` — { daily[], totals{} }

- `AdSyncResult`, `AdStatsSyncResult`

- Константы: `AD_STATUS_LABELS`, `AD_STATUS_VARIANT`

WB статусы (уточнены по актуальной WB promotion docs): -1=удалена, 4=готова, 7=завершена, 8=отклонена, 9=активна, 11=пауза.

---

## Subtask 3 — WB API layer

**Новый файл:** `src/lib/wb-api/advertising.ts`

Функции (паттерн: `src/lib/wb-api/analytics.ts`):

- `fetchAdvertList(client, status?)` — `GET /adv/v2/adverts?status=...`

- `fetchFullStats(client, advertId, dateFrom, dateTo)` — `POST /adv/v3/fullstats` body `[{id, dates}]`

- `fetchClusterStats(client, advertId, dateFrom, dateTo)` — `POST /adv/v1/normquery/stats`

- `fetchUpdHistory(client, advertId)` — `GET /adv/v1/upd?id=advertId`

- `setBid(client, advertId, cpm)` — `PATCH /api/advert/v1/bids` body `[{advertId, cpm}]`

- `depositBudget(client, advertId, sum, type)` — `POST /adv/v1/budget/deposit`

- `startCampaign(client, advertId)` — `GET /adv/v0/start?id=advertId`

- `stopCampaign(client, advertId)` — `GET /adv/v0/stop?id=advertId`

**Ключевые детали:**

- `fetchFullStats`: appType 1=поиск, 32=рекомендации (верифицировать на живых данных — в spec написано 128, реальный ответ WB может отличаться)

- `PATCH /api/advert/v1/bids` — путь `/api/advert/v1/bids` передаётся в `client.request` с `method: 'PATCH'`

---

## Subtask 4 — Sync services

**Новые файлы:**

- `src/lib/services/sync-ad-campaigns.ts`

  - `syncAdCampaigns(wbAccountId)` → decrypt key → `fetchAdvertList` → `upsert` по `[wbAccountId, advertId]`

- `src/lib/services/sync-ad-stats.ts`

  - `syncAdStats({ wbAccountId, campaignId, advertId, dateFrom, dateTo })` → `fetchFullStats` → создаёт строки source="search"|"recommendations"|"total" → `upsert` по `[campaignId, date, source]`

- `src/lib/services/sync-ad-clusters.ts`

  - `syncAdClusters(wbAccountId, campaignId, advertId, dateFrom, dateTo)` → `fetchClusterStats` → delete-then-createMany для указанного периода

---

## Subtask 5 — Server Actions

**Новый файл:** `src/lib/actions/advertising.ts`

```

getCampaignsAction(wbAccountId)          → AdCampaignRow[]

syncCampaignsAction(wbAccountId)         → AdSyncResult

getCampaignDetailAction(campaignId)      → AdCampaignDetail

getCampaignStatsAction(id, from, to)     → AdStatRow[]

syncCampaignStatsAction(id, from, to)    → AdStatsSyncResult

getCampaignClustersAction(id, from, to)  → AdClusterRow[]

syncCampaignClustersAction(id, from, to) → { synced }

setBidAction(campaignId, cpm)            → void + AdActionLog.create

depositBudgetAction(campaignId, amount)  → void + AdActionLog.create

startCampaignAction(campaignId)          → void + AdActionLog.create + WbAccount status update

stopCampaignAction(campaignId)           → void + AdActionLog.create

getCampaignLogAction(campaignId)         → AdActionLogRow[] (DB + WB upd history merged)

exportAdStatsXlsxAction(id, from, to)   → { base64, filename }

```

Management actions: вызов WB API → при успехе `AdActionLog.create` → return `{ success: true }`.

---

## Subtask 6 — Список кампаний

**Файлы:**

- `src/app/(dashboard)/advertising/page.tsx` — Server Component, читает wbAccountId из searchParams, вызывает `getCampaignsAction`

- `src/app/(dashboard)/advertising/advertising-client.tsx` — Client Component

**UI advertising-client:**

- Фильтр-табы: Все | Активные | Пауза | Завершённые

- Кнопка «Синхронизировать» → `syncCampaignsAction` → refetch

- Таблица: Название, Статус (Badge), Бюджет, Размещение (иконки поиск/рекомендации)

- Клик по строке → `router.push('/advertising/[campaignId]?account=...')`

- Empty state

---

## Subtask 7 — Детализация: шапка + таб-шелл

**Файлы:**

- `src/app/(dashboard)/advertising/[campaignId]/page.tsx` — Server Component

- `src/app/(dashboard)/advertising/[campaignId]/campaign-detail-client.tsx` — Client Component

**Шапка управления:**

- Название + Badge статуса

- Input CPM + «Установить» → `setBidAction` → toast

- Input суммы + «Пополнить» → `depositBudgetAction` → toast

- «Возобновить» (status 4/11) → `startCampaignAction` | «Завершить» (status 9) → `stopCampaignAction`

- Ссылка «← К кампаниям»

**4 вкладки** через shadcn/ui `Tabs`: Статистика | Кластеры | Разбивка | Журнал

---

## Subtask 8 — Вкладка «Статистика»

**Файлы:**

- `src/app/(dashboard)/advertising/[campaignId]/stats-tab.tsx`

- `src/app/(dashboard)/advertising/[campaignId]/ad-metrics-rows.ts`

- `src/app/(dashboard)/advertising/[campaignId]/ad-stats-grid.tsx`

**ad-metrics-rows.ts** — 9 метрик с accessor/formatter (паттерн `plan-metrics-rows.ts`):

Затраты, CPO, Ставка, Просмотры, CTR, Переходы, Корзины, Заказы, CPC

**ad-stats-grid.tsx** — перевёрнутая таблица (паттерн `article-detail-grid.tsx`):

- Строки = метрики, столбцы = даты

- Sticky «Метрика» колонка слева + «Итого» справа

- Подсветка сегодняшней даты голубым

- Props: `daily: AdDailyMetrics[]`, `totals`

**stats-tab.tsx** — Client Component:

- `DateRangePicker` (default: последние 30 дней)

- «Синхронизировать» → `syncCampaignStatsAction` → `getCampaignStatsAction` → конвертировать `AdStatRow[]` → `AdDailyMetrics[]`

- Конвертация: group by date, source="search"→search*, source="recommendations"→reco*, source="total"→total*, CPO = spend/orders

- Кнопка «Экспорт Excel» → `exportAdStatsXlsxAction`

---

## Subtask 9 — Вкладка «Кластеры»

**Файл:** `src/app/(dashboard)/advertising/[campaignId]/clusters-tab.tsx`

- `DateRangePicker`

- «Синхронизировать» → `syncCampaignClustersAction` → `getCampaignClustersAction`

- Стандартная сортируемая таблица (не перевёрнутая):

  `Кластер | CTR | Поз. | Показы | Клики | Корзина | Заказы | CPM`

- Сортировка по клику на заголовок (паттерн из `plan-detail-client.tsx`)

---

## Subtask 10 — Вкладка «Разбивка»

**Файлы:**

- `src/app/(dashboard)/advertising/[campaignId]/breakdown-tab.tsx`

- `src/app/(dashboard)/advertising/[campaignId]/ad-breakdown-grid.tsx`

**ad-breakdown-grid.tsx** — перевёрнутая таблица с двойными подколонками:

```

| Метрика | Итого П | Итого Р | [d1] П | [d1] Р | [d2] П | [d2] Р | ...

```

**Тултип** (при наведении на Затраты/Просмотры/Переходы/Корзины/Заказы):

- Показывает «П: 68% / Р: 32%» (searchValue/totalValue * 100)

- Реализация через `createPortal` + `getBoundingClientRect()` (паттерн из `wb-article-link.tsx`)

Данные те же, что в Статистике — повторный вызов `getCampaignStatsAction` или шаринг state через родителя.

---

## Subtask 11 — Вкладка «Журнал»

**Файл:** `src/app/(dashboard)/advertising/[campaignId]/log-tab.tsx`

- При активации вкладки: `getCampaignLogAction(campaignId)` (объединяет `AdActionLog` из DB + WB `upd` history)

- Таблица: Дата | Действие | До | После | Примечание

- Сортировка по дате убывающей

---

## Порядок реализации

```

1 (Schema) → 2 (Types) → 3 (WB API) → 4 (Services) → 5 (Actions)

                                                             ↓

                                              6 (List) → 7 (Detail shell)

                                                             ↓

                                         8 (Статистика) ─┐

                                         9 (Кластеры)   ─┤→ параллельно

                                        10 (Разбивка)   ─┤

                                        11 (Журнал)     ─┘

```

Excel export реализуется в конце Subtask 8 как часть `advertising.ts` actions.

---

## Критические файлы

| Файл | Действие |

|------|----------|

| `prisma/schema.prisma` | Добавить `AdActionLog` + relation |

| `src/types/advertising.ts` | Создать |

| `src/lib/wb-api/advertising.ts` | Создать |

| `src/lib/services/sync-ad-campaigns.ts` | Создать |

| `src/lib/services/sync-ad-stats.ts` | Создать |

| `src/lib/services/sync-ad-clusters.ts` | Создать |

| `src/lib/actions/advertising.ts` | Создать |

| `src/app/(dashboard)/advertising/page.tsx` | Заменить заглушку |

| `src/app/(dashboard)/advertising/advertising-client.tsx` | Создать |

| `src/app/(dashboard)/advertising/[campaignId]/page.tsx` | Создать |

| `src/app/(dashboard)/advertising/[campaignId]/campaign-detail-client.tsx` | Создать |

| `src/app/(dashboard)/advertising/[campaignId]/ad-stats-grid.tsx` | Создать |

| `src/app/(dashboard)/advertising/[campaignId]/ad-breakdown-grid.tsx` | Создать |

**Паттерны для повторного использования:**

- `src/app/(dashboard)/sales-plan/[planId]/article-detail-grid.tsx` → основа для `ad-stats-grid` и `ad-breakdown-grid`

- `src/app/(dashboard)/sales-plan/[planId]/plan-metrics-rows.ts` → основа для `ad-metrics-rows.ts`

- `src/components/wb-article-link.tsx` → `createPortal` паттерн для тултипа в Разбивке

- `src/components/date-range-picker.tsx` → DateRangePicker в каждой вкладке

- `src/lib/wb-api/analytics.ts` → паттерн batch/fetch для `advertising.ts`

- `src/lib/actions/sales-plan.ts` → паттерн Server Actions для `advertising.ts`

---

## Верификация

1. **Schema:** `npx prisma studio` → убедиться что `ad_action_logs` создана

2. **WB API:** `scripts/debug-advertising.ts` → fetchAdvertList + fetchFullStats на живом аккаунте, залогировать `appType` в ответе

3. **Список:** открыть `/advertising?account=...` → Синхронизировать → кампании появились

4. **Статистика:** открыть детализацию → Синхронизировать за 7 дней → таблица с 9 метриками × даты, проверить CPO вручную

5. **Разбивка:** тултип «68% / 32%» при наведении на ячейку Затрат

6. **Журнал:** setBidAction → проверить строку в `AdActionLog` + вкладка Журнал показывает запись

7. **Excel:** скачать → 2 листа (Статистика, Кластеры) с корректными данными

---

## Итог проверки фазы 7

### 1. Что сделано

- Реализованы schema/types/WB API/services/server actions для рекламных кампаний.
- Собран раздел `/advertising` со списком кампаний, фильтрами и синхронизацией.
- Собрана детализация `/advertising/[campaignId]` с вкладками `Статистика`, `Кластеры`, `Разбивка`, `Журнал`.
- Добавлены действия управления: изменение ставки, пополнение бюджета, запуск, завершение, журнал действий, Excel-экспорт.
- После проверки актуализированы статусы WB и поправлены расхождения исходного плана с реальной реализацией.

### 2. Что работает

- `npm run type-check` проходит.
- `npx prisma validate` проходит.
- Реализован полный локальный data flow: sync кампаний → sync статистики/кластеров → чтение detail/log/export.
- Вкладки `Статистика`, `Кластеры`, `Разбивка`, `Журнал` подключены и не содержат заглушек.
- Тип ставки отображается на русском (`Ручная` / `Единая`).

### 3. Что осталось доделать

- Провести живую проверку на реальном WB-аккаунте по чек-листу ниже.
- Довывести в UI/actions отдельное действие `Пауза`, так как сейчас в интерфейсе есть только `Возобновить / Завершить`.
- При желании добавить отдельный debug-скрипт для ручной верификации advert endpoints и `appType` в `fullstats`.

### 4. Есть ли известные баги

- Да, отдельное багфикс-ревью ещё впереди; Phase 7 сейчас считается функционально собранной, но не финально отполированной.
- `pauseCampaign` уже есть в WB API слое, но не доведён до server actions и UI, поэтому сценарий паузы кампании пока не закрыт.
- После `depositBudgetAction` бюджет локально увеличивается оптимистично; без повторной синхронизации кампаний возможна временная рассинхронизация с фактическим бюджетом WB.
- Полный `npm run lint` сейчас падает из-за уже существующих ошибок вне Phase 7, поэтому репозиторий в целом ещё не находится в полностью зелёном состоянии.
