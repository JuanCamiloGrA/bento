# State And Data Management

## SQLite Source Of Truth

Initial tables:

- `assets`
- `folders`
- `albums`
- `album_assets`
- `blob_refs`
- `thumbnails`
- `asset_text`
- `asset_embeddings`
- `pdf_pages`
- `ocr_blocks`
- `jobs`
- `manifest_events`
- `settings`

Use SQLAlchemy 2 models and Alembic migrations. Keep DB models in adapters/infrastructure; do not expose them as domain entities.

## Processing States

Assets move through these states:

- `created`
- `blob_stored`
- `metadata_extracted`
- `thumbnail_pending`
- `thumbnail_ready`
- `ocr_pending`
- `ocr_ready`
- `embedding_pending`
- `embedding_ready`
- `indexed`
- `failed_partial`
- `failed`

Partial failures must preserve usable asset access whenever the original blob is stored.

## Jobs

- Queue lives in SQLite.
- Workers claim jobs with locking fields: `locked_by`, `locked_at`, `attempts`, `max_attempts`.
- Default concurrency is `1`.
- Priority order: P0 blob/asset, P1 thumbnail, P2 enriched metadata, P3 OCR, P4 embedding.
- Retries use bounded exponential backoff and persist final error.

## Search Indexes

- FTS5 indexes filename, OCR text, and textual metadata.
- sqlite-vec stores vector records or vector refs.
- Search combines FTS, vector, metadata, and recency scores.
- Search must degrade gracefully when vector or OCR providers are disabled.

## Manifest Journal

Each important change writes a `manifest_events` row. JSONL export writes to `data/journal`. Telegram journal publishing occurs only in Telegram storage mode.

Required events:

- `asset_created`
- `asset_updated`
- `asset_deleted`
- `folder_created`
- `folder_moved`
- `blob_stored`
- `thumbnail_created`
- `ocr_indexed`
- `embedding_indexed`

Restore can remain basic or partial for MVP, but event writes and JSONL export are required.

## Frontend State

- Use TanStack Query for server state.
- Use local component state for UI-only state such as selected items, active layout, dialogs, and context menus.
- Do not create a global client store unless a feature has cross-route UI state that TanStack Query cannot represent.

## Configuration State

- SQLite stores versioned non-secret settings, their source metadata, and the last-known-good revision.
- A settings registry defines validation and restart scope; do not duplicate these rules in React or Electron.
- Secret values are held outside SQLite by the desktop secure store; SQLite may contain only opaque references and configured/missing state.
- Settings drafts are local form state. TanStack Query owns schema, effective values, validation results, and apply progress returned by API/desktop bridge.
- Applying settings uses optimistic concurrency. API and worker start from the same immutable effective snapshot for a revision.
