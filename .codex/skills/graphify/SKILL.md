---
name: graphify
description: Use Graphify for explicit graph requests, broad architecture or dependency questions, and dedicated batch graph maintenance in NimbaOS. Do not invoke it for ordinary scoped bug fixes, exact-file edits, routine tests, deployments, or questions answerable from one or two known sources.
---

# Graphify for NimbaOS

Graphify is a derived navigation index. It helps locate relevant code and documentation, but it is not the source of truth and not a replacement for current production evidence or canonical Markdown.

## Choose the cheapest useful mode

1. **Direct source mode — default for scoped work.** If the task names a page, service, file, error, job kind, command, or other narrow component, use `rg` and the relevant source directly. Do not invoke Graphify just because the task concerns code.
2. **Read-only query mode — for orientation.** Use the existing graph when the entrypoint is unclear, the question spans several subsystems, or a dependency/path question would otherwise require broad searching.
3. **Maintenance mode — explicit and batched.** Update or rebuild the graph only when the user explicitly asks to maintain Graphify, or when the current task is itself a scheduled/dedicated memory-maintenance task.

Ordinary implementation work must not wait for Graphify maintenance. A stale graph is acceptable: use it only as a hint and verify against current sources.

## Read-only query mode

- If `graphify-out/graph.json` is missing, skip Graphify and navigate sources normally. Do not build a graph unless asked.
- Translate the question into up to 12 concise project vocabulary terms, including English symbol/domain names when the user asks in Russian.
- Run at most one initial query with a small budget:

```powershell
graphify query "TERM1 TERM2 TERM3" --budget 1000
```

- Use `graphify path "A" "B"` or `graphify explain "X"` only when the first result shows that a path or one-node explanation is materially useful.
- Open only the returned `source_file` locations needed for the task. Confirm exact behavior, formulas, contracts, and consequential claims in code or canonical documentation.
- If the result is noisy, stale, truncated, or misses the relevant entity, stop querying and use direct source search. Do not expand into repeated broad traversals.
- Do not regenerate clusters, reports, HTML, lessons, or semantic extraction in query mode.
- Do not call `graphify save-result` during normal work. Its default `graphify-out/memory` output is intentionally re-ingested by upstream Graphify and can create self-referential maintenance work.
- Do not run `graphify reflect` or read `graphify-out/reflections/LESSONS.md` unless the user explicitly asks to review Graphify's learning history.

## Maintenance mode

Maintenance is a separate task, not a completion requirement for the task that changed the sources.

### Lightweight code refresh

For a batch containing only code changes, prefer deterministic AST maintenance without semantic LLM work or clustering:

```powershell
graphify update . --no-cluster
```

Verify the command succeeded and run one focused query against a changed symbol. Do not generate HTML.

### Semantic incremental refresh

Use this only after a batch of important documentation, architecture, business-rule, metric, or data-contract changes. Read `references/update.md` for its extraction/cache/merge/manifest mechanics; its generic instruction to continue through full clustering/HTML is overridden by this project policy. Read `references/extraction-spec.md` only if uncached documents actually require semantic extraction.

- Process the whole accumulated batch once.
- Semantic subagents or an external LLM are allowed only inside this explicit maintenance task.
- Skip visualization and relabeling unless the user asks for them or community structure materially changed.
- Never save the verification query back into the project memory directory.
- Report changed source count, semantic files processed, graph health, and any remaining staleness.

### Full rebuild or clustering

Reserve a full rebuild for a missing/corrupt graph, a major directory or architecture rewrite, mass deletion/renaming, or an explicit user request. Run clustering/HTML only for a deliberate graph review:

```powershell
graphify cluster-only . --no-viz --no-label
```

Use `graphify export html` separately only when the user wants the visualization.

## Maintenance cadence

- Batch maintenance after several substantial merges, before a large cross-system refactor, or roughly every 1–4 weeks while the project is changing actively.
- Do not refresh after a small bug fix, wording edit, test-only change, one deployment, or a routine log entry.
- Canonical docs and code must be updated immediately when required; the derived graph may lag until the next batch.

## Other Graphify features

Load supporting references only for an explicit matching request:

- `references/add-watch.md` — URL ingestion or watch mode.
- `references/github-and-merge.md` — external repositories or multi-graph merge.
- `references/exports.md` — HTML, wiki, GraphML, Neo4j, FalkorDB, or MCP exports.
- `references/hooks.md` — hooks, only if the user explicitly asks to install them.

Do not install automatic hooks by default. Hooks that force a graph query before every read/search conflict with this project's low-overhead policy.

## Honesty and safety

- Graph edges may be inferred or stale. Never present them as stronger evidence than their source.
- Graphify never broadens permission to mutate production, databases, WB, or external systems.
- Keep generated `graphify-out/` artifacts separate from canonical project truth.
