# Marketplace Handoff

## Current Marketplace Objective

Использовать NimbaOS как базу для регулярной аналитики WB: продажи, остатки, реклама, карточки, отзывы, план/факт и рекомендации владельцу.

## Last Marketplace Session Summary

2026-05-24: создана marketplace-зона документации. Анализ бизнес-данных не выполнялся, WB API не вызывался, данные не менялись.

## Current Safe Next Step

Перед первым бизнес-анализом выбрать кабинет и период, проверить свежесть данных по `docs/core/DATA_FRESHNESS_POLICY.md`, затем использовать `docs/marketplace/ANALYTICS_PLAYBOOK.md`.

## Active Marketplace Risks

- Нельзя менять цены, карточки, рекламу, ставки или остатки без подтверждения.
- Данные могут быть устаревшими или неполными; всегда проверять coverage.
- Рекомендации должны быть осторожными, особенно при низком объеме данных.

## Read Next If Needed

- `docs/marketplace/ANALYTICS_PLAYBOOK.md`
- `docs/marketplace/REPORTS_GUIDE.md`
- `docs/marketplace/KPI_DEFINITIONS.md`
- `docs/marketplace/DAILY_CHECKLIST.md`
- `docs/marketplace/DECISION_RULES.md`
- `docs/core/DATABASE_ACCESS_GUIDE.md`

## Do Not Do

- Не вызывать WB API ad-hoc для отчета.
- Не делать full historical sync без подтверждения.
- Не выдавать опасную рекомендацию как автоматическое действие.

## Last Updated

2026-05-24 — создан marketplace handoff для новой 3-zone документации.

