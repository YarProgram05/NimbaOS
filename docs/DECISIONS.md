# Decisions

Канонический журнал продуктовых и архитектурных решений NimbaOS. Старые решения не удалять: если решение устарело, пометить его как `Superseded` и добавить новое решение выше.

Формат новых записей:

```md
## YYYY-MM-DD — Decision title

Status:
Active / Superseded / Rejected

Decision:
Какое решение принято.

Reason:
Почему.

Consequences:
Что это меняет.

Related files:
Связанные файлы.
```

---

## 2026-05-05 — Markdown-документация как система памяти Codex

Status:
Active

Decision:
Новая сессия читает только `docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md` и `docs/CURRENT_TASKS.md`. Остальные документы открываются только по типу задачи через `docs/DOCS_INDEX.md`.

Reason:
Проект накопил много истории, и чтение всех `.md` в начале сессии раздувает контекст и повышает риск противоречий.

Consequences:
Оперативный контекст хранится в `docs/HANDOFF.md` и `docs/CURRENT_TASKS.md`; история работы — в `docs/DEV_LOG.md`; состояние — в `docs/PROJECT_STATE.md`; решения — только здесь.

Related files:
`docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md`, `docs/CURRENT_TASKS.md`, `docs/SESSION_PROTOCOL.md`

---

## 2026-05-05 — Product specification lives in docs/SPECIFICATION.md

Status:
Active

Decision:
Хранить стабильную продуктовую спецификацию в `docs/SPECIFICATION.md`, а не в корне проекта.

Reason:
Спецификация является важным документом разработки и частью памяти агента. Ей логично находиться рядом с `docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/HANDOFF.md` и остальными рабочими документами.

Consequences:
Задачи про продукт, MVP и бизнес-логику должны ссылаться на `docs/SPECIFICATION.md`. Корневой `README.md` остаётся в корне как стандартный human-facing entrypoint.

Related files:
`docs/SPECIFICATION.md`, `docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `README.md`

---

## 2026-05-05 — Agent instructions live in docs/AGENTS.md

Status:
Active

Decision:
Хранить главный файл правил агента в `docs/AGENTS.md`, а не в корне проекта.

Reason:
Пользователь хочет держать все инструкции для агента разработки в одной папке `docs`, рядом с handoff, протоколом, индексом и остальной памятью проекта.

Consequences:
Стартовый протокол, README, documentation index и будущие ссылки должны использовать путь `docs/AGENTS.md`. Корневой `AGENTS.md` не восстанавливать без явного запроса.

Related files:
`docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/SESSION_PROTOCOL.md`, `README.md`

---

## 2026-05-05 — Канонический журнал решений находится в docs/DECISIONS.md

Status:
Active

Decision:
Использовать `docs/DECISIONS.md` как единственный канонический файл решений. Корневой `DECISIONS.md` не создавать, если пользователь отдельно не попросит.

Reason:
В проекте уже существовал `docs/DECISIONS.md` с историей решений; перенос в новый корневой файл создал бы дублирование.

Consequences:
Все новые архитектурные и продуктовые решения добавлять сверху в `docs/DECISIONS.md`. `docs/AGENTS.md` и `docs/DOCS_INDEX.md` должны ссылаться именно на этот файл.

Related files:
`docs/DECISIONS.md`, `docs/AGENTS.md`, `docs/DOCS_INDEX.md`

---

## 2026-05-05 — БД является источником истины для аналитики

Status:
Active

Decision:
Аналитика и отчёты читают данные из БД. WB API используется для обновления БД, а не как основной источник каждого отчёта.

Reason:
Повторные API-запросы медленные, нестабильные и подвержены rate limit. Исторические данные должны быть воспроизводимыми.

Consequences:
Перед аналитикой проверять кабинет, период, покрытие периода в БД, дату последней синхронизации и пропущенные даты. Повторная историческая синхронизация требует подтверждения.

Related files:
`docs/DATA_FRESHNESS_POLICY.md`, `docs/DATABASE_ACCESS_GUIDE.md`, `docs/SAFETY_RULES.md`

---

## 2026-05-05 — CLAUDE.md заменён docs/AGENTS.md и docs memory system

Status:
Active

Decision:
Удалить `CLAUDE.md` после переноса уникального смысла в `docs/AGENTS.md` и `docs/*.md`.

Reason:
`CLAUDE.md` дублировал старый большой агентский контекст, смешивал правила, состояние, историю и детали фаз. Для Codex нужна короткая маршрутизируемая память.

Consequences:
Новые сессии используют `docs/AGENTS.md` как главный стартовый файл. Старый исторический контекст сохранён в тематических документах и legacy-блоках этого файла.

Related files:
`docs/AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/PROJECT_STATE.md`, `docs/DEV_LOG.md`

---

## Legacy archive

Ниже сохранён старый архив решений и фазовой истории. Его не читать в начале новой сессии целиком; открывать только при расследовании старых архитектурных решений.

---

## Инфраструктурные решения (Фаза 0)

**1. Tailwind CSS v4 вместо v3**
shadcn@4.1 генерирует CSS под Tailwind v4 (oklch-цвета, `@theme inline`,
`@import "tailwindcss"`). Tailwind v4 не использует `tailwind.config.ts` —
конфиг живёт в `globals.css`.

**2. Prisma 7 — обязательный driver adapter**
URL подключения вынесен в `prisma.config.ts` (не в `schema.prisma`).
Prisma 7 требует adapter: `@prisma/adapter-pg` + `pg`.
Паттерн: `new PrismaPg({ connectionString })` → передать в конструктор.
`new PrismaClient()` без аргументов — ошибка!

**3. Вся Prisma schema создана в Фазе 0**
Спецификация предполагала поэтапное добавление, но все 16 моделей
созданы сразу для целостности FK-связей.

**4. shadcn/ui стиль `default` + цвет `slate`**
Цвета переведены в oklch для совместимости с Tailwind v4.

**5. Node.js 22** (используется 22.16.0, хотя спецификация говорила 20+).

---

## Фаза 1 — Аутентификация и пользователи

Что реализовано:
- NextAuth.js Credentials provider, JWT, maxAge 30 дней, bcryptjs
- Middleware: защита всех роутов кроме /login, /register, /api/auth/*
- Seed-скрипт: ADMIN из ADMIN_EMAIL / ADMIN_PASSWORD (prisma/seed.ts)
- /login с react-hook-form + zod
- DashboardShell (client), Sidebar (collapsible w-64↔w-16), Header
- /admin/users: таблица, InviteDialog, UserRowActions
- /register?token=xxx — валидация токена → регистрация
- checkRole(session, requiredRole) — src/lib/auth/check-role.ts
- Server Actions: src/lib/actions/users.ts

**Решение 6: DashboardShell — `useSession()` вместо `getServerSession` в layout**
`getServerSession` в Server Component layout некорректно прокидывает сессию
при клиентской навигации. Layout — простой враппер; DashboardShell (`'use client'`)
читает сессию через `useSession()` и рендерит skeleton при загрузке.

**Решение 7: Конфликт `app/page.tsx` и `(dashboard)/page.tsx`**
Route groups не добавляют URL-сегмент → оба файла в `/`. Next.js выбирал
`app/page.tsx` первым. Файл `app/page.tsx` удалён — главная теперь только
`(dashboard)/page.tsx`.

**Решение 8: Server Actions для всех мутаций пользователей**
`createInvitation`, `updateUserRole`, `toggleUserActive`, `deleteUser`,
`registerByInvitation` — в `src/lib/actions/users.ts`. API Routes не создавались.

**Решение 9: `checkRole(session, requiredRole)`**
Принимает `Session | null`, возвращает `boolean`.
Иерархия ролей: ADMIN(3) > MANAGER(2) > VIEWER(1).

---

## Фаза 2 — Настройки и кабинеты WB

Что реализовано:
- AES-256-GCM encrypt/decrypt (lib/encryption)
- WB API клиент с retry, rate limiting, WbApiError, WbRateLimitError
- /settings: Профиль + Кабинеты WB (добавить/удалить/налоговая ставка)
- AccountSelector dropdown в sidebar, AccountContext в localStorage

**Решение 10: WB API клиент — три уровня:**
- `src/lib/wb-api/client.ts` — WbApiClient(apiKey): HTTP + rate limit + retry
- `src/lib/wb-api/common.ts` — ping(client), getSellerInfo(client)
- `src/lib/wb-api/accounts.ts` — validateAndFetchSellerInfo(apiKey)

**Решение 11: Server Actions для WbAccount**
`src/lib/actions/accounts.ts`: getWbAccounts, addWbAccount, updateTaxRate,
toggleAccountActive, updateUserProfile.

**Решение 12: AccountProvider + useAccount()**
`src/components/providers/account-context.tsx`. Живёт внутри DashboardShell.
Персистируется в `localStorage('wb_selected_account')`.
При деактивации — автоматически на первый доступный.

**Решение 13: /settings — Tabs + router.refresh()**
Мутации через router.refresh() для обновления Server Component.

**Решение 14: Название NimbaOS**
Изменено в layout.tsx, login/page.tsx, sidebar.tsx, package.json.

---

## Фаза 3 — Карточки товаров

Что реализовано:
- WB API: fetchCardsList() + fetchPrices()
- Сервис синхронизации (lib/services/sync-products.ts)
- /cards: кнопка Sync, таблица, поиск, сортировка, пагинация (серверная)

**Решение 15: Prices API v2 возвращает рубли, не копейки**
`/api/v2/list/goods/filter` (prices домен) — цены уже в рублях. Делить на 100 не нужно.
Цены из cards API `/content/v2/get/cards/list` — в копейках, делятся при сохранении,
но используются только как fallback.

**Решение 16: `ProductSize.spp` хранит `discountedPrice`**
Поле `spp` переиспользуется для фактической цены продавца (цена со скидкой).
Настоящий SPP-процент придёт из отчётов реализации в Фазе 5.
Пока SPP% вычисляется обратно: `round((1 - spp/price) * 100)`.

**Решение 17: `ProductSize.price` = базовая цена (до скидки)**
`ProductRow.price` = `price * (1 - discount/100)` — цена которую видит покупатель.
`ProductRow.basePrice` — базовая цена для редактирования.

**Решение 18: Редактирование цены через Popover + WB API**
`updateProductPriceAction` → POST `/api/v2/upload/task` (prices домен) →
оптимистичное обновление в БД. WB обрабатывает асинхронно за несколько секунд.

**Решение 19: Цена с WB Кошельком = 2%**
Константа `WB_WALLET_DISCOUNT = 2` захардкожена в `price-cell.tsx`.

**Решение 20: AccountSelector пушит `?account=id` в URL**
Server Component `/cards/page.tsx` читает параметр и подгружает данные кабинета.
Без этого Server Component не знал бы о выборе (AccountContext — только клиент).

---

## Фаза 4 — Справочники

Что реализовано:
- /references с 4 вкладками: Себестоимость, Самовыкупы, Внешняя реклама, Переименования
- Server Actions: src/lib/actions/references.ts (13 actions)
- VendorCombobox (Popover + Input) для выбора артикула
- URL-персистируемые вкладки (?tab=)
- Клиентская пагинация PAGE_SIZE=20

**Решение 21: Server Actions вместо API Routes для справочников**
Спецификация упоминала API Routes, но правила проекта — Server Actions для CRUD.

**Решение 22: VendorCombobox без cmdk**
`cmdk` и `@radix-ui/react-alert-dialog` не установлены. Combobox = Popover + Input
+ фильтрованный список. Delete confirmation — через Dialog (не AlertDialog).

**Решение 23: Активная вкладка в URL (?tab=)**
router.replace без засорения history.

**Решение 24: `ProductSize.spp` расширен до `@db.Decimal(10, 2)`**
Было `@db.Decimal(5, 2)` (макс 999.99), но поле хранит цены в рублях (тысячи).
Schema обновлена, `db:push` применён.

---

## UX-улучшения и баг-фиксы (пост-Фаза 4, 2026-03-25)

**Решение 25: Sidebar NavLinks включают `?account=id`**
NavContent читает selectedId из useAccount() и добавляет `?account=selectedId`
ко всем ссылкам навигации. Фиксирует баг: переход из /settings, /reports и др.
(без ?account= в URL) показывал первый активный кабинет вместо выбранного.

**Решение 26: Колонка «Наименование» убрана из /cards**
Удалена для экономии пространства. Шрифт таблицы поднят до text-base.
Осталось 5 колонок: Арт. WB, Арт. поставщика, Категория, Бренд, Цена.

**Решение 27: Арт. WB — ссылка + hover-превью фото**
nmId → кликабельная `<a>` на `wildberries.ru/catalog/{nmId}/detail.aspx`.
При наведении — Tooltip с фото (Product.photoUrl). TooltipProvider в columns.tsx.

**Решение 28: Цена — светло-голубой прямоугольник + СПП в ячейке**
bg-sky-50 border-sky-200 rounded-lg. «с СПП (30%) 1300 ₽» прямо в ячейке.
Прямоугольник выровнен по левому краю колонки (inline-flex).

**Решение 29: Пагинация /cards — 100 записей/стр, по центру**
pageSize: 50 → 100. Пагинация: justify-end → justify-center.

**Решение 30: VIEWER не управляет кабинетами WB**
/settings передаёт роль в AccountsSection. При isReadOnly=true скрыты:
кнопка «Добавить кабинет», кнопка удаления, редактирование налоговой ставки.

**Решение 31: Кнопка RefreshCw в попапе цены — активная**
Вызывает refreshProductPriceAction(wbAccountId, nmId) →
GET /api/v2/list/goods/filter?filterNmID=... → обновить БД → вернуть свежие данные.
Добавлена fetchPricesByNmId в src/lib/wb-api/products.ts.

**Решение 32: VendorCombobox — скролл колёсиком внутри диалогов**
onWheel={(e) => e.stopPropagation()} на контейнер списка.
Radix Dialog блокировал wheel-события до достижения overflow-y: auto div.

**Решение 33: VendorCombobox в самовыкупах и внешней рекламе**
self-purchase-tab.tsx и external-ad-tab.tsx: поля артикула были простыми Input,
заменены на VendorCombobox. При редактировании — статичный текст (паттерн cost-price).

---

## Фаза 6 — План продаж

Что реализовано:
- Полный CRUD планов: карточки, создание, детализация, удаление
- Управление артикулами: добавление из остатков / поштучно, inline-редактирование 3 полей, удаление
- Автозаполнение цены/выкупа/продаж из RealizationReport за прошлый месяц
- Синхронизация заказов и продаж (WB Statistics API, lastChangeDate пагинация)
- Аналитика воронки (WB Analytics API, per-nmId per-day)
- Калькулятор ежедневных метрик (10 метрик из 3 источников)
- UI daily grid: перевёрнутая таблица (метрики × даты), sticky-колонки, expand/collapse
- Excel-экспорт: 2 листа (Сводка + Детализация)
- Инкрементальный синк и параллельная воронка

**Решение 34: HTML table вместо TanStack для daily grid**
Перевёрнутая таблица (метрики как строки, даты как колонки) кардинально отличается от стандартной data-table. TanStack Virtual не даёт преимуществ — используется plain HTML `<table>` с sticky positioning через CSS.

**Решение 35: Upsert вместо createMany skipDuplicates для WbFunnelStat**
Данные воронки обновляются при повторном запросе (WB может пересчитать). `upsert` гарантирует актуальность, в отличие от `skipDuplicates`, который пропускает существующие строки.

**Решение 36: Инкрементальный синк orders/sales**
`syncOrders` и `syncSales` перед первым запросом проверяют `MAX(lastChangeDate)` в БД. Если данные уже есть, первый запрос идёт с `flag=1` (только изменения), минуя полную выгрузку. Экономит минуты при повторных синках.

**Решение 37: Параллельная синхронизация воронки**
Funnel (analytics domain, 20s throttle) запускается параллельно с orders+sales (statistics domain, 60s throttle) через `Promise.all`. Экономит время, т.к. домены используют отдельные rate limits.

**Решение 38: Decimal → string для клиентского транспорта**
`plan-calculator.ts` сериализует Decimal-поля как строки (`.toFixed(2)`/`.toFixed(4)`) в `DailyMetrics`. Prisma `Decimal` не сериализуется в JSON напрямую; строки безопасно передаются через Server Action → Client Component.

**Решение 39: `Array.from(new Set(...))` вместо `[...new Set()]`**
TypeScript без `downlevelIteration` не поддерживает spread на `Set`. Используется `Array.from()` как workaround.

**Решение 40: Батчинг nmIds по 20 в fetchFunnelHistory**
WB Analytics API принимает массив nmIds. Разбиваем на чанки по 20 для стабильности (аналогично лимитам WB content API).

---

## Известные ограничения / технический долг

- **СПП% отображается некорректно** до синхронизации отчётов реализации (Фаза 5).
  Поле `spp` сейчас хранит `discountedPrice`, а не процент. Ожидаемое поведение.
- **Клиентская пагинация в /references** — загружает все записи кабинета разом.
  Для больших объёмов нужна серверная пагинация (Фаза 9).
- **Bull MQ не используется** — фоновая синхронизация запланирована в Фазе 8.
  Сейчас синхронизация блокирующая (в Server Action).
## Phase 8 — Background Sync

**Decision 41: Read-only WB sync через Bull MQ**
Все read-only WB sync jobs ставятся в Bull MQ queue `sync`: products, reports + paid storage, sales plan orders/sales/funnel, advertising campaigns/stats/clusters. Server Actions больше не ждут длинные WB-запросы, а создают `SyncJobRun` и возвращают id фоновой задачи.

**Decision 42: WB-changing actions не автоматизируются**
Цены, карточки WB, рекламные ставки, бюджеты и статусы остаются прямыми пользовательскими действиями с явным намерением. Phase 8 scheduler запускает только read-only jobs.

**Decision 43: Осторожное дневное расписание**
`scripts/schedule-sync.ts` создаёт BullMQ Job Schedulers для активных кабинетов в `Europe/Moscow`: карточки ночью, отчёты/хранение rolling 7 days, план продаж rolling 7 days, advertising campaigns и advertising stats. Advertising clusters manual-only by default.
