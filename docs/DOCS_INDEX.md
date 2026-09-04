# Documentation Index

Короткий навигатор по канонической памяти NimbaOS. Архив не является текущей истиной.

Last updated: 2026-09-04.

## Startup

1. Всегда читать `AGENTS.md` и этот индекс.
2. Handoff/current-task файлы читать только для продолжения прежней работы, запроса статуса/плана или зависимости от недавнего контекста.
3. Для изолированной задачи с известным компонентом сразу открыть только нужный документ или исходник из таблиц ниже.
4. Не загружать handoff, current tasks, project state и architecture одновременно «на всякий случай».

## Root Truth

| Document | Purpose | Read when |
| --- | --- | --- |
| `AGENTS.md` | Routing, safety, data priority, documentation rules | Every new session |
| `SPECIFICATION.md` | Stable product intent and business rules | Product scope or business-logic change |
| `DECISIONS.md` | Active architecture/product decisions | Need to understand why a durable rule exists |
| `README.md` | Human-facing project overview | General orientation |

## Core

| Document | Purpose | Read when |
| --- | --- | --- |
| `docs/core/PROJECT_STATE.md` | Current implementation snapshot | Need current product/rollout state |
| `docs/core/PROJECT_MAP.md` | Folders, layers, entrypoints | Locating code |
| `docs/core/ARCHITECTURE.md` | Layers and data flow | Architecture, API, sync or reporting work |
| `docs/core/COMMANDS.md` | Safe commands and production classification | Before running project commands |
| `docs/core/MINI_PC_RUNBOOK.md` | Mini-PC production, access, deploy, backup/restore | Any production/SSH/Tailscale/Docker task |
| `docs/core/DATA_MODEL.md` | Prisma tables, keys and data classes | Database/schema/query work |
| `docs/core/DATABASE_ACCESS_GUIDE.md` | Preferred services and safe DB access | Analytics, reports or ad-hoc queries |
| `docs/core/WB_API_MAP.md` | WB API methods and read/write boundaries | API or sync work |
| `docs/core/DATA_FRESHNESS_POLICY.md` | Coverage and DB-first rules | Before analytics or sync decisions |
| `docs/core/SAFETY_RULES.md` | Approval gates and forbidden actions | Potentially dangerous work |
| `docs/core/SCHEDULED_AUTOMATION.md` | Scheduler and workflow runtime | Recurring sync/automation work |
| `docs/core/GRAPHIFY_MEMORY_GUIDE.md` | Простые правила использования и пакетного обслуживания Graphify | Memory workflow, token/time optimization or graph maintenance |
| `docs/core/OPEN_QUESTIONS.md` | Unresolved owner/product decisions | Before designs depending on unknown policy |

## Development

| Document | Purpose |
| --- | --- |
| `docs/development/DEV_HANDOFF.md` | Short current session handoff; replace, do not append history |
| `docs/development/DEV_CURRENT_TASKS.md` | Active/Next/Blocked plus at most 3–5 recent results |
| `docs/development/DEV_LOG.md` | Canonical post-cleanup implementation history; older segments are archived |
| `docs/development/BUGS_AND_INCIDENTS.md` | Active bugs and fixes awaiting rollout/verification |
| `docs/development/DEVELOPMENT_AGENT.md` | Development workflow |
| `docs/development/TROUBLESHOOTING.md` | Reusable diagnostics |

## Marketplace

| Document | Purpose |
| --- | --- |
| `docs/marketplace/MARKETPLACE_HANDOFF.md` | Short current marketplace handoff |
| `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md` | Active/Next/Blocked plus at most 3–5 recent results |
| `docs/marketplace/MARKETPLACE_ANALYSIS_LOG.md` | Canonical post-cleanup analysis/report history; older segments are archived |
| `docs/marketplace/MARKETPLACE_AGENT.md` | Marketplace workflow |
| `docs/marketplace/ANALYTICS_PLAYBOOK.md` | DB-first analysis method |
| `docs/marketplace/MARKETPLACE_MANAGER_PLAYBOOK.md` | Daily/weekly operational thinking |
| `docs/marketplace/REPORTS_GUIDE.md` | Existing and desired reports |
| `docs/marketplace/KPI_DEFINITIONS.md` | Metric definitions and interpretation traps |
| `docs/marketplace/DAILY_CHECKLIST.md` | Daily review sequence |
| `docs/marketplace/DECISION_RULES.md` | Guardrails for recommendations |

## Archive

`docs/archive` contains superseded instructions, completed roadmaps and immutable pre-cleanup snapshots. Read it only for historical investigation. If archive conflicts with an active canonical path, the active document wins.

- `docs/archive/legacy/PROMPTS_GUIDE.md` — obsolete Claude/CLAUDE.md prompt workflow.
- `docs/archive/plans/DASHBOARD_ANALYTICS_ROADMAP.md` — implemented/superseded dashboard plan.
- `docs/archive/snapshots/2026-09-02-pre-cleanup/` — full operational-memory snapshot before cleanup.
- `docs/archive/development/` and `docs/archive/marketplace/` — closed historical log segments.

## Storage Rules

- Stable truth → specification, active decisions or relevant core reference.
- Current work → role current-tasks/handoff.
- Detailed completed work → role log.
- Detailed incident → archive ledger; active status → active bugs index.
- Superseded/completed material → archive, never startup context.
- Do not repeat full task summaries across multiple files; use IDs and links.
