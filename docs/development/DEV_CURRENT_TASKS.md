# Dev Current Tasks

## Active

No active development task is currently assigned. Pick from `Next` after reading `DEV_HANDOFF.md`.

## Next

- ID: TASK-P7-P8-LIVE-VERIFY
  Status: Pending
  Priority: High
  Description: Провести safe smoke verification read-only WB sync jobs после rate-limit окон.
  Next step: Согласовать кабинеты, период и допустимые live API calls.
  Related files: `src/lib/services/sync-*`, `src/lib/queue/sync-processor.ts`, `/sync`.
  Risks: WB 429, long retries, incomplete ad stats.

- ID: TASK-PRODUCTION-RUNBOOK
  Status: Pending
  Priority: Medium
  Description: Подготовить/проверить production rollout runbook.
  Next step: Уточнить VPS target, backup policy, migration window.
  Related files: `docker-compose.prod.yml`, `Dockerfile`, `deploy/nginx/nimbaos.conf`.
  Risks: Production migrations require explicit confirmation.

## Blocked

- ID: TASK-PROD-DEPLOY
  Status: Blocked
  Priority: Medium
  Description: Реальный production deploy.
  Next step: Получить явное подтверждение и production environment details.
  Related files: production Docker/VPS artifacts.
  Risks: Secrets, migrations, data safety.

## Done Recently

- ID: TASK-DOCS-3-ZONES
  Status: Done
  Priority: High
  Description: Пересобрать Markdown-документацию под core/development/marketplace.
  Next step: Использовать новую структуру в следующих сессиях.
  Related files: `AGENTS.md`, `docs/DOCS_INDEX.md`, `docs/core`, `docs/development`, `docs/marketplace`.
  Risks: Старые docs сохранены как legacy redirects.

- ID: TASK-DASHBOARD-ANALYTICS
  Status: Done
  Priority: High
  Description: Dashboard summary, problem center, recommendations and exports implemented at code level.
  Next step: Monitor performance on real data.
  Related files: `src/lib/services/dashboard-summary.ts`, `dashboard-export.ts`.
  Risks: May need aggregates later.
