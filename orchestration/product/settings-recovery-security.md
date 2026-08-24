# Product: Settings, Recovery, Security

## Settings

Settings UI/API must show and, where safe, edit:

- Storage backend mode.
- Telegram configured/not configured.
- OCR enabled/disabled.
- Embeddings enabled/disabled.
- Model available/pending.
- Worker status.
- Data paths where useful.
- Effective source (`default`, `saved`, `environment`, or `policy`) and restart scope for each field.

## Settings Information Architecture

Use a desktop-first two-pane layout with searchable categories:

- `General`: language, launch behavior, update channel when available.
- `Storage`: local/Telegram mode, data location, cache policy and current usage.
- `Telegram`: guided connection fields, connection test, and channel readiness.
- `AI e indexación`: OCR, embeddings, model state/download, and reindex consequences.
- `Rendimiento`: worker concurrency and CPU-safe presets.
- `Avanzado`: ports/source diagnostics, `.env` import, safe config export, logs, and reset.

The landing section summarizes overall health and calls out only actionable problems. Environment variable names belong in Advanced/help text, not as primary labels.

## Editing UX

- Use typed controls, inline help, examples, units, and validation before submit.
- Mask secret fields permanently; reveal only newly typed text while focused and never redisplay stored plaintext.
- Show a sticky dirty-state action bar with `Descartar` and `Guardar cambios`.
- Before apply, summarize affected services and whether indexing/storage behavior changes.
- `Guardar y reiniciar` restarts only the required sidecars and shows step-by-step progress without closing the window.
- A failed apply rolls back automatically and offers safe diagnostics/copyable error codes.
- Telegram and model setup use guided tests before the related mode can be enabled.
- Native folder pickers select data/model locations; typed paths remain an Advanced option.
- Provide `Importar .env`, `Exportar configuración sin secretos`, and per-section restore defaults.
- First run uses a short wizard: data location, local vs Telegram storage, optional local AI, review. Every choice remains editable later.

Settings remain fully keyboard navigable, announce validation/status changes, preserve focus after saves, honor reduced motion, and use the Spanish i18n dictionary.

## Configuration Safety

- A central typed registry is the single source for defaults, aliases, constraints, sensitivity, and restart scope.
- `host`, desktop ephemeral ports, launch token, and packaged executable paths are desktop-managed and not ordinary editable fields.
- Data-directory changes require validation, an explicit migration/copy choice, sufficient-space check, and full app restart.
- Storage-backend changes require a readiness check and must not imply deletion or migration of existing blobs.
- Enabling OCR/embeddings explains CPU, disk, model, and reindex impact.
- Worker concurrency defaults to `1`; UI presets must keep a safe choice visually recommended.
- Concurrent edits use a settings revision and return a conflict instead of silently overwriting newer values.

## Doctor

`make doctor` must detect:

- Docker available.
- Volumes writable.
- DB migrated.
- ffmpeg available.
- Model available or pending.
- Telegram configured or local mode active.

## Recovery And Manifest

Every important mutation writes a `manifest_events` record and can be exported as JSONL to `data/journal`.

Required event types:

- `asset_created`
- `asset_updated`
- `asset_deleted`
- `folder_created`
- `folder_moved`
- `blob_stored`
- `thumbnail_created`
- `ocr_indexed`
- `embedding_indexed`

Restore can be basic or partial in MVP.

## Security

- Local private app.
- Bind to localhost by default.
- No cloud AI.
- No secrets in logs.
- Upload validation and path traversal protections.
- `EncryptionPort` required with `NoOpEncryptionAdapter`; AES-GCM optional.

## Ownership

Settings/recovery backend owner: sqlite-data and storage/telegram agents by slice.
Frontend owner: jobs-settings-ui agent.
Release validation owner: release-hardening agent.
