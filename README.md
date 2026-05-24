# NimbaOS

NimbaOS is a private web platform for digitizing Wildberries seller cabinets: products, references, financial reports, sales planning, advertising campaigns, reviews, stocks, and background sync.

This README is a short human entrypoint. It is not the agent memory system.

## Documentation

For Codex sessions:
- start with `AGENTS.md`;
- use `docs/DOCS_INDEX.md` to choose task-specific documents;
- for development work read `docs/development/DEV_HANDOFF.md` and `docs/development/DEV_CURRENT_TASKS.md`;
- for marketplace analysis read `docs/marketplace/MARKETPLACE_HANDOFF.md` and `docs/marketplace/MARKETPLACE_CURRENT_TASKS.md`.

Core documents:
- `SPECIFICATION.md` — stable product specification;
- `DECISIONS.md` — architecture and product decisions;
- `docs/core/PROJECT_STATE.md` — implementation status;
- `docs/core/SAFETY_RULES.md` — production and data safety rules;
- `docs/core/DATA_FRESHNESS_POLICY.md` — DB-first analytics and sync rules.

## Stack

- Node.js 22
- Next.js 14 App Router
- TypeScript strict
- PostgreSQL 16 and Prisma 7
- Redis and BullMQ
- Tailwind CSS v4 and shadcn/ui
- NextAuth.js
- Docker Compose

## Production VPS

Production target is a VPS with Docker Compose. Copy `.env.production.example` to `.env.production`, fill real secrets on the server, then validate the compose file before running anything:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

The production stack contains PostgreSQL, Redis, the Next.js standalone app, BullMQ worker, optional one-shot Prisma migration service, and optional scheduler service. Nginx reverse-proxy example lives in `deploy/nginx/nimbaos.conf`.

## Safe Local Commands

See `docs/core/COMMANDS.md` for the full command policy.

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
- WB price, card, advertising, feedback answer, or budget changes;
- destructive filesystem or database commands.

## Current Status

Phases 0-9 are implemented at code level. Phase 7/8 live WB verification and real production rollout remain explicit follow-up tasks.

For fresh status, read `AGENTS.md`, then choose the role-specific docs through `docs/DOCS_INDEX.md`.
