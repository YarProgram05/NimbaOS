# Safety Rules

Правила безопасности для агентов и разработчиков. Last updated: 2026-05-24.

## Secrets

- Не читать `.env`.
- Не выводить токены, пароли, ключи, decrypted WB API keys.
- Использовать `.env.example` только для понимания имен переменных.
- Не сохранять секреты в docs, logs, screenshots, issues.

## Read-Only By Default

Разрешено читать исходный код, Prisma schema, migrations, docs, package files, `.env.example`. В documentation-only задачах изменять только `.md`.

## Requires Explicit Confirmation

- Production migrations and deploy commands.
- Full historical WB sync or historical data overwrite.
- Destructive database/filesystem commands.
- WB price/discount/card changes.
- Advertising bid/budget/status changes.
- Feedback answer writes or bulk writes.
- Any command likely to call live WB API outside a requested sync/debug task.

## Database Safety

- Prefer dry-run/inspection before applying changes.
- Never delete or rewrite production data without confirmation.
- Do not use Prisma Studio for manual destructive edits unless explicitly requested.
- Bound analytical queries by `wbAccountId` and period.

## WB Safety

- Marketplace recommendations are advisory.
- Agent-manager must not change prices, cards, ads, bids, stocks or discounts.
- Sync can update local DB only through existing sync services.
- Write-capable methods in WB API map are dangerous.

## Documentation Safety

- Do not duplicate core truth into development/marketplace docs.
- Put uncertain facts under `docs/core/OPEN_QUESTIONS.md`.
- Update role docs after significant work.

