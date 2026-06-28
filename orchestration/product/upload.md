# Product: Upload And Ingestion

## Scope

Upload accepts files from the web UI and Telegram bot/webhook, deduplicates by sha256, stores the blob in the configured backend, creates an asset, and enqueues background processing.

## Required Behavior

- Upload from web.
- Share file to Telegram bot.
- Upload to a selected Drive folder.
- Upload photos into Photos timeline.
- Compute sha256 server-side.
- Deduplicate by sha256.
- Extract basic metadata: filename, original filename, MIME, size, created/taken date when available.
- Extract EXIF for images when available.
- Store blob through `BlobStorePort`.
- Create asset in SQLite.
- Write manifest events.
- Enqueue thumbnails, OCR when applicable, embeddings when applicable.
- Respond quickly to UI before OCR/embedding completion.

## Pipeline

1. Receive file.
2. Save temporary file.
3. Compute sha256.
4. Detect duplicate.
5. Extract MIME, size, name.
6. Extract EXIF if image.
7. Store blob.
8. Create asset.
9. Enqueue thumbnail job.
10. Enqueue OCR job if supported.
11. Enqueue embedding job if enabled.
12. Return asset and processing state.

## Processing Priorities

- P0: save blob and create asset.
- P1: thumbnail.
- P2: enriched metadata.
- P3: OCR.
- P4: embedding.

## Ownership

Implementation owner: ingestion-media agent.
