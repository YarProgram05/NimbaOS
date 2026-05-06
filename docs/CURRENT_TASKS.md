# Current Tasks

## Active

### TASK-P8-SYNC-ERRORS

Status: Open  
Priority: High  
Description: Phase 8 background sync still needs live verification after WB API long rate limits. The known advertising stats Prisma numeric overflow in `adCampaignNmStat` was fixed at code level on 2026-05-05 by normalizing DB-bound metrics. `/sync` now supports deleting non-running queue/history items.  
Next step: After WB retry windows clear, run one read-only smoke per failing job type before declaring Phase 8 live-verified.  
Related files: `docs/BUGS_AND_INCIDENTS.md`, `src/lib/queue/sync-processor.ts`, `src/lib/services/sync-ad-stats.ts`, `src/lib/sync/job-runs.ts`, `src/app/(dashboard)/sync`  
Risks: Do not spam WB sync buttons while a same-kind job is queued/running; respect retry windows.

Нет активных незаблокированных задач.

## Next

### TASK-P9-POLISH

Status: Planned  
Priority: Medium  
Description: Phase 9 — финальная доработка: Excel, responsive, Docker/prod polish.  
Next step: Уточнить приоритеты после Phase 8 или отдельного запроса пользователя.  
Related files: `README.md`, `docker-compose.dev.yml`, app UI modules  
Risks: Production commands and migrations require explicit confirmation.

## Blocked

### TASK-P7-VERIFY

Status: Blocked by WB API  
Priority: High  
Description: WB advert API вернул `429` с retry около 42 минут при live-check.  
Next step: Повторить позже; если повторяется, записать новый инцидент и проверить лимиты/расписание запросов.  
Related files: `src/lib/wb-api/advertising.ts`, `src/lib/services/sync-ad-stats.ts`, `scripts/debug-advertising.ts`, `docs/BUGS_AND_INCIDENTS.md`, `docs/DATA_FRESHNESS_POLICY.md`  
Risks: Не ждать долгий retry в интерактивном UI; не запускать управляющие рекламные действия без подтверждения.

## Done recently

### TASK-P8-BACKGROUND-SYNC

Status: Done at code level  
Priority: Medium  
Description: Phase 8 реализована: Bull MQ очередь `sync`, история `SyncJobRun`, worker, scheduler, мини-экран `/sync`, ручной запуск read-only WB sync и перевод существующих sync-кнопок на фоновые jobs.  
Next step: Применить schema к dev DB (`db push`/migration) только после явного подтверждения и затем выполнить live smoke для одного read-only job.  
Related files: `src/lib/queue`, `src/lib/actions/sync.ts`, `scripts/sync-worker.ts`, `scripts/schedule-sync.ts`, `src/app/(dashboard)/sync`, `prisma/schema.prisma`  
Risks: Redis/PostgreSQL должны быть подняты; historical/full sync не запускается автоматически.

### TASK-P7-COMPLETE

Status: Done  
Priority: High  
Description: Phase 7 доведена на уровне кода: pause action, per-nm advertising spend, report integration, debug script, WB client long-429 protection.  
Next step: Live verification after rate-limit.  
Related files: `docs/DEV_LOG.md`, `docs/BUGS_AND_INCIDENTS.md`  
Risks: Live data may reveal WB response shape differences.
