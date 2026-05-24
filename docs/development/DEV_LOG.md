# Development Log

Новые записи добавлять сверху. В начале сессии не читать целиком.

## 2026-05-24 — Documentation 3-zone rebuild

### Summary
Пересобрана Markdown-документация под `docs/core`, `docs/development`, `docs/marketplace`. Созданы канонические root `AGENTS.md`, `SPECIFICATION.md`, `DECISIONS.md`; старая документация сохранена как legacy/redirect или архив.

### Files changed
Только `.md` файлы документации.

### Commands run
Read-only inspection: file listing, Markdown headings search, Prisma model/index search, export/function search, migration index search. Также создана структура папок docs.

### Result
Будущая сессия стартует с `AGENTS.md` и `docs/DOCS_INDEX.md`, затем выбирает development или marketplace документы по задаче.

### Issues
Часть старых docs в терминале отображалась с битой кодировкой, но была использована как источник смысла и сохранена.

### Follow-up
После подтверждения можно удалить или оставить старые flat docs; пока они сохранены.

