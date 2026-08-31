# Mini-PC Production Runbook

Каноническая карта Windows mini-PC, production runtime и безопасных операционных границ NimbaOS. Last updated: 2026-08-27.

## Purpose And Read When

Читать этот документ до любых действий, если задача касается mini-PC, production, SSH/Tailscale, Docker runtime, deploy, backup/restore, production database или диагностики production.

Этот runbook описывает стабильную топологию и порядок проверки. Текущее состояние конкретного релиза, активные инциденты и незавершенные задачи смотреть в [PROJECT_STATE.md](./PROJECT_STATE.md), [DEV_HANDOFF.md](../development/DEV_HANDOFF.md) и [DEV_CURRENT_TASKS.md](../development/DEV_CURRENT_TASKS.md). Команды и их safety classification находятся в [COMMANDS.md](./COMMANDS.md).

## Canonical Environment Map

| Контур | Local development laptop | Production mini-PC |
| --- | --- | --- |
| Host | Текущий development laptop | `WIN-SK69NVLD6F0` |
| Windows user | Текущий trusted developer | `n8929` |
| Repository path | `D:\VScode my projects\Nimba_digitization` | `C:\NimbaOS\nimba` |
| Canonical release branch | `main` | `main`; фактический checkout/HEAD всегда проверять перед операцией |
| Compose project | `nimba_digitization` | `nimba` |
| PostgreSQL container | `wb_postgres_dev` | `nimba-postgres-1` |
| PostgreSQL database | `wb_cabinet` | `nimba_production` |
| PostgreSQL access | `localhost:5432`, только локальный dev | Только внутри production Docker network |
| Redis | `wb_redis_dev`, `localhost:6379` | `nimba-redis-1`, только внутри production Docker network |
| Application | Next.js через `npm run dev` | `nimba-app-1`, host binding `127.0.0.1:3000` |
| Background runtime | Workers/schedulers выключены по умолчанию | `nimba-worker-1` и `nimba-automation-worker-1` |

Известные production container names являются текущими ожидаемыми именами, а не разрешением угадывать цель команды. Перед диагностикой подтвердить compose project `nimba`, service labels, working path и фактические контейнеры. При несовпадении остановиться.

Persistent PostgreSQL и Redis state хранится в Docker volumes. Кодовый checkout, Docker images и volumes имеют разные жизненные циклы: обновление кода или образа не должно заменять production data volumes.

Production `.env.production` не отслеживается Git. Его нельзя читать, печатать, копировать в чат, документацию, дамп команд или локальный dev-контур. Для понимания имен переменных использовать только example-файлы.

## Safe Connection And Identity Verification

Основной административный путь: Tailscale + key-based OpenSSH с доверенного development laptop. AnyDesk используется только как графический fallback.

Current documented endpoints:

- Preferred private DNS/application name: `win-sk69nvld6f0.tailc11887.ts.net`.
- Current documented Tailscale IP: `100.107.244.75`.
- Trusted-laptop private key path: `$env:USERPROFILE\.ssh\nimba_minipc_codex`.

Tailscale IP может измениться. Сначала проверить Tailscale status/DNS resolution; для SSH предпочитать DNS-name, если он разрешается и проходит identity check. Не показывать содержимое private key. Не принимать неожиданно изменившийся SSH host key без отдельной проверки.

Перед любой remote-командой:

1. Убедиться, что Tailscale подключен на обоих устройствах и endpoint принадлежит ожидаемому tailnet.
2. Проверить наличие trusted key локально, не открывая его содержимое.
3. Подключиться с `BatchMode`/`IdentitiesOnly`, чтобы не переходить незаметно на парольную аутентификацию.
4. На remote host выполнить read-only проверки `hostname` и `whoami`. Ожидаются `WIN-SK69NVLD6F0` и `n8929`.
5. Подтвердить repository root `C:\NimbaOS\nimba`, canonical branch/revision context и отсутствие неожиданного dirty state.
6. Подтвердить Docker compose project `nimba` и service labels. Не использовать имя контейнера как единственное доказательство контура.
7. При любом несовпадении host, user, path, compose project, database или labels остановиться до изменений.

Компактный local preflight:

```powershell
$key = "$env:USERPROFILE\.ssh\nimba_minipc_codex"
Test-Path -LiteralPath $key
Resolve-DnsName win-sk69nvld6f0.tailc11887.ts.net
ssh -o BatchMode=yes -o IdentitiesOnly=yes -i $key n8929@win-sk69nvld6f0.tailc11887.ts.net "hostname; whoami"
```

Если DNS-name не подходит для SSH, использовать только заново проверенный Tailscale IP. Дополнительные команды подключения находятся в [COMMANDS.md](./COMMANDS.md).

## Production Runtime And Persistent State

Production services:

- `app`: Next.js application, локально опубликован на `127.0.0.1:3000`.
- `postgres`: PostgreSQL с production database `nimba_production`.
- `redis`: BullMQ state и scheduler metadata.
- `worker`: read-oriented WB synchronization queue processor.
- `automation-worker`: product/workflow automation queue processor.
- One-shot migration и scheduler services существуют в compose profiles и не должны запускаться в обычной диагностике.

Stable paths:

- Checkout: `C:\NimbaOS\nimba`.
- Validated release backups: `C:\NimbaOS\backups`.
- Last successful deployment metadata: `C:\ProgramData\NimbaOS\deployments\last-successful.json`.

Не считать backup filename, hash, current commit, workflow run ID или row counts постоянными фактами. Их проверяют заново для конкретной операции.

## Read-Only Health And Diagnostics

После identity preflight безопасная диагностическая последовательность:

1. Проверить `git status --short --branch` и фактический repository root без checkout/reset/pull.
2. Выполнить `docker compose ... ps` из `C:\NimbaOS\nimba` и сопоставить services с compose project `nimba`.
3. Проверить health app, PostgreSQL и Redis, а также running state обоих workers.
4. Проверить `http://127.0.0.1:3000/api/health` на mini-PC. HTTP 200 подтверждает локальный application path, но не подтверждает public ingress.
5. При необходимости читать только bounded log tail. Перед передачей вывода удалить токены, cookies, authorization headers, API payloads и любые credentials.
6. Для DB-проверок использовать только bounded, read-only SQL и container-managed connection environment. Не выполнять `docker inspect`/`Get-Content` ради вывода environment и не печатать connection strings.
7. Проверять migration state, counts и integrity как текущие наблюдения, а не как вечные invariants.

Минимальная локальная health-команда на mini-PC:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health -UseBasicParsing
```

Полные operational commands не дублируются здесь: см. [COMMANDS.md](./COMMANDS.md). Правила запросов к БД: [DATABASE_ACCESS_GUIDE.md](./DATABASE_ACCESS_GUIDE.md). Общие запреты: [SAFETY_RULES.md](./SAFETY_RULES.md).

## Controlled Release Workflow

Канонический release flow:

1. Разработка и тестирование в local dev-контуре.
2. Commit/push intended changes в `main`.
3. Автоматический CI должен завершиться успешно.
4. Владелец вручную запускает GitHub Actions workflow `Deploy production` и подтверждает production deployment.
5. Self-hosted runner на mini-PC повторно проверяет commit и production preconditions.
6. Release создает и валидирует PostgreSQL backup.
7. Применяются только committed Prisma migrations.
8. Обновляются app и оба worker services, затем заново применяются sync/automation schedules.
9. Проверяются containers, local health и private Tailscale health.
10. Last-success metadata записывается только после успешной проверки.

Обычный push никогда не выполняет production deploy. Manual fallback команды, migrations, service recreation и schedule registration требуют отдельного явного rollout-подтверждения.

Application rollback не восстанавливает PostgreSQL автоматически. Database restore всегда является отдельной destructive recovery operation с явным подтверждением владельца.

## Backup, Restore And Dev Database Refresh

Release backups в `C:\NimbaOS\backups` должны быть custom-format PostgreSQL archives с проверенной читаемостью. Их нельзя удалять, перемещать, восстанавливать или подменять без явного разрешения.

Безопасная процедура refresh локальной dev-базы production snapshot:

1. Получить отдельное разрешение на export production data и перезапись локальной dev-базы.
2. Повторно доказать remote identity и production database target.
3. На production выполнить только read-only checks и `pg_dump`, используя временный artifact, не постоянный release backup.
4. Проверить `pg_restore --list`, размер и SHA-256 до передачи.
5. Передать artifact по Tailscale/SSH вне repository и сверить SHA-256 на laptop.
6. Доказать, что restore target является local Docker PostgreSQL на `localhost:5432`, а не mini-PC.
7. Остановить local app/workers и поднять только dev PostgreSQL/Redis.
8. Сначала восстановить snapshot в отдельную временную local database.
9. Проверить migrations, bounded table counts и integrity; row counts использовать только для сравнения конкретного snapshot.
10. Только после validation переключить local database на стандартное имя `wb_cabinet`.
11. При необходимости применить только committed local migrations, если текущая ветка действительно опережает snapshot.
12. Не копировать production Redis и не запускать local workers, schedulers, sync или WB write actions.
13. Удалить все временные dump copies с mini-PC, из container temp и с laptop после успешной проверки.

Snapshot может содержать encrypted production fields. Это не является основанием копировать production encryption secrets или `.env.production` в dev.

## Windows, Docker And Session Caveats

- Docker Desktop и self-hosted GitHub runner зависят от logged-in interactive Windows session `n8929`.
- Runner запускается scheduled task `NimbaOS GitHub Actions Runner`; наличие task само по себе не подтверждает доступность Docker engine.
- Обычная блокировка экрана безопасна и не должна останавливать runtime.
- После reboot или sign-out пользователь должен снова войти в Windows, прежде чем Docker Desktop и dependent production services смогут работать.
- Running scheduled task или Windows service не доказывает, что Docker engine и все containers доступны. Проверять фактический runtime и `/api/health`.
- Docker Desktop build из non-interactive SSH session может не получить Windows Credential Manager context. Нормальный release должен идти через настроенный interactive runner; AnyDesk/console используется для диагностики этого Windows-specific ограничения.

## Private And Public Ingress

- Current reliable private application URL: `https://win-sk69nvld6f0.tailc11887.ts.net` на trusted Tailscale devices.
- Production app слушает host только на `127.0.0.1:3000`.
- `app.nimbaos.ru` не является production-ready для affected Russian IPv4 clients: большие Next.js responses могут обрываться до hydration, даже если small health/API responses успешны.
- Не возвращать obsolete Cloudflare Worker custom-domain workaround и не объявлять public ingress исправленным по одному успешному запросу.
- Current active decision и варианты public ingress смотреть в [DEV_CURRENT_TASKS.md](../development/DEV_CURRENT_TASKS.md), [BUGS_AND_INCIDENTS.md](../development/BUGS_AND_INCIDENTS.md) и [DECISIONS.md](../../DECISIONS.md).
- Никогда не публиковать PostgreSQL, Redis или SSH в Internet. Administrative access остается через Tailscale/SSH.

## Approval Gates And Forbidden Actions

Read-only inspection после identity verification:

- repository status/root/branch inspection;
- compose/service/container status и labels;
- local/private health checks;
- bounded sanitized log tail;
- bounded read-only SQL для migration state, counts и integrity.

Требуют явного подтверждения владельца перед выполнением:

- deploy, rollback, migrations, checkout/pull и изменение production code;
- restart/recreate/stop containers или Windows services/tasks;
- создание/копирование production dump, backup cleanup или dev DB refresh;
- database restore, drop, rename, writes или historical overwrite;
- sync, scheduler/Redis changes, historical backfill и live WB API calls;
- изменение `.env.production`, credentials, Docker volumes, firewall, ingress, DNS, Tailscale membership или router settings.

Запрещено:

- читать, печатать или сохранять secrets, private keys, tokens, passwords, decrypted WB/KIZ values;
- угадывать host/path/container/database и продолжать после identity mismatch;
- автоматически восстанавливать database при application rollback;
- копировать production Redis в dev или запускать local workers/schedulers после snapshot restore;
- открывать PostgreSQL, Redis или SSH публично;
- использовать destructive filesystem/Git/database команды без отдельного точного разрешения.

## First Five Minutes For A New Agent

1. Прочитать `AGENTS.md`, [DOCS_INDEX.md](../DOCS_INDEX.md), этот runbook, [DEV_HANDOFF.md](../development/DEV_HANDOFF.md) и [DEV_CURRENT_TASKS.md](../development/DEV_CURRENT_TASKS.md).
2. Уточнить задачу: read-only diagnosis, release, backup/restore, dev refresh или network/ingress. Не смешивать контуры.
3. Проверить local `git status --short`; сохранить все unrelated user changes.
4. Если нужен remote access, проверить Tailscale endpoint, SSH key presence, host key, `hostname` и `whoami`.
5. Подтвердить `C:\NimbaOS\nimba`, compose project `nimba`, labels и database target до любой следующей команды.
6. Начать с `docker compose ps` и local `/api/health`; не считать public URL частью host health.
7. Перед любой mutation назвать точное действие, цель, backup/rollback boundary и получить явное подтверждение.
8. Не читать `.env.production`; не переносить секреты в логи, docs или chat.

## Related Canonical Docs

- [COMMANDS.md](./COMMANDS.md)
- [SAFETY_RULES.md](./SAFETY_RULES.md)
- [DATABASE_ACCESS_GUIDE.md](./DATABASE_ACCESS_GUIDE.md)
- [PROJECT_STATE.md](./PROJECT_STATE.md)
- [DEV_HANDOFF.md](../development/DEV_HANDOFF.md)
- [DEV_CURRENT_TASKS.md](../development/DEV_CURRENT_TASKS.md)
- [BUGS_AND_INCIDENTS.md](../development/BUGS_AND_INCIDENTS.md)
- [DECISIONS.md](../../DECISIONS.md)
