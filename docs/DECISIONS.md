# docs/DECISIONS.md — Архив архитектурных решений

Полный лог всех отклонений от спецификации, реализованных в каждой фазе,
и проблем, с которыми столкнулись. Для текущей работы — см. CLAUDE.md.

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

## Известные ограничения / технический долг

- **СПП% отображается некорректно** до синхронизации отчётов реализации (Фаза 5).
  Поле `spp` сейчас хранит `discountedPrice`, а не процент. Ожидаемое поведение.
- **Клиентская пагинация в /references** — загружает все записи кабинета разом.
  Для больших объёмов нужна серверная пагинация (Фаза 9).
- **Bull MQ не используется** — фоновая синхронизация запланирована в Фазе 8.
  Сейчас синхронизация блокирующая (в Server Action).
