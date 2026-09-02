# Active Decisions

Канонические действующие продуктовые и архитектурные решения NimbaOS. Полная история, включая superseded решения и legacy phase notes, сохранена в `docs/archive/snapshots/2026-09-02-pre-cleanup/DECISIONS.md`.

Last updated: 2026-09-02.

## 2026-09-02 — Project memory has current and archive layers

Status: Active.

Decision: Startup context состоит только из коротких канонических документов. Handoff заменяется, а не дописывается бесконечно; current-task files содержат Active/Next/Blocked и не более 3–5 недавних результатов. Подробный результат development-задачи записывается один раз в `DEV_LOG.md`, marketplace-анализа — один раз в `MARKETPLACE_ANALYSIS_LOG.md`. Выполненные планы, superseded instructions и pre-cleanup snapshots хранятся в `docs/archive` и не считаются текущей истиной.

Reason: Обязательное обновление нескольких файлов после каждой задачи создало семантические дубли, противоречащие next steps и стартовый контекст до 11–16 тысяч слов.

Consequences: Один факт имеет один канонический дом; остальные документы используют task/bug/decision ID и короткую ссылку. История не удаляется, но не загружается на старте и не должна попадать в будущий canonical knowledge graph без historical classification.

## 2026-09-01 — Sync kinds use one flexible time model

Status: Active.

Decision: Все sync kinds поддерживают одинаковые exact-time/weekday и bounded-interval modes. `SyncScheduleSetting.schedule` хранит JSON rule с legacy compatibility; scheduled payloads используют fingerprint/time, чтобы старые jobs пропускались после замены schedule.

Reason: Разные искусственные ограничения по sync kind усложняли UI и scheduler semantics.

## 2026-09-01 — Automation logic uses stable Sheet roles

Status: Active.

Decision: Workflow config связывает стабильные semantic roles с редактируемыми именами Google Sheet tabs. Runtime зависит от role contract, а не от display tab name; legacy config читается до следующего обычного save.

Reason: Переименование вкладки не должно незаметно менять смысл workflow.

## 2026-08-24 — Production releases require explicit confirmation

Status: Active.

Decision: Обычный production path — manual GitHub Actions workflow на self-hosted Windows mini-PC runner. Release выполняет preflight, backup, migration deploy, versioned image rollout и health verification только после явного запуска владельцем.

Reason: Production deploy меняет внешнее состояние и должен оставаться контролируемым и восстанавливаемым.

## 2026-08-24 — Russian employee ingress avoids Cloudflare response path

Status: Active.

Decision: Cloudflare Tunnel/Workers/proxied DNS не считаются надежным employee-access path для affected Russian IPv4 networks. Trusted access — Tailscale; предпочтительный public вариант — direct HTTPS через public/static ISP IPv4 и DNS-only.

Reason: Крупные Next.js assets обрывались через Cloudflare при исправной local/Tailscale delivery.

## 2026-08-12 — Post-handoff FBS KIZ association is preserved

Status: Active.

Decision: `canceled_by_client` и `defect` после handoff сохраняют order-to-KIZ association. Они создают return lifecycle, а не запрос нового кода. `UNKNOWN` означает отсутствие подтвержденного CRPT state и не подменяется догадкой.

Reason: Отвязка создавала ложный риск повторной маркировки.

## 2026-06-19 — Article versions preserve historical identity

Status: Active.

Decision: Новая физическая модель под существующим WB `nmId` оформляется как dated `ArticleVersion`. Reports и связанные analytics разрешают имя/себестоимость по event date.

Reason: Простое переименование смешивает старый и новый товар и искажает прибыльность.

## 2026-05-24 — Documentation is split into three canonical zones

Status: Active.

Decision: Root содержит `AGENTS.md`, `SPECIFICATION.md`, `DECISIONS.md`; `docs/core` хранит общую проектную правду, `docs/development` — development workflow/current memory, `docs/marketplace` — marketplace workflow/current memory. `docs/archive` хранит только исторические источники.

Reason: Разные роли должны получать релевантный контекст без дублирования общей архитектуры.

## 2026-05-14 — Financial-report advertising uses spend history totals

Status: Active.

Decision: `Реклама (все)` и распределение `Реклама (баланс)` исходят из согласованной WB spend-history allocation, а не только из неполных arbitrary-period `fullstats` nm rows.

Reason: Разные источники total и article allocation давали согласованный total с неверными строками.

## 2026-05-14 — Reports table owns scrolling and user column order

Status: Active.

Decision: `/reports` использует внутренний scroll table со sticky headers/totals; column order сохраняется в `UserPreference`.

Reason: Большой отчет должен сохранять controls и totals в видимой области.

## 2026-05-08 — Dashboard follows selected account

Status: Active.

Decision: Dashboard и navigation сохраняют выбранный `?account`; desktop sidebar остается управляемой частью рабочего интерфейса.

Reason: Account context не должен теряться при переходах.

## 2026-05-08 — Advertising sync tolerates WB empty responses and period limits

Status: Active.

Decision: Null fullstats трактуется как empty dataset. Cluster periods длиннее WB limit разбиваются на bounded chunks и агрегируются локально.

Reason: Ожидаемые empty/limit responses не должны падать как системные ошибки.

## 2026-05-05 — Database is the analytics source of truth

Status: Active.

Decision: Analytics/reports читают локальную БД. WB API обновляет БД через sync services; repeated historical sync требует явного подтверждения.

Reason: DB-first flow воспроизводим и устойчивее live ad-hoc API reads.

## FBS Operational Decisions

Status: Active.

- `/fbs` — отдельный bounded context; `/stocks` сохраняет WB/FBW semantics.
- NimbaOS владеет seller physical/reserved stock через transactional append-only movements; WB stock является отдельным reconciliation signal и публикуется только explicit action.
- Full KIZ хранится AES-256-GCM encrypted со стабильным account-scoped hash; UI/logs получают только разрешенное представление.
- Stage 1 Chestny Znak использует immutable XLSX batches и manual confirmation; direct True API — отдельный Stage 2.
- Любой WB FBS write требует explicit user action, warehouse `writeEnabled=true` и idempotent audit log. Gate по умолчанию выключен.
- Operational order-to-KIZ mapping приходит из WB FBS metadata; Finance rows служат delayed reconciliation.
- FBS finance связывается по account-scoped WB order ID; row-level `deliveryMethod=FBS` — только fallback.
- Remote-sale withdrawal начинается при handoff, не при создании заказа и не после final buyout. Accepted physical return оформляется отдельным событием.
- Workflow schedules живут в существующем config JSON и registry; BullMQ получает отдельные scheduler entries по effective time.
- FBS movement Sheet — DB-first lifecycle-event projection с idempotent technical keys, strict schema/formula/reconciliation guards и explicit tuple aliases.
- `Остаток WB` в Sheet приходит из свежего `fbs_assortment_items.wbStock`; local movement ledger не переписывается автоматически по расхождению.

Detailed original decisions 48–61 and all superseded phase decisions remain in the archived pre-cleanup snapshot.
