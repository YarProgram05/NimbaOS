# Data Freshness Policy

## Main principle

База данных — основной источник истины для аналитики.

WB API — механизм обновления базы, а не основной источник для каждого отчёта или экрана аналитики.

## Historical data

- Исторические данные синхронизируются один раз и дальше используются из БД.
- Повторная историческая синхронизация требует явного подтверждения.
- Перезапись исторических данных требует явного подтверждения и причины.
- Для больших периодов учитывать rate limits WB API.

## Current data

Актуальные данные обновляются:
- по расписанию после реализации Phase 8;
- кнопкой пользователя;
- при явном запросе пользователя;
- если нужных дат нет в базе и пользователь подтвердил обновление.

## Before analytics

Перед аналитикой агент должен проверить:
- нужный WB кабинет;
- нужный период;
- покрытие периода в БД;
- дату последней синхронизации;
- пропущенные даты;
- какой штатный sync-сервис использовать.

## Data domains

- Products/cards: локальная таблица `products` и `product_sizes`; WB API только для sync/refresh.
- Financial reports: `realization_reports`, `paid_storage`, references, products, advertising stats.
- Sales plan: `wb_orders`, `wb_sales`, `wb_funnel_stats`, sales plan tables.
- Advertising: `ad_campaigns`, `ad_campaign_stats`, `ad_campaign_nm_stats`, `ad_campaign_clusters`, `ad_action_logs`.

## WB API limits

WB domains have strict limits. Long retry windows should not block interactive UI. If WB returns long `429`, fail fast, log/record incident, and retry later.

## Sync safety

- Do not run full historical sync without confirmation.
- Do not run destructive resync without confirmation.
- Prefer incremental sync where implemented.
- Prefer existing sync services over ad-hoc API scripts.
- For live verification, use debug scripts only when user explicitly asks.

## Documentation updates

Update this file when:
- sync strategy changes;
- a new data source is added;
- historical/current freshness rules change;
- WB API behavior changes.

## Phase 8 background sync

- Read-only WB sync is queued through Bull MQ and recorded in `SyncJobRun`.
- Existing sync buttons should enqueue jobs instead of waiting for long WB requests inside UI actions.
- The default scheduler uses rolling 7-day current-data jobs in `Europe/Moscow`.
- Historical/full sync is not scheduled automatically and still requires explicit confirmation.
- `/sync` is the operational mini-screen for recent job statuses, attempts, errors and safe manual launches.
