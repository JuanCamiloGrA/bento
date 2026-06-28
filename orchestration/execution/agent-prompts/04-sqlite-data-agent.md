# SQLite Data Agent

## Mission

Implement SQLite persistence, migrations, repositories, FTS foundation, manifest events, settings, and persistent job queue.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/architecture/state-data-management.md`
- `/orchestration/architecture/api-integration.md`
- `/orchestration/product/jobs.md`
- `/orchestration/product/settings-recovery-security.md`
- `/orchestration/api/jobs-events-contract.md`
- `/orchestration/testing/test-layers.md`

## Retrieve First

- Official SQLAlchemy 2 docs.
- Official Alembic docs.
- SQLite FTS5 docs.
- sqlite-vec docs for schema compatibility only; full vector implementation belongs to embeddings agent.

## Own These Paths

- `/apps/api/alembic.ini`
- `/apps/api/migrations/**`
- `/apps/api/src/bento/infrastructure/db/**`
- `/apps/api/src/bento/adapters/repositories/**`
- `/apps/api/src/bento/adapters/search/sqlite_fts*`
- `/apps/api/src/bento/adapters/jobs/**`
- `/apps/api/src/bento/adapters/settings/**`
- `/apps/api/src/bento/adapters/manifest/**`
- `/apps/api/tests/integration/db/**`
- `/apps/api/tests/integration/jobs/**`

## Starting Reality Check

- Domain contracts and ports are merged.
- No media/storage-specific adapters are required for this stage.

## Deliver

- Initial tables from state-data docs.
- Alembic migration flow.
- Repository adapters for assets, folders, albums, settings, manifest events.
- FTS5 text indexing foundation.
- SQLite job queue with claim/complete/fail/retry.
- JSONL manifest export.
- DB session/config wiring.

## Constraints

- Do not implement upload/media/OCR/embedding business flows.
- Do not implement Telegram.
- Do not expose SQLAlchemy models outside adapter/infrastructure boundary.
- Do not edit frontend.

## Required Tests

- Migration smoke on temp SQLite DB.
- Repository CRUD and logical delete tests.
- Folder move cycle persistence tests.
- FTS insert/search tests.
- Job queue claim locking, retry, max attempts tests.
- Manifest event write/export tests.

## Definition Of Done

- Temporary SQLite integration tests pass.
- Repositories satisfy ports.
- Job queue is ready for worker handlers.
