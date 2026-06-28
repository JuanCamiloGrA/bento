# System Overview

Telegram Private Cloud MVP Lite is a local-first web app that uses Telegram only as optional remote blob storage. Product state, metadata, indexes, jobs, previews, thumbnails, folders, albums, and manifests live locally in SQLite and local volumes.

## Runtime Processes

- `web`: React + Vite UI served locally.
- `api`: FastAPI HTTP interface, local settings, upload orchestration, use-case boundary.
- `worker`: Python background process using the same backend package as `api`.
- `telegram-bot-api`: local Telegram Bot API server in `--local` mode.

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
