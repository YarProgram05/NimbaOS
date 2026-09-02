# Development Log

Canonical post-cleanup development history. Earlier entries are preserved in `docs/archive/development/DEV_LOG_2026-05_to_2026-09-02.md`.

## 2026-09-02 - Permanent Graphify memory workflow

- Replaced the minimal Graphify notes in `AGENTS.md` with a permanent project-level workflow: graph-first navigation, scoped source reading, source-of-truth precedence, decision capture, incremental memory updates and post-update verification.
- Made Graphify usage automatic for relevant work; users no longer need to invoke `/graphify` explicitly.
- Defined completion semantics: graph-relevant work is not complete until the canonical source and Graphify are synchronized, or the graph is explicitly reported stale with a reason.
- Kept routine non-knowledge edits outside the rebuild requirement to avoid unnecessary complexity and graph churn.
- No application source, business logic, database, WB data, Google Sheet or production state was changed.

## 2026-09-02 - Initial deep Graphify knowledge graph

- Built the initial project knowledge graph from 320 relevant sources: 283 code/configuration files and 37 active documents; dependencies, builds, caches, generated artifacts, secrets, raster assets and `docs/archive/` were excluded through `.graphifyignore`.
- Enabled the official `graphifyy[sql]` extra so all 17 SQL migration/analysis files participate in structural extraction.
- Combined AST extraction with deep semantic extraction of architecture, data policy, marketplace methodology, KPI definitions, decision rules, current state, incidents and operating runbooks.
- Added evidence-backed semantic bridges between documentation and concrete services for WB sync/reporting, FBS/KIZ/Google Sheets, authentication/authorization and marketplace KPIs.
- Generated `graphify-out/graph.json`, `graphify-out/graph.html` and `graphify-out/GRAPH_REPORT.md`; verified JSON/HTML/report integrity plus bounded queries, node explanation and cross-domain shortest paths.
- Final graph after DB-first navigation audit: 2,879 nodes, 7,736 edges and 177 labeled communities. The audit added verified table-to-service and KPI-formula links and made the standard report's live-ad-cost option explicit. Benchmark estimates 15.3x fewer tokens per typical graph query than naive corpus reading.
- No application source, business logic, database, WB data, Google Sheet or production state was changed.

## 2026-09-02 - Project-scoped Graphify installation

- Confirmed Python 3.13.7 and `uv` 0.11.3 on the local Windows host.
- Installed official `graphifyy` 0.9.53 as an isolated `uv tool`; the `graphify` and `graphify-mcp` executables are available from the user tool bin.
- Registered the Graphify skill only for Codex project scope at `.codex/skills/graphify/`, added `.codex/hooks.json` and the generated Graphify guidance in `AGENTS.md`.
- Verified `graphify --version`, the installed skill version, hook execution and project files. The knowledge graph itself was intentionally not built in this task.
- No application source, business logic, database, WB data, Google Sheet or production state was changed.

## 2026-09-02 - Compact current/archive documentation memory

- Replaced oversized development/marketplace handoff and current-task files plus `PROJECT_STATE.md` with compact current snapshots. Original files moved unchanged to `docs/archive/snapshots/2026-09-02-pre-cleanup/`.
- Split active decisions and active bugs from complete historical ledgers; original ledgers remain in the snapshot.
- Moved obsolete Claude prompts and the completed dashboard roadmap into explicit archive folders.
- Rebuilt `docs/DOCS_INDEX.md`, corrected stale open questions, updated the project map, and changed documentation rules from mandatory multi-file duplication to one canonical detailed log plus bounded current state.
- Archived the pre-cleanup development and marketplace logs as closed historical segments; new entries continue at their canonical paths.
- No application code, database, environment, WB data, Google Sheet or production state was changed.
