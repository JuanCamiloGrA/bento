# Storage Agent

## Mission

Implement local blob storage and encryption-port plumbing so uploads can persist blobs without Telegram.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/product/storage-telegram.md`
- `/orchestration/product/settings-recovery-security.md`
- `/orchestration/architecture/performance-security.md`
- `/orchestration/api/error-model.md`

## Retrieve First

- Python pathlib/tempfile docs.
- Current cryptography docs only if implementing optional AES-GCM adapter.

## Own These Paths

- `/apps/api/src/bento/adapters/storage/local*`
- `/apps/api/src/bento/adapters/security/**`
- `/apps/api/src/bento/infrastructure/storage/**`
- `/apps/api/tests/integration/storage/**`
- `/apps/api/tests/unit/security/**`

## Starting Reality Check

- SQLite data stage is merged.
- `BlobStorePort` and `EncryptionPort` exist.
- Local mode is mandatory and default.

## Deliver

- `LocalBlobStoreAdapter` for put/get/delete/exists.
- Safe path layout by sha256 or asset/blob id.
- `NoOpEncryptionAdapter`.
- Optional `LocalAesGcmEncryptionAdapter` if small and well-tested.
- Storage factory/config for `STORAGE_BACKEND=local`.

## Constraints

- Do not implement Telegram storage.
- Do not implement upload endpoint.
- Do not bypass `BlobStorePort`.
- Do not store absolute local paths in public API responses.

## Required Tests

- Put/get/exists/delete using temp directory.
- Path traversal rejection.
- NoOp encryption round-trip behavior.
- Local mode config works without Telegram env vars.

## Definition Of Done

- Local blob storage is production-usable for MVP.
- Storage code is ready for ingestion-media.
