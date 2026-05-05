# NimbaOS

NimbaOS is a private web platform for digitizing Wildberries seller cabinets: products, references, financial reports, sales planning, advertising campaigns, and future background sync.

This README is a short human entrypoint. It is not the agent memory system.

## Documentation

For Codex sessions:
- start with `docs/AGENTS.md`;
- use `docs/DOCS_INDEX.md` to choose task-specific documents;
- use `docs/HANDOFF.md` and `docs/CURRENT_TASKS.md` to restore current context.

Core documents:
- `docs/SPECIFICATION.md` — stable product specification;
- `docs/DECISIONS.md` — architecture and product decisions;
- `docs/PROJECT_STATE.md` — implementation status;
- `docs/SAFETY_RULES.md` — production and data safety rules.

## Stack

- Node.js 22
- Next.js 14 App Router
- TypeScript strict
- PostgreSQL 16 and Prisma 7
- Redis and Bull MQ
- Tailwind CSS v4 and shadcn/ui
- NextAuth.js
- Docker Compose

## Safe Local Commands

See `docs/COMMANDS.md` for the full command policy.

Usually safe:

```bash
npm run type-check
npx prisma validate
```

Use with caution:

```bash
npm run dev
npx prisma generate
```

Require explicit confirmation:
- migrations against production;
- full historical WB sync;
- WB price, card, advertising, or budget changes;
- destructive filesystem or database commands.

## Current Status

Phases 0-6 are complete. Phase 7 advertising is implemented at code level and still needs live verification after WB advert API rate-limit windows. Phases 8-9 are next.

For fresh status, read `docs/HANDOFF.md`, then `docs/CURRENT_TASKS.md`.
