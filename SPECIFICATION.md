# WB Cabinet Digitizer — Спецификация проекта

## 1. Общее описание

Закрытая веб-платформа для оцифровки кабинетов продавца на Wildberries. Платформа агрегирует данные через WB API, формирует финансовые отчёты, план продаж с детализацией по артикулам, управляет рекламными кампаниями и предоставляет полную аналитику кабинета.

**Целевая аудитория:** внутренняя команда (не публичный SaaS).  
**Доступ:** только по приглашению. Админ (владелец) — единственный суперпользователь.

---

## 2. Стек технологий

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| **Frontend** | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, shadcn/ui | SSR, API Routes, отличный DX |
| **Backend** | Next.js API Routes + серверные действия | Единый репозиторий, простота деплоя |
| **БД** | PostgreSQL 16 | Надёжность, JSON-поддержка, сложные аналитические запросы |
| **ORM** | Prisma | Типобезопасность, миграции |
| **Кэш/очереди** | Redis (Bull MQ) | Кэширование API-ответов WB, фоновая синхронизация |
| **Аутентификация** | NextAuth.js (Credentials provider) | Простая, закрытая авторизация |
| **Графики** | Recharts / Tremor | Нативная React-интеграция |
| **Деплой** | VPS (Docker Compose): Nginx → Next.js → PostgreSQL → Redis | Полный контроль |

---

## 3. Архитектура

```
┌────────────────────────────────────────────────────┐
│                    NGINX (reverse proxy, SSL)       │
└──────────────────────┬─────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────┐
│              NEXT.JS APP (SSR + API Routes)         │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Frontend    │  │ API      │  │ Background    │  │
│  │  Pages/UI    │  │ Routes   │  │ Workers       │  │
│  │  (React)     │  │ (/api/*) │  │ (Bull MQ)     │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
└──────┬──────────────┬──────────────┬───────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐
│ PostgreSQL  │ │   Redis   │ │  WB API    │
│ (данные)    │ │ (кэш/queue)│ │ (внешний)  │
└─────────────┘ └───────────┘ └────────────┘
```

---

## 4. Модель данных (основные сущности)

### 4.1 Пользователи и доступ

```
User {
  id            UUID PK
  email         String UNIQUE
  name          String
  passwordHash  String
  role          Enum(ADMIN, MANAGER, VIEWER)
  isActive      Boolean
  invitedBy     UUID? FK → User
  createdAt     DateTime
}

Session — управляется NextAuth
```

**Роли:**
- **ADMIN** — полный доступ: управление пользователями, API-ключами, всеми настройками
- **MANAGER** — доступ к отчётам, плану продаж, рекламным кампаниям, справочникам
- **VIEWER** — только просмотр отчётов и карточек

### 4.2 Кабинеты (WB Accounts)

```
WbAccount {
  id            UUID PK
  name          String          // "Кабинет 1", "Кабинет основной"
  apiKey        String ENCRYPTED
  taxRate       Decimal         // Налоговая ставка в %
  sellerName    String?         // Из /api/v1/seller-info
  sellerId      String?         // sid из /api/v1/seller-info
  tradeMark     String?
  isActive      Boolean
  lastSyncAt    DateTime?
  createdAt     DateTime
}
```

### 4.3 Товары (карточки)

```
Product {
  id              UUID PK
  wbAccountId     UUID FK → WbAccount
  nmId            Int             // Артикул WB
  vendorCode      String          // Артикул поставщика (буквенный)
  vendorCodeLocal String?         // Локальное переименование из справочника
  brand           String?
  category        String?         // subject
  subjectId       Int?
  title           String?
  photoUrl        String?
  createdAt       DateTime
  updatedAt       DateTime
}

ProductSize {
  id              UUID PK
  productId       UUID FK → Product
  techSize        String          // Размер
  wbSize          String?
  barcode         String
  price           Decimal?
  discount        Int?
  spp             Decimal?        // Рассчитывается
  createdAt       DateTime
}

ProductMaterial {
  id              UUID PK
  productId       UUID FK → Product
  composition     String          // Состав ткани из WB
  compositionLocal String?        // Переопределённый из справочника
}
```

### 4.4 Справочники

```
CostPrice {
  id              UUID PK
  wbAccountId     UUID FK
  vendorCode      String          // Артикул поставщика
  costPrice       Decimal         // Себестоимость
  updatedAt       DateTime
}

SelfPurchase {
  id              UUID PK
  wbAccountId     UUID FK
  vendorCode      String
  date            Date
  quantity        Int
  amount          Decimal         // Сумма самовыкупа
  cashback        Decimal?        // Кэшбек раздачи
  note            String?
}

ExternalAd {
  id              UUID PK
  wbAccountId     UUID FK
  vendorCode      String?
  date            Date
  amount          Decimal         // Расходы на внешнюю рекламу
  source          String?         // Источник (Telegram, Instagram и т.д.)
  note            String?
}

ArticleOverride {
  id              UUID PK
  wbAccountId     UUID FK
  vendorCode      String          // Оригинальный артикул
  localName       String?         // Переименование артикула
  localColor      String?         // Переименование цвета
  localSize       String?
  localComposition String?
}
```

### 4.5 Финансовые данные (кэш из WB API)

```
RealizationReport {
  id                  UUID PK
  wbAccountId         UUID FK
  rrdId               BigInt UNIQUE   // rrd_id из API
  realizationReportId Int
  dateFrom            Date
  dateTo              Date
  nmId                Int
  vendorCode          String
  barcode             String?
  docTypeName         String          // "Продажа", "Возврат"
  quantity            Int
  retailPrice         Decimal
  retailPriceWithDisc Decimal         // retail_price_withdisc_rub
  ppvzForPay          Decimal         // ppvz_for_pay (к перечислению)
  ppvzSppPrc          Decimal         // ppvz_spp_prc (СПП %)
  deliveryRub         Decimal         // Логистика
  penalty             Decimal         // Штрафы
  additionalPayment   Decimal         // Доплаты
  storageFee          Decimal         // Хранение
  deduction           Decimal         // Удержания
  acceptance          Decimal         // Приёмка
  acquiringFee        Decimal         // Эквайринг
  commissionPercent   Decimal         // Комиссия %
  ppvzSalesCommission Decimal         // Комиссия руб
  salePercent         Decimal         // sale_percent
  bonusTypeName       String?
  srid                String?
  subjectName         String?
  brandName           String?
  officeName          String?
  supplierOperName    String?         // "Продажа", "Возврат", "Логистика" и т.д.
  orderDt             DateTime?
  saleDt              DateTime?
  rrDt                Date?
  fetchedAt           DateTime
}
```

### 4.6 Рекламные кампании

```
AdCampaign {
  id              UUID PK
  wbAccountId     UUID FK
  advertId        Int UNIQUE      // ID кампании в WB
  name            String
  status          Int             // 4,7,8,9,11
  bidType         String          // manual, unified
  paymentType     String          // cpm, cpc
  placementSearch Boolean
  placementReco   Boolean
  budget          Decimal?
  createdAt       DateTime
  updatedAt       DateTime
}

AdCampaignStat {
  id              UUID PK
  campaignId      UUID FK → AdCampaign
  date            Date
  source          String          // "search" | "recommendations" | "total"
  views           Int             // Просмотры
  clicks          Int             // Переходы/Клики
  ctr             Decimal
  cpc             Decimal
  spend           Decimal         // Затраты
  orders          Int             // Заказы
  cartAdds        Int             // Корзины
  bid             Decimal?        // Ставка на дату
}

AdCampaignCluster {
  id              UUID PK
  campaignId      UUID FK → AdCampaign
  cluster         String          // Поисковый кластер
  ctr             Decimal
  position        Decimal         // Средняя позиция
  views           Int
  clicks          Int
  cartAdds        Int
  orders          Int
  cpm             Decimal
  dateFrom        Date
  dateTo          Date
}
```

### 4.7 План продаж

```
SalesPlan {
  id              UUID PK
  wbAccountId     UUID FK
  name            String
  description     String?
  dateFrom        Date
  dateTo          Date
  drrPercent      Decimal         // Целевой ДРР %
  createdAt       DateTime
  updatedAt       DateTime
}

SalesPlanItem {
  id              UUID PK
  planId          UUID FK → SalesPlan
  nmId            Int
  vendorCode      String
  plannedQty      Int             // План продаж штук
  price           Decimal         // Цена (можно редактировать)
  buyoutPercent   Decimal         // % выкупа (можно редактировать)
}
```

---

## 5. WB API — Маппинг эндпоинтов

### 5.1 Карточки товаров
| Функция | API Метод | Домен |
|---------|-----------|-------|
| Получить список карточек | `POST /content/v2/get/cards/list` | `content-api.wildberries.ru` |
| Получить цены | `GET /api/v2/list/goods/filter` | `discounts-prices-api.wildberries.ru` |
| Получить остатки на складах WB | `GET /api/v1/supplier/stocks` | `statistics-api.wildberries.ru` |
| Информация о продавце | `GET /api/v1/seller-info` | `common-api.wildberries.ru` |

### 5.2 Финансовый отчёт (ключевой для раздела "Отчёты")
| Функция | API Метод | Домен |
|---------|-----------|-------|
| Детализация реализации | `GET /api/v5/supplier/reportDetailByPeriod` | `statistics-api.wildberries.ru` |
| Баланс продавца | `GET /api/v1/account/balance` | `finance-api.wildberries.ru` |

**Важно:** Этот отчёт — главный источник для расчёта ВСЕХ финансовых показателей: продажи, возвраты, логистика, штрафы, хранение, комиссия, приёмка, удержания, эквайринг, к перечислению и т.д.

### 5.3 Аналитика (воронка продаж — для плана продаж)
| Функция | API Метод | Домен |
|---------|-----------|-------|
| Статистика карточек за период | `POST /api/analytics/v3/sales-funnel/products` | `seller-analytics-api.wildberries.ru` |
| Статистика по дням | `POST /api/analytics/v3/sales-funnel/products/history` | `seller-analytics-api.wildberries.ru` |

### 5.4 Статистика (заказы, продажи — для плана продаж)
| Функция | API Метод | Домен |
|---------|-----------|-------|
| Заказы | `GET /api/v1/supplier/orders` | `statistics-api.wildberries.ru` |
| Продажи | `GET /api/v1/supplier/sales` | `statistics-api.wildberries.ru` |

### 5.5 Рекламные кампании
| Функция | API Метод | Домен |
|---------|-----------|-------|
| Списки кампаний | `GET /adv/v1/promotion/count` | `advert-api.wildberries.ru` |
| Информация о кампаниях | `GET /api/advert/v2/adverts` | `advert-api.wildberries.ru` |
| Полная статистика кампаний | `GET /adv/v3/fullstats` | `advert-api.wildberries.ru` |
| Статистика кластеров | `POST /adv/v0/normquery/stats` | `advert-api.wildberries.ru` |
| Стат. кластеров по дням | `POST /adv/v1/normquery/stats` | `advert-api.wildberries.ru` |
| Список кластеров (активные/нет) | `POST /adv/v0/normquery/list` | `advert-api.wildberries.ru` |
| Баланс рекламы | `GET /adv/v1/balance` | `advert-api.wildberries.ru` |
| Бюджет кампании | `GET /adv/v1/budget` | `advert-api.wildberries.ru` |
| Пополнить бюджет | `POST /adv/v1/budget/deposit` | `advert-api.wildberries.ru` |
| Изменить ставки | `PATCH /api/advert/v1/bids` | `advert-api.wildberries.ru` |
| Пауза / Запуск / Стоп | `GET /adv/v0/pause`, `/start`, `/stop` | `advert-api.wildberries.ru` |
| Рекомендуемые ставки | `GET /api/advert/v0/bids/recommendations` | `advert-api.wildberries.ru` |

### 5.6 Хранение и приёмка (для отчётов)
| Функция | API Метод | Домен |
|---------|-----------|-------|
| Платное хранение — создать | `GET /api/v1/paid_storage` | `seller-analytics-api.wildberries.ru` |
| Платное хранение — скачать | `GET /api/v1/paid_storage/tasks/{id}/download` | `seller-analytics-api.wildberries.ru` |
| Платная приёмка — создать | `GET /api/v1/acceptance_report` | `seller-analytics-api.wildberries.ru` |
| Платная приёмка — скачать | `GET /api/v1/acceptance_report/tasks/{id}/download` | `seller-analytics-api.wildberries.ru` |
| Удержания (самовыкупы) | `GET /api/v1/analytics/antifraud-details` | `seller-analytics-api.wildberries.ru` |
| Остатки на складах WB | `GET /api/v1/warehouse_remains` → `download` | `seller-analytics-api.wildberries.ru` |

---

## 6. Модули приложения

### 6.1 Авторизация и пользователи

**Маршруты:**
- `/login` — вход
- `/admin/users` — управление пользователями (только ADMIN)

**Функционал:**
- Вход по email + пароль
- Первый запуск: создаётся ADMIN-аккаунт через env-переменные или seed-скрипт
- ADMIN может: создать приглашение (генерация одноразовой ссылки), просмотреть всех пользователей, менять роли (MANAGER / VIEWER), деактивировать / удалить пользователей
- Приглашение: ADMIN генерирует ссылку → пользователь переходит → регистрируется (имя, email, пароль)
- Таблица `Invitation { id, token, role, createdBy, usedBy?, expiresAt, createdAt }`

### 6.2 Профиль и настройки

**Маршрут:** `/settings`

**Функционал:**
- Редактирование имени
- Раздел «API ключи»: добавление/удаление кабинетов WB (название + API-ключ). При добавлении — автоматический запрос к `/ping` и `/api/v1/seller-info` для валидации
- Налоговая ставка: задаётся глобально для каждого кабинета

### 6.3 Карточки товаров

**Маршрут:** `/cards`

**Синхронизация:** кнопка "Синхронизировать" → вызывает `POST /content/v2/get/cards/list` с пагинацией (cursor) → сохраняет в БД.

**Таблица на UI:**
| nmId | Артикул поставщика | Категория | Бренд | Цена |
|------|-------------------|-----------|-------|------|
| 418756091 | парео\детская\розовый | накидка пляжная | BrandX | 2102 |

Цены подтягиваются из `GET /api/v2/list/goods/filter`.

### 6.4 Справочники

**Маршрут:** `/references`

**Вкладки:**
1. **Себестоимость** — таблица: Артикул поставщика → Себестоимость (руб). CRUD.
2. **Самовыкупы** — таблица: Дата, Артикул, Кол-во, Сумма, Кэшбек раздач. CRUD.
3. **Внешняя реклама** — таблица: Дата, Артикул (опционально), Сумма, Источник. CRUD.
4. **Переименования** — таблица: Артикул WB, Оригинальное название → Локальное название, Цвет, Размер, Состав. CRUD.

### 6.5 Отчёты

**Маршрут:** `/reports`

**Источник данных:** `GET /api/v5/supplier/reportDetailByPeriod` — детализация реализации. Это главный источник ВСЕХ финансовых показателей.

**Выбор периода:** календарь для выбора dateFrom и dateTo.  
**Выбор кабинета:** dropdown (при наличии нескольких).  
**Кнопка "Синхронизировать":** загружает данные из WB API за выбранный период, сохраняет в `RealizationReport`.

**Столбцы таблицы отчёта (все рассчитываются из данных `RealizationReport` + справочников):**

| # | Столбец | Источник / Формула |
|---|---------|-------------------|
| 1 | **Артикул ВБ** | `nmId` |
| 2 | **Категория** | `subjectName` |
| 3 | **Артикул поставщика** | `vendorCode` (с учётом переименования) |
| 4 | **Продажа** | Σ `retail_price_withdisc_rub` по doc_type "Продажа" − Σ по "Возврат" (= продажи - возвраты с учётом СПП) |
| 5 | **К перечислению** | Σ `ppvz_for_pay` по "Продажа" − Σ `ppvz_for_pay` по "Возврат" |
| 6 | **Итого к оплате** | К_перечислению − Реклама_баланс − Логистика − Доплаты − Штрафы − Хранение − Приёмка − Удержания |
| 7 | **ОП (Операционная прибыль)** | К_перечислению − Реклама_все − Внешняя_реклама − Логистика − Себестоимость − Хранение − Приёмка − Доплаты − Штрафы − Налоги − Удержания − Сумма_самовыкупов − Кэшбек_раздач |
| 8 | **ОП ед.** | ОП / Выкуплено_с_учётом_возврата |
| 9 | **% от всей ОП** | ОП_артикула / ОП_всего × 100 |
| 10 | **Цена ср.** | Σ retail_price_withdisc_rub (продажи) / кол-во продаж |
| 11 | **Выкуплено с учётом возврата** | Кол-во "Продажа" − Кол-во "Возврат" |
| 12 | **Выкуп %** | Выкуплено_с_возвратом / (Выкуплено_без_возврата) × 100 |
| 13 | **Маржинальность** | (Продажа − Себестоимость × Выкуплено) / Продажа × 100 |
| 14 | **Рентабельность** | ОП / (Себестоимость × Выкуплено) × 100 |
| 15 | **Реклама (баланс)** | Из статистики рекл. кампаний (расходы с баланса WB) |
| 16 | **Реклама (все)** | Баланс + счёт + кэшбек |
| 17 | **ДРР %** | Реклама_все / Продажа × 100 |
| 18 | **Логистика** | Σ `delivery_rub` |
| 19 | **Логистика ед.** | Логистика / Доставлено |
| 20 | **Доставлено** | Кол-во записей с supplier_oper_name = "Логистика" |
| 21 | **Логистика от продаж %** | Логистика / Продажа × 100 |
| 22 | **Внешняя реклама** | Из справочника `ExternalAd` |
| 23 | **Себестоимость самовыкупов** | Из справочника `SelfPurchase` × себестоимость |
| 24 | **Кэшбек раздач** | Из справочника `SelfPurchase.cashback` |
| 25 | **Сумма самовыкупов** | Из справочника `SelfPurchase.amount` |
| 26 | **Хранение от продаж %** | Хранение / Продажа × 100 |
| 27 | **Себестоимость** | Из справочника `CostPrice` × Выкуплено |
| 28 | **Хранение** | Σ `storage_fee` |
| 29 | **Приёмка** | Σ `acceptance` |
| 30 | **Доплаты** | Σ `additional_payment` |
| 31 | **Штрафы** | Σ `penalty` |
| 32 | **Налоги** | К_перечислению × taxRate% |
| 33 | **Комиссия** | Σ `ppvz_sales_commission` |
| 34 | **Самовыкупы, раздачи** | Из справочника |
| 35 | **Эквайринг** | Σ `acquiring_fee` |
| 36 | **Бренд** | `brand_name` |
| 37 | **Возвраты** | Кол-во записей с doc_type "Возврат" |
| 38 | **Выкуплено без учёта возврата** | Кол-во "Продажа" |
| 39 | **Отмены** | Из `orders` API (isCancel=true) |
| 40 | **Продажи-возвраты без СПП** | retail_amount (без учёта СПП) |
| 41 | **Продажи с СПП** | retail_price_withdisc_rub по "Продажа" |
| 42 | **Возвраты с СПП** | retail_price_withdisc_rub по "Возврат" |
| 43 | **Продажи без СПП** | retail_amount по "Продажа" |
| 44 | **Возвраты без СПП** | retail_amount по "Возврат" |
| 45 | **Комиссия при продаже** | ppvz_sales_commission по "Продажа" |
| 46 | **Комиссия при возврате** | ppvz_sales_commission по "Возврат" |
| 47 | **Прочие удержания/выплаты** | Σ `deduction` |
| 48 | **Продажи к перечислению** | ppvz_for_pay по "Продажа" |
| 49 | **Возвраты к перечислению** | ppvz_for_pay по "Возврат" |
| 50 | **Эквайринг при продаже** | acquiring_fee по "Продажа" |
| 51 | **Ярлыки** | tags из карточки |
| 52 | **Эквайринг при возврате** | acquiring_fee по "Возврат" |

### 6.6 План продаж

**Маршрут:** `/sales-plan`

**Создание плана:**
- Название, описание, дата начала/конца, целевой ДРР %
- Добавление артикулов: "Из остатков" (подтянуть все активные артикулы) или "По-отдельности" (поиск по nmId / vendorCode)
- По каждому артикулу: план продаж шт., цена (редактируемая), % выкупа (редактируемый)

**Детализация (при раскрытии артикула) — как на скрине:**

Кнопка «Получить данные» с вариантами:
- **Сегодня** — быстрая синхронизация за сегодня
- **Полная синхронизация** — весь период плана
- **Выбрать период** — произвольный диапазон дат

**Показатели в плане (по артикулу, по дням):**

Верхняя строка — итоги: ПЛАН/МЕС, ФАКТ/МЕС, ПЛАН/ДЕНЬ, ФАКТ/ДЕНЬ, далее колонки по датам.

| Показатель | Источник |
|-----------|----------|
| Выручка заказы | orders API: Σ (finishedPrice) по заказам за день |
| Кол-во заказов | orders API: count заказов |
| Выручка продажи | sales API: Σ (priceWithDisc) по продажам |
| Выкупили, шт. | sales API: count продаж (не возвратов) |
| Реклама | advert API: fullstats → spend за день |
| Заказы, шт. | orders за конкретный артикул |
| Выручка продажи (артикул) | sales за артикул |
| Выкуп, шт. | sales за артикул (doc_type Продажа) |
| РК(CTR) | advert fullstats → ctr |
| РК(Ставка) | advert adverts → bids |
| РК(Затраты) | advert fullstats → spend |
| РК(СРО) | spend / orders |
| РК(ДРР) | spend / выручка × 100 |
| РК(Переходы) | advert fullstats → clicks |
| Переходы, шт. | analytics: openCount (воронка) |
| Корзина, % | analytics: addToCartConversion |
| Корзина, шт. | analytics: cartCount |
| Заказ, % | analytics: cartToOrderConversion |
| Ср. цена | Выручка продажи / Выкуплено |

**Про СПП:** СПП (скидка постоянного покупателя) невозможно получить через API напрямую для плана продаж в реальном времени. Решение — **брать из данных реализации** (`ppvz_spp_prc`), усредняя за последние 7-14 дней по артикулу, и использовать это среднее значение для расчётов. Цена с СПП = Цена × (1 − avg_spp/100).

### 6.7 Рекламные кампании

**Маршрут:** `/advertising`

**Список кампаний:** таблица с фильтрами по статусу.

**При открытии кампании — 4 вкладки:**

#### Вкладка "Статистика"
Таблица: Наименование → Всего → по датам (в столбцах).
Строки: Затраты, CPO, Ставка, Просмотры, CTR, Переходы, Корзины, Заказы, CPC.

Источник: `GET /adv/v3/fullstats` — возвращает полную статистику кампании с разбивкой по дням и товарам.

#### Вкладка "Кластеры"
Таблица: Кластер, CTR, Поз, Показы, Клики, Корзина, Заказы, CPM.
Период: выбор диапазона дат.

Источник: `POST /adv/v0/normquery/stats` + `POST /adv/v1/normquery/stats` (с детализацией по дням).

#### Вкладка "Разбивка"
Таблица с колонками по дням, в каждом дне две подколонки: **П** (Поиск) и **Р** (Рекомендации + Каталог).
Строки: Затраты, CPO, Ставка, Просмотры, CTR, Переходы, Корзины, Заказы, CPC.

Источник: `GET /adv/v3/fullstats` — в ответе есть разбивка `apps` с `appType`: 1 = поиск, 128 = рекомендации/каталог.

**Тултип при наведении** (на Затраты, Просмотры, Переходы, Корзины, Заказы в разбивке):
Окно с процентами трафика: слева — % из поиска (главная страница), справа — % из полок. И в П, и в Р колонках.

Источник: `fullstats` → по каждому appType отдельно посчитать долю.

#### Вкладка "Журнал"
Журнал изменений ставок и статусов кампании. Источник: `GET /adv/v1/upd` (история затрат) + локальный лог действий пользователя (изменения ставок, пауза/запуск).

**Управление кампанией (шапка):**
- Ставка CPM: input + кнопка "Установить" → `PATCH /api/advert/v1/bids`
- Пополнение: сумма + источник (Баланс) + кнопка "Пополнить" → `POST /adv/v1/budget/deposit`
- Кнопки: "Возобновить" → `/adv/v0/start`, "Завершить" → `/adv/v0/stop`
- Статус: отображается справа (Активна, На паузе, Завершена и т.д.)

### 6.8 Навигация

```
Sidebar:
├── Карточки          /cards
├── Отчёты            /reports
├── План продаж       /sales-plan
├── Справочники       /references
├── Реклама           /advertising
├── Настройки         /settings
└── Пользователи      /admin/users (только ADMIN)
```

---

## 7. Лимиты WB API — Стратегия обхода

Все запросы к WB API проходят через единый Rate Limiter (серверный):
- Контент: 100 req/min (600ms интервал)
- Маркетплейс: 300 req/min (200ms интервал)
- Статистика: 1 req/min
- Реклама: 5 req/sec
- Аналитика: 3 req/min

**Стратегия:**
1. **Bull MQ** для фоновых задач синхронизации с настроенными интервалами
2. Кэширование в Redis (TTL зависит от типа данных: 5 мин для рекламы, 30 мин для статистики, 1 час для карточек)
3. Инкрементальная загрузка: использование `lastChangeDate` для orders/sales, `rrdId` для реализации
4. Retry с экспоненциальным backoff при 429

---

## 8. Безопасность

1. API-ключи WB хранятся зашифрованными (AES-256-GCM) в БД. Ключ шифрования — в env
2. HTTPS обязателен (Let's Encrypt через Nginx)
3. CSRF-защита через NextAuth
4. Rate limiting на API Routes (express-rate-limit)
5. Все действия с данными — только авторизованные пользователи
6. Логирование действий ADMIN (изменение ролей, удаление пользователей)

---

## 9. Что НЕВОЗМОЖНО получить через API

| Данные | Проблема | Решение |
|--------|---------|---------|
| **СПП (скидка постоянного покупателя) в реальном времени** | API не возвращает текущий СПП для произвольного товара | Использовать среднее `ppvz_spp_prc` из последних реализаций за 7-14 дней |
| **Разбивка трафика по "главная страница поиска" vs "полки"** | В fullstats есть `appType` (1=поиск, 128=рекомендации), но нет разбивки внутри "поиска" на "главную" и "полки" | Отображать долю appType=1 vs appType=128, без более детальной разбивки. Можно добавить поле для ручного ввода |
| **Отмены заказов по артикулу** | Доступно в orders API (`isCancel=true`), но данные хранятся только 90 дней | Синхронизировать регулярно и хранить в своей БД |
| **Кэшбек WB Club по артикулам** | Частично доступно через воронку продаж | Использовать данные из sales funnel API |

---

## 10. Docker Compose (продакшн)

```yaml
version: "3.8"
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: wb_digitizer
      POSTGRES_USER: wb_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes: ["redisdata:/data"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/letsencrypt

volumes:
  pgdata:
  redisdata:
```
