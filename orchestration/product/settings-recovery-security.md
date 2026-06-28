# Product: Settings, Recovery, Security

## Settings

Settings UI/API must show:

- Storage backend mode.
- Telegram configured/not configured.
- OCR enabled/disabled.
- Embeddings enabled/disabled.
- Model available/pending.
- Worker status.
- Data paths where useful.

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
