# NimbaOS

NimbaOS is a private web platform for digitizing Wildberries seller cabinets: products, references, financial reports, sales planning, advertising campaigns, and background sync.

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

## Production VPS

Production target is a VPS with Docker Compose. Copy `.env.production.example` to `.env.production`, fill real secrets on the server, then validate the compose file before running anything:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

The production stack contains PostgreSQL, Redis, the Next.js standalone app, BullMQ worker, optional one-shot Prisma migration service, and optional scheduler service. Nginx reverse-proxy example lives in `deploy/nginx/nimbaos.conf`.

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

Phases 0-9 are implemented at code level. Phase 7/8 live WB verification and real production rollout remain explicit follow-up tasks.

For fresh status, read `docs/HANDOFF.md`, then `docs/CURRENT_TASKS.md`.
