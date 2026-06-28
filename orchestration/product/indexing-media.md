# Product: Indexing And Media Processing

## Scope

Media processing creates thumbnails/previews and searchable units for assets.

## Thumbnails And Previews

Images:

- `thumb_sm`: 256px max side.
- `thumb_md`: 512px max side.
- `preview`: 1600px max side.

Videos:

- One thumbnail at second `1` or `10%`, whichever is smaller.
- No multiple keyframes in MVP.

PDFs:

- Thumbnail of first page.
- OCR pages in background.

## OCR

- RapidOCR adapter extracts text from images and PDF page renders.
- OCR writes `asset_text`, `ocr_blocks`, and FTS index records.
- Disabled OCR adapter is valid and must not break search by filename/metadata.

## Embeddings

- Jina v5 omni nano GGUF local adapter embeds text and images.
- Mock and disabled providers are required for tests and fallback.
- Embeddings write `asset_embeddings` and sqlite-vec records.
- Embeddings are optional; the app must still work without them.

## Constraints

- CPU-first.
- Small batches.
- Worker concurrency default `1`.
- Do not load original Telegram blobs for listing.
- Cache generated thumbnails/previews locally.

## Ownership

Media owner: ingestion-media agent.
OCR owner: ocr-indexing agent.
Embedding owner: embeddings-agent.
