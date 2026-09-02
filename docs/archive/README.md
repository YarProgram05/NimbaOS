# Documentation Archive

Историческая память NimbaOS, исключенная из обычного startup context.

Архивные документы сохраняют provenance, прежние статусы, выполненные планы и superseded instructions. Они не являются источником текущей истины и читаются только при расследовании истории.

## Structure

- `legacy/` — устаревшие инструкции и старые agent workflows.
- `plans/` — выполненные или superseded roadmaps.
- `snapshots/` — неизмененные снимки документов перед структурной чисткой.
- `development/` — закрытые segments development log.
- `marketplace/` — закрытые segments marketplace analysis log.

## Authority Rule

Если archive противоречит активному документу, приоритет имеет активный документ по его каноническому пути. Для текущих фактов использовать `AGENTS.md`, `docs/DOCS_INDEX.md`, `DECISIONS.md`, `docs/core/*` и role handoff/current-task files.

Не добавлять archive-файлы в startup reading list. Будущий knowledge graph должен исключать их из канонического semantic corpus либо явно маркировать как historical/superseded.
