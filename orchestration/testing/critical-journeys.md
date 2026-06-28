# Critical Journeys

These journeys must be covered before release.

1. Fresh clone setup: copy `.env.example`, run Docker Compose, open app.
2. Local mode upload: upload file, see it in Drive, download it.
3. Photo upload: upload image, thumbnail appears, timeline groups by date, lightbox opens.
4. Folder operations: create, rename, move, list, logical delete.
5. Jobs visibility: thumbnail/OCR/embedding jobs appear, complete or fail visibly, retry works.
6. Search by filename: result appears without OCR/embeddings.
7. Search by OCR: image/PDF text appears after indexing.
8. Semantic search: indexed photo appears when embedding provider is enabled or mocked.
9. Disabled embeddings: app still searches by filename/OCR/metadata.
10. Disabled Telegram/local mode: app works with `STORAGE_BACKEND=local`.
11. Telegram mode smoke: configured adapter uploads/downloads through local Telegram Bot API with fake or real test channel.
12. Manifest export: important events are persisted and JSONL export contains them.
