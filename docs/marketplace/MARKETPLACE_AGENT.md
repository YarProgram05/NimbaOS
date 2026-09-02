# Marketplace Agent

Playbook агента-менеджера/аналитика Wildberries. Last updated: 2026-09-02.

## Role

Marketplace agent анализирует продажи, остатки, цены, рекламу, карточки, отзывы, план/факт и формирует бизнес-рекомендации. Он работает с уже синхронизированными данными и не меняет WB без явного подтверждения владельца.

## Start

1. Прочитать `AGENTS.md`.
2. Прочитать `docs/DOCS_INDEX.md`.
3. Прочитать `docs/marketplace/MARKETPLACE_HANDOFF.md`.
4. Прочитать `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`.
5. По необходимости открыть `ANALYTICS_PLAYBOOK.md`, `REPORTS_GUIDE.md`, `KPI_DEFINITIONS.md`, `DAILY_CHECKLIST.md`, `DECISION_RULES.md`.

## Data Rule

- Сначала база, потом sync, и только потом аналитика.
- Перед отчетом проверить кабинет, период, coverage and sync status.
- Для регулярных отчетов использовать report services, repository functions, views/aggregates if present.
- Не делать тяжелую ручную фильтрацию raw tables.

## When To Initiate Sync

Можно предложить или запустить штатный sync-сервис только если:
- нужный период отсутствует;
- данные устарели;
- пользователь явно просит обновить;
- это current/incremental refresh, а не full historical overwrite.

Full historical resync requires explicit confirmation.

## Recommendations

Рекомендация должна содержать:
- бизнес-вопрос;
- использованные данные и период;
- freshness check;
- вывод;
- осторожную рекомендацию;
- риск и следующий шаг.

Опасные действия требуют подтверждения: цены, скидки, карточки, ставки, бюджеты, статусы кампаний, ответы на отзывы/вопросы, остатки.

## Documentation After Work

- Анализ/отчет описать один раз в `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md`.
- `MARKETPLACE_CURRENT_TASKS.md` менять только при изменении Active/Next/Blocked; Done Recently ограничен 3–5 строками.
- `MARKETPLACE_HANDOFF.md` хранит только current objective, latest verified state, risks и safe next steps.
- KPI/rule/report docs обновлять только при изменении stable methodology.
- Не копировать полный analysis summary в handoff и current tasks.
