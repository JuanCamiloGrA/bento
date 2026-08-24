# Performance And Security

## Performance

- Use thumbnails/previews in grids and search results; never load originals for listing.
- API upload path must respond after blob storage, asset creation, and job enqueue; OCR/embedding work remains background.
- Worker default concurrency is `1`.
- Batch OCR and embeddings conservatively.
- Thumbnails run before OCR and embeddings.
- Videos receive one thumbnail at second `min(1, 10%)`; no deep video indexing in MVP.
- Long videos are not processed deeply by default.
- Virtualize photo grids, timelines, and long Drive lists.
- Use cursor/limit pagination for lists and search.

## Security

- Bind services to localhost by default in development.
- Never commit or log Telegram tokens, API hash, raw chat IDs, or local secrets.
- Validate and normalize upload filenames; never trust client paths.
- Compute sha256 server-side for deduplication.
- Prevent path traversal in downloads, cache lookup, extraction, and JSONL export.
- Treat MIME sniffing as advisory; store declared and detected metadata.
- Logical delete must not immediately remove remote blobs unless a specific purge use case is later added.
- Telegram adapters must not assume plaintext blobs; storage pipeline must allow `EncryptionPort`.
- Desktop renderer has no Node.js access and communicates only through an allowlisted preload bridge.
- Desktop sidecars use loopback-only ephemeral ports, per-launch authentication, and strict origin validation.
- Settings marked secret must be redacted at schema, API, IPC, logging, diagnostics, crash-report, and export boundaries.
- Desktop secure storage uses Electron `safeStorage`; verify encryption availability and never fall back silently to plaintext when the OS key store is unavailable.

## Encryption Port

Required interface:

```python
class EncryptionPort:
    async def encrypt_file(input_path, output_path) -> EncryptionMetadata: ...
    async def decrypt_file(input_path, output_path, metadata) -> None: ...
```

Initial adapters:

- `NoOpEncryptionAdapter`
- `LocalAesGcmEncryptionAdapter` optional for MVP Lite.

## Privacy

- No cloud AI services.
- OCR and embeddings run locally.
- The app must remain usable with OCR/embeddings disabled.
