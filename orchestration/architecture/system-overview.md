# System Overview

Telegram Private Cloud MVP Lite is a local-first web app that uses Telegram only as optional remote blob storage. Product state, metadata, indexes, jobs, previews, thumbnails, folders, albums, and manifests live locally in SQLite and local volumes.

## Runtime Processes

- `desktop`: Electron main/preload process; owns the native window, lifecycle, secure desktop secrets, file pickers, updates, and supervision of local sidecars.
- `web`: React + Vite UI served locally.
- `api`: FastAPI HTTP interface, local settings, upload orchestration, use-case boundary.
- `worker`: Python background process using the same backend package as `api`.
- `telegram-bot-api`: local Telegram Bot API server in `--local` mode.

In packaged desktop builds, Electron loads the compiled React renderer and supervises packaged `api` and `worker` sidecars on loopback-only ephemeral ports. Docker Compose remains a supported development and headless deployment path; it is not a runtime dependency for desktop users. `telegram-bot-api` is started only when Telegram storage is enabled.

See `architecture/desktop-runtime-settings.md` for lifecycle, configuration precedence, IPC, secrets, and packaging rules.

## Storage Model

- SQLite is the source of truth.
- Local filesystem volumes store DB, cache, uploads, models, journals, and config.
- `LocalBlobStoreAdapter` must be fully functional without Telegram.
- `TelegramBlobStoreAdapter` uploads/downloads blobs through the local Telegram Bot API and stores Telegram message/file identifiers in SQLite.

## Core Flow

1. UI uploads file or Telegram webhook receives shared file.
2. API stores temp file, computes sha256, detects duplicates, extracts basic metadata.
3. API stores blob through `BlobStorePort`, creates asset, writes manifest events, enqueues jobs.
4. API responds quickly with asset state.
5. Worker creates thumbnails/previews first, then metadata enrichment, OCR, embeddings, and indexes.
6. UI polls/subscribes through API and displays indexing states without blocking.

## Configuration Flow

1. A central typed settings registry defines keys, types, defaults, constraints, sensitivity, source, and restart scope.
2. Non-secret user choices persist in SQLite; secrets are referenced by opaque IDs and stored by the Electron main process with the operating-system-backed secure store.
3. Desktop main launches sidecars from one effective settings snapshot and never writes a plaintext `.env` file.
4. Applying changes validates the full candidate configuration, persists it atomically, and restarts only the affected process group.
5. Headless/Docker mode continues to accept environment variables and clearly reports UI-locked overrides.

## Replaceable Adapters

- Blob storage: local, Telegram, future stores.
- OCR: RapidOCR, mock, disabled.
- Embeddings: Jina GGUF, mock, disabled.
- Vector DB: sqlite-vec now, future replacement.
- Jobs: SQLite queue now, future queue.
- UI surfaces: Drive and Photos replaceable without changing domain.

## Mandatory Failure Behavior

- App starts and works in local storage mode with no Telegram config.
- App starts and searches by name/metadata/FTS if embeddings are disabled.
- OCR and embedding failures move assets to partial failure states, not full UI failure.
- Worker crashes must leave jobs retryable or failed with visible errors.
