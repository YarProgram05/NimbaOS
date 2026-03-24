# CLAUDE.md — Инструкции для Claude Code

## Текущее состояние проекта

**Дата последнего обновления:** 2026-03-25
**Следующая задача:** Фаза 2 — Настройки и кабинеты WB

| Фаза | Статус | Описание |
|------|--------|----------|
| Фаза 0 | ✅ ВЫПОЛНЕНО | Инициализация: Next.js, Tailwind, shadcn/ui, Docker, Prisma schema |
| Фаза 1 | ✅ ВЫПОЛНЕНО | Аутентификация, роли, приглашения, dashboard layout |
| Фаза 2 | — | Настройки и кабинеты WB |
| Фаза 3 | — | Карточки товаров |
| Фаза 4 | — | Справочники |
| Фаза 5 | — | Финансовые отчёты |
| Фаза 6 | — | План продаж |
| Фаза 7 | — | Рекламные кампании |
| Фаза 8 | — | Фоновая синхронизация |
| Фаза 9 | — | Финальная доработка |

---

## Принятые решения (отличия от спецификации)

1. **Tailwind CSS v4 вместо v3** — shadcn@4.1 генерирует CSS под Tailwind v4 (oklch-цвета, `@theme inline`, `@import "tailwindcss"`). Tailwind v4 не использует `tailwind.config.ts` — конфиг живёт в `globals.css`.

2. **Prisma 7 вместо классической версии** — URL подключения вынесен в `prisma.config.ts` (не в `schema.prisma`). **Важно:** Prisma 7 использует driver adapters — `PrismaClient` требует `adapter`. Используется `@prisma/adapter-pg` + `pg`. Паттерн: `new PrismaPg({ connectionString: process.env.DATABASE_URL! })` → передать в конструктор. `new PrismaClient()` без аргументов — ошибка.

3. **Вся Prisma schema создана в Фазе 0** — спецификация предполагала поэтапное добавление моделей по фазам, но вся schema (16 моделей) создана сразу для целостности БД и правильных foreign keys.

4. **shadcn/ui стиль `default` + цвет `slate`** — цвета переведены в oklch для совместимости с Tailwind v4.

5. **Node.js 22** вместо 20+ — используемая версия Node.js 22.16.0.

6. **DashboardShell использует `useSession()` (client), а не `getServerSession` в layout** — в Next.js App Router `getServerSession` в Server Component layout не всегда корректно прокидывает сессию при клиентской навигации. Layout (`(dashboard)/layout.tsx`) — простой враппер без логики; `DashboardShell` (`'use client'`) сам читает сессию через `useSession()` и рендерит skeleton при загрузке.

7. **Конфликт `app/page.tsx` и `(dashboard)/page.tsx`** — Route groups (`(dashboard)`) не добавляют URL-сегмент, поэтому оба файла разрешаются в `/`. Next.js выбирает `app/page.tsx` первым. Файл `app/page.tsx` из Фазы 0 (содержал `redirect('/login')`) был удалён — главная страница теперь только `(dashboard)/page.tsx`.

8. **Server Actions для всех мутаций пользователей** — `createInvitation`, `updateUserRole`, `toggleUserActive`, `deleteUser`, `registerByInvitation` реализованы как Server Actions в `src/lib/actions/users.ts`. API Routes не создавались.

9. **`checkRole(session, requiredRole)`** — утилита в `src/lib/auth/check-role.ts`. Принимает `Session | null`, возвращает `boolean`. Используется и в Server Components (`getServerSession` → `checkRole`), и в Server Actions. Иерархия ролей: ADMIN(3) > MANAGER(2) > VIEWER(1).

---

## О проекте

Ты разрабатываешь **WB Cabinet Digitizer** — закрытую веб-платформу для оцифровки кабинетов продавца на Wildberries. Полная спецификация проекта находится в файле `SPECIFICATION.md` — прочитай его перед началом любой работы.

---

## Ключевые принципы

1. **Читай SPECIFICATION.md перед каждой задачей.** Не полагайся на память — всегда сверяйся со спецификацией.
2. **Не делай всё сразу.** Работай итеративно, по фазам. Каждая фаза — работающий инкремент.
3. **Пиши типобезопасный код.** TypeScript strict mode. Prisma для типизации БД.
4. **Тестируй API-интеграции.** WB API имеет строгие лимиты — всегда используй rate limiting и retry.
5. **Шифруй API-ключи.** Никогда не храни их в открытом виде.

---

## Стек и инструменты

- **Runtime:** Node.js 20+
- **Framework:** Next.js 14+ (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict)
- **DB:** PostgreSQL 16 + Prisma ORM
- **Cache/Queue:** Redis + Bull MQ
- **UI:** Tailwind CSS + shadcn/ui + Recharts
- **Auth:** NextAuth.js (Credentials provider)
- **Deploy:** Docker Compose (Nginx → Next.js → PostgreSQL → Redis)

---

## Фазы реализации

### ✅ Фаза 0: Инициализация проекта — ВЫПОЛНЕНО
```
Задачи:
1. Создать Next.js 14 проект с App Router и TypeScript
2. Настроить Tailwind CSS + shadcn/ui
3. Настроить Prisma + PostgreSQL (docker-compose.yml для dev)
4. Настроить Redis (docker-compose.dev.yml)
5. Структура папок:
   src/
   ├── app/                    # Next.js App Router pages
   │   ├── (auth)/            # Группа для login/register
   │   ├── (dashboard)/       # Основной layout с sidebar
   │   │   ├── cards/         # Карточки товаров
   │   │   ├── reports/       # Отчёты
   │   │   ├── sales-plan/    # План продаж
   │   │   ├── references/    # Справочники
   │   │   ├── advertising/   # Реклама
   │   │   ├── settings/      # Настройки
   │   │   └── admin/         # Управление пользователями
   │   └── api/               # API Routes
   ├── components/            # Переиспользуемые компоненты
   │   ├── ui/               # shadcn/ui компоненты
   │   ├── layout/           # Sidebar, Header
   │   └── shared/           # DataTable, DateRangePicker, etc
   ├── lib/                  # Утилиты и сервисы
   │   ├── wb-api/           # WB API клиент
   │   ├── auth/             # NextAuth конфиг
   │   ├── db/               # Prisma client
   │   ├── encryption/       # AES-256 для API ключей
   │   ├── queue/            # Bull MQ jobs
   │   └── utils/            # Форматирование, расчёты
   ├── types/                # TypeScript типы
   └── prisma/
       ├── schema.prisma
       └── migrations/
6. Создать docker-compose.dev.yml (PostgreSQL + Redis)
7. Создать .env.example с описанием всех переменных
```

### ✅ Фаза 1: Аутентификация и пользователи — ВЫПОЛНЕНО
```
Реализовано:
1. Prisma schema: User, Invitation (вся schema создана в Фазе 0)
2. NextAuth.js с Credentials provider (src/lib/auth/index.ts)
   - JWT стратегия, maxAge 30 дней
   - bcryptjs для хэширования паролей
3. Middleware: защита всех маршрутов кроме /login, /register, /api/auth/*
4. Seed-скрипт: ADMIN из ADMIN_EMAIL / ADMIN_PASSWORD (prisma/seed.ts)
5. Страница /login — форма с react-hook-form + zod
6. Dashboard layout:
   - DashboardShell (client) — управляет состоянием sidebar
   - Sidebar — collapsible (w-64 ↔ w-16), мобильный Sheet, AccountSelector stub
   - Header — DropdownMenu с logout (signOut)
   - Placeholder страницы: /cards, /reports, /sales-plan, /references, /advertising, /settings
7. Страница /admin/users (только ADMIN):
   - Таблица: имя, email, роль (Badge), статус (Badge), дата создания
   - InviteDialog: выбор роли → одноразовая ссылка /register?token=xxx (7 дней)
   - UserRowActions: изменить роль (submenu), деактивировать, удалить
8. Страница /register?token=xxx — валидация токена, регистрация, redirect → /login
9. checkRole(session, requiredRole) — src/lib/auth/check-role.ts
10. Server Actions: src/lib/actions/users.ts
```

### Фаза 2: Настройки и кабинеты WB
```
Задачи:
1. Prisma schema: WbAccount
2. Модуль шифрования (lib/encryption): AES-256-GCM encrypt/decrypt
3. WB API клиент (lib/wb-api/client.ts):
   - Базовый HTTP клиент с retry, rate limiting, error handling
   - Автоматическое добавление Authorization header
   - Обработка 429 с учётом X-Ratelimit-Retry
4. Страница /settings:
   - Профиль: имя
   - Кабинеты WB: список → добавить (название + API ключ)
   - При добавлении: запрос /ping → если OK → /api/v1/seller-info → сохранить
   - Удаление кабинета
   - Налоговая ставка (%) для каждого кабинета
5. Компонент AccountSelector — dropdown выбора кабинета (глобальный в sidebar)
```

### Фаза 3: Карточки товаров
```
Задачи:
1. Prisma schema: Product, ProductSize, ProductMaterial
2. WB API модуль (lib/wb-api/products.ts):
   - fetchCardsList(): POST /content/v2/get/cards/list (пагинация через cursor)
   - fetchPrices(): GET /api/v2/list/goods/filter
3. Сервис синхронизации (lib/services/sync-products.ts):
   - Получить все карточки → upsert в БД
   - Получить цены → обновить в БД
4. Страница /cards:
   - Кнопка "Синхронизировать"
   - Таблица: nmId, Артикул, Категория, Бренд, Цена
   - Поиск, сортировка, пагинация (серверная)
   - Фильтры: по бренду, категории
```

### Фаза 4: Справочники
```
Задачи:
1. Prisma schema: CostPrice, SelfPurchase, ExternalAd, ArticleOverride
2. Страница /references с вкладками (Tabs):
   a) Себестоимость: DataTable + AddDialog + EditDialog + DeleteConfirm
   b) Самовыкупы: DataTable + CRUD
   c) Внешняя реклама: DataTable + CRUD
   d) Переименования: DataTable + CRUD
3. API Routes для каждой сущности:
   - GET /api/references/cost-price
   - POST /api/references/cost-price
   - PUT /api/references/cost-price/[id]
   - DELETE /api/references/cost-price/[id]
   (аналогично для остальных)
4. Импорт из CSV (опционально, но полезно)
```

### Фаза 5: Финансовые отчёты
```
Задачи:
1. Prisma schema: RealizationReport
2. WB API модуль (lib/wb-api/reports.ts):
   - fetchRealizationReport(): GET /api/v5/supplier/reportDetailByPeriod
     ВАЖНО: пагинация через rrdid. Загружать ВСЕ страницы до ответа 204.
     Лимит: 1 req/min. Использовать Bull MQ для фоновой загрузки.
3. Сервис расчётов (lib/services/report-calculator.ts):
   - Все формулы из SPECIFICATION.md, секция 6.5
   - Группировка по nmId
   - Обогащение данными из справочников (себестоимость, самовыкупы, внешняя реклама)
   - Расчёт налогов (taxRate из WbAccount)
4. Страница /reports:
   - DateRangePicker для периода
   - Кнопка "Синхронизировать" → Bull MQ job → прогресс-бар
   - Таблица с 52 столбцами (горизонтальный скролл, закреплённые первые колонки)
   - Итоговая строка сверху
   - Экспорт в Excel (.xlsx)
   - Колонки сгруппированы, можно показать/скрыть
```

### Фаза 6: План продаж
```
Задачи:
1. Prisma schema: SalesPlan, SalesPlanItem
2. WB API модули:
   - fetchOrders(): GET /api/v1/supplier/orders (пагинация через lastChangeDate)
   - fetchSales(): GET /api/v1/supplier/sales (аналогично)
   - fetchSalesFunnel(): POST /api/analytics/v3/sales-funnel/products/history
   - fetchAdFullStats(): GET /adv/v3/fullstats
3. Страница /sales-plan:
   - Список планов → кнопка "Создать план"
   - Модалка создания: название, описание, даты, ДРР%
   - Добавление артикулов: "Из остатков" / "По-отдельности"
4. Страница /sales-plan/[id]:
   - Шапка: название, период, ДРР%, кнопка "Получить данные" (Сегодня / Полная / Выбор периода)
   - Верхняя строка — агрегаты (ПЛАН/МЕС, ФАКТ/МЕС, ПЛАН/ДЕНЬ, ФАКТ/ДЕНЬ)
   - Далее по строкам: показатели (как на скрине)
   - Колонки: даты (горизонтальный скролл)
   - Раскрытие артикула: показатели детализации
5. Расчёт СПП:
   - Из RealizationReport брать среднее ppvz_spp_prc за последние 14 дней по nmId
   - Цена с СПП = price * (1 - avg_spp/100)
```

### Фаза 7: Рекламные кампании
```
Задачи:
1. Prisma schema: AdCampaign, AdCampaignStat, AdCampaignCluster
2. WB API модули (lib/wb-api/advertising.ts):
   - fetchCampaignsList(): GET /adv/v1/promotion/count
   - fetchCampaignsInfo(): GET /api/advert/v2/adverts
   - fetchFullStats(): GET /adv/v3/fullstats
   - fetchNormQueryStats(): POST /adv/v0/normquery/stats
   - fetchNormQueryStatsByDay(): POST /adv/v1/normquery/stats
   - fetchNormQueryList(): POST /adv/v0/normquery/list
   - fetchBalance(): GET /adv/v1/balance
   - fetchBudget(): GET /adv/v1/budget
   - depositBudget(): POST /adv/v1/budget/deposit
   - updateBids(): PATCH /api/advert/v1/bids
   - pauseCampaign(): GET /adv/v0/pause
   - startCampaign(): GET /adv/v0/start
   - stopCampaign(): GET /adv/v0/stop
3. Страница /advertising:
   - Список кампаний: название, статус, тип, дата создания
   - Фильтры по статусу (активна, на паузе, завершена, все)
4. Страница /advertising/[id]:
   - Шапка: Ставка CPM + "Установить", Пополнение + "Пополнить"
   - Кнопки: Возобновить / Завершить
   - Статус справа
   - 4 вкладки:
   
   a) Статистика:
      - Таблица: Наименование | Всего | по датам...
      - Строки: Затраты, CPO, Ставка, Просмотры, CTR, Переходы, Корзины, Заказы, CPC
      - Источник: fullstats
   
   b) Кластеры:
      - DateRangePicker
      - Таблица: Кластер, CTR, Поз, Показы, Клики, Корзина, Заказы, CPM
      - Источник: normquery/stats + normquery/list
   
   c) Разбивка:
      - Колонки: дата → П (поиск) | Р (рекомендации)
      - Строки: Затраты, CPO, Ставка, Просмотры, CTR, Переходы, Корзины, Заказы, CPC
      - Источник: fullstats → appType: 1 = поиск, 128 = рекомендации
      - ТУЛТИП: при наведении на Затраты/Просмотры/Переходы/Корзины/Заказы
        показать % трафика: поиск vs полки (из appType breakdown)
   
   d) Журнал:
      - Лог действий: изменения ставок, паузы, запуски, пополнения
      - Источник: GET /adv/v1/upd + локальный лог из БД
```

### Фаза 8: Фоновая синхронизация и очереди
```
Задачи:
1. Bull MQ конфигурация (lib/queue/):
   - sync-products — синхронизация карточек (каждые 6 часов)
   - sync-realization — загрузка отчётов реализации (по запросу + ежедневно)
   - sync-orders — загрузка заказов (каждые 30 мин)
   - sync-sales — загрузка продаж (каждые 30 мин)
   - sync-campaigns — загрузка списка кампаний и статистики (каждый час)
2. Обработчики (workers):
   - Rate limiting на уровне воркера
   - Retry с exponential backoff
   - Логирование ошибок
3. Dashboard для мониторинга очередей (опционально: bull-board)
```

### Фаза 9: Финальная доработка
```
Задачи:
1. Экспорт отчётов в Excel (xlsx)
2. Responsive дизайн (mobile-friendly sidebar)
3. Loading states и skeleton screens
4. Error boundaries
5. Оптимизация: серверная пагинация во всех таблицах
6. Docker build для продакшна
7. nginx.conf с SSL
8. CI: eslint + type-check
```

---

## WB API — Критические заметки

### Rate Limiting
```typescript
// Пример rate limiter для WB API
// Контент: 100 req/min → задержка 600ms между запросами
// Статистика: 1 req/min → задержка 60s
// Реклама: 5 req/sec → задержка 200ms

class WbApiClient {
  private async request(url: string, options: RequestInit) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('X-Ratelimit-Retry');
      await sleep(Number(retryAfter) * 1000 || 5000);
      return this.request(url, options); // retry
    }
    
    return response;
  }
}
```

### Пагинация reportDetailByPeriod
```
ВАЖНО: Загрузка отчёта реализации требует МНОЖЕСТВО запросов.
- Лимит: 1 req/min
- Пагинация: rrdid из последней строки → следующий запрос
- Остановка: когда вернётся 204 (нет данных)
- Рекомендуется: Bull MQ job, который постепенно загружает все страницы
```

### Пагинация orders/sales
```
ВАЖНО: Используй lastChangeDate из последней строки ответа для следующего запроса.
Ограничение: ~80000 строк за запрос.
Если пустой массив [] — все данные загружены.
```

### Домены API
```typescript
const WB_API_DOMAINS = {
  content: 'https://content-api.wildberries.ru',
  prices: 'https://discounts-prices-api.wildberries.ru',
  statistics: 'https://statistics-api.wildberries.ru',
  analytics: 'https://seller-analytics-api.wildberries.ru',
  advert: 'https://advert-api.wildberries.ru',
  common: 'https://common-api.wildberries.ru',
  finance: 'https://finance-api.wildberries.ru',
  marketplace: 'https://marketplace-api.wildberries.ru',
  documents: 'https://documents-api.wildberries.ru',
} as const;
```

---

## Правила кода

1. **Не используй `any`** — всегда типизируй. Создавай типы в `src/types/`.
2. **Server Components по умолчанию.** Client Components (`"use client"`) только когда нужен state/effects.
3. **Server Actions для мутаций.** Не создавай API Routes для простых CRUD — используй Server Actions.
4. **API Routes** — только для: webhook'ов, Bull MQ dashboard, сложных запросов.
5. **Prisma transactions** для операций затрагивающих несколько таблиц.
6. **Не хардкодь URL'ы WB API** — вынеси в константы.
7. **Error handling:** try/catch + пользовательские ошибки (WbApiError, AuthError, etc).
8. **Logging:** console не для продакшна. Используй pino или winston.

---

## Команды

```bash
# Разработка
npm run dev               # Next.js dev server (http://localhost:3000)
npm run type-check        # TypeScript проверка без сборки
npm run build             # Production сборка

# База данных (Prisma 7)
npm run db:push           # Синхронизировать schema → БД (dev)
npm run db:migrate        # Создать и применить миграцию
npm run db:seed           # Seed ADMIN user (ADMIN_EMAIL / ADMIN_PASSWORD из .env)
npm run db:studio         # Prisma Studio (визуальный редактор БД)

# Docker
npm run docker:dev        # Поднять PostgreSQL 16 + Redis 7
npm run docker:dev:down   # Остановить контейнеры

# Продакшн
docker compose up -d      # Запуск всех сервисов
docker compose logs -f    # Просмотр логов
```

---

## Контекст для исследования

Если тебе нужно уточнить детали WB API, обращайся к документации:
- Общее: https://dev.wildberries.ru/docs/openapi/api-information
- Товары: https://dev.wildberries.ru/docs/openapi/work-with-products
- Продвижение: https://dev.wildberries.ru/docs/openapi/promotion
- Аналитика: https://dev.wildberries.ru/docs/openapi/analytics
- Отчёты: https://dev.wildberries.ru/docs/openapi/reports
- Финансы: https://dev.wildberries.ru/docs/openapi/financial-reports-and-accounting

Ключевые эндпоинты и их маппинг описаны в SPECIFICATION.md, секция 5.
