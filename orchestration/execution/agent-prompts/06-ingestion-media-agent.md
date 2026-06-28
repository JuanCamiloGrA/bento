# Ingestion Media Agent

## Mission

Implement upload ingestion and media processing for local mode, including metadata, thumbnails, previews, PDF first page, video thumbnail, and worker orchestration.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/product/upload.md`
- `/orchestration/product/indexing-media.md`
- `/orchestration/api/asset-upload-contract.md`
- `/orchestration/api/endpoint-map.md`
- `/orchestration/architecture/performance-security.md`
- `/orchestration/testing/critical-journeys.md`

## Retrieve First

- Official FastAPI file upload docs.
- Pillow or pyvips docs.
- ffmpeg/ffprobe docs.
- pypdfium2 or selected PDF render library docs.
- Python mimetypes/filetype library docs if used.

## Own These Paths

- `/apps/api/src/bento/application/ingestion/**`
- `/apps/api/src/bento/application/media/**`
- `/apps/api/src/bento/adapters/media/**`
- `/apps/api/src/bento/interfaces/http/routes/assets*`
- `/apps/api/src/bento/interfaces/worker/**` media dispatch and handlers
- `/apps/api/tests/unit/ingestion/**`
- `/apps/api/tests/integration/media/**`
- `/apps/api/tests/api/assets/**`

## Starting Reality Check

- Domain, SQLite, job queue, manifest, and local storage are merged.
- Telegram storage is not required for local upload success.

## Deliver

- Upload use case and `/api/assets/upload`.
- Asset detail, download, thumbnail, preview, delete routes.
- sha256 dedupe.
- Basic metadata and EXIF extraction where available.
- Thumbnail/preview generation for images.
- PDF first-page thumbnail.
- Basic video thumbnail.
- Job handlers for media work.
- Manifest events for asset/blob/thumbnail changes.

## Constraints

- Do not implement OCR extraction or embeddings.
- Do not implement Telegram blob store.
- Do not block upload response on thumbnails/OCR/embeddings.
- Do not load originals for list/search display.

## Required Tests

- Upload success in local mode.
- Duplicate upload idempotency.
- Logical delete.
- Download uses blob store.
- Thumbnail job creates expected records/files.
- PDF/video thumbnail handlers with tiny fixtures or fakes.
- API error model tests for missing assets and unsupported preview.

## Definition Of Done

- User can upload, see asset record, download, and eventually get thumbnail/preview in local mode.
- Background media jobs are observable and retryable.
