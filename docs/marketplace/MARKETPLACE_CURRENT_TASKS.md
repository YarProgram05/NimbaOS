# Marketplace Current Tasks

## Active

No active marketplace task is currently assigned. Pick from `Next` after reading `MARKETPLACE_HANDOFF.md`.

## Next

- ID: MKT-DAILY-BASELINE
  Status: Pending
  Priority: High
  Description: Провести первую ежедневную проверку по продажам, остаткам, рекламе, план/факт и карточкам.
  Next step: Выбрать кабинет/период и проверить freshness.
  Related reports/metrics: daily_wb_report, stock_risk_report, ads_efficiency_report.
  Related cabinets: нужно выбрать.
  Risks: Данные могут быть неполными.

- ID: MKT-KPI-THRESHOLDS
  Status: Pending
  Priority: Medium
  Description: Уточнить целевые thresholds для DRR, маржинальности, выкупа, out-of-stock risk, конверсии.
  Next step: Спросить владельца или вывести из исторических данных.
  Related reports/metrics: KPI definitions, decision rules.
  Related cabinets: all.
  Risks: Без thresholds рекомендации должны быть мягкими.

## Blocked

- ID: MKT-AUTO-OWNER-SUMMARY
  Status: Blocked
  Priority: Medium
  Description: Автоматическая weekly owner summary.
  Next step: Уточнить формат, канал и расписание.
  Related reports/metrics: weekly_owner_summary.
  Related cabinets: all active.
  Risks: Production automation and data freshness.

## Done Recently

- ID: MKT-DOCS-PLAYBOOK
  Status: Done
  Priority: High
  Description: Создать playbook и документы аналитика WB.
  Next step: Использовать при первой marketplace-задаче.
  Related reports/metrics: all.
  Related cabinets: all selected WB accounts.
  Risks: Thresholds require owner confirmation.

- ID: MKT-DOCS-3-ZONES
  Status: Done
  Priority: High
  Description: Marketplace docs created under `docs/marketplace`.
  Next step: Keep logs updated after each analysis.
  Related reports/metrics: all.
  Related cabinets: all.
  Risks: none.
