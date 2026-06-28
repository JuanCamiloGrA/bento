# OCR Indexing Agent

## Mission

Implement OCR providers, OCR jobs, OCR persistence, and FTS indexing for images and PDFs.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/product/indexing-media.md`
- `/orchestration/product/search.md`
- `/orchestration/architecture/state-data-management.md`
- `/orchestration/testing/test-layers.md`

## Retrieve First

- RapidOCR official docs.
- pypdfium2 or selected PDF render docs if OCR needs page renders.
- SQLite FTS5 docs.

## Own These Paths

- `/apps/api/src/bento/adapters/ocr/**`
- `/apps/api/src/bento/application/indexing/ocr*`
- `/apps/api/src/bento/interfaces/worker/**` OCR handler registration only
- `/apps/api/tests/unit/ocr/**`
- `/apps/api/tests/integration/ocr/**`

## Starting Reality Check

- Ingestion/media and FTS foundation are merged.
- OCR provider port exists.
- Embeddings are not required for OCR search.

## Deliver

- `RapidOCRAdapter`.
- `MockOCRAdapter`.
- `DisabledOCRAdapter`.
- OCR job handler.
- Image OCR persistence to `asset_text` and `ocr_blocks`.
- PDF page OCR basic path.
- FTS indexing for OCR text.
- Processing state updates and manifest events.

## Constraints

- Do not implement embeddings or vector search.
- Do not change search scoring beyond exposing OCR-indexed text.
- Do not require RapidOCR model downloads during unit tests.

## Required Tests

- Mock OCR writes text and FTS records.
- Disabled OCR does not fail asset processing.
- OCR failure marks partial failure and preserves asset.
- PDF page OCR uses fake renderer/provider in tests.
- Search-by-OCR integration through FTS foundation.

## Definition Of Done

- OCR text from images/PDF pages becomes searchable through FTS.
- App behavior remains correct when OCR is disabled.
