# Embeddings Agent

## Mission

Implement local embedding providers, sqlite-vec storage, embedding jobs, and vector search primitives.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/product/indexing-media.md`
- `/orchestration/product/search.md`
- `/orchestration/architecture/state-data-management.md`
- `/orchestration/architecture/performance-security.md`

## Retrieve First

- Jina v5 omni nano GGUF model docs.
- llama.cpp server or selected wrapper docs.
- sqlite-vec official docs.

## Own These Paths

- `/apps/api/src/bento/adapters/embeddings/**`
- `/apps/api/src/bento/adapters/search/sqlite_vec*`
- `/apps/api/src/bento/application/indexing/embedding*`
- `/apps/api/src/bento/interfaces/worker/**` embedding handler registration only
- `/apps/api/tests/unit/embeddings/**`
- `/apps/api/tests/integration/embeddings/**`
- `/scripts/benchmark/**`

## Starting Reality Check

- Ingestion/media is merged.
- OCR may be merged but is not required for embedding tests.
- sqlite-vec schema hooks exist or can be added in owned adapter/migration extension with coordination if needed.

## Deliver

- `JinaOmniNanoGgufAdapter`.
- `MockEmbeddingProvider`.
- `DisabledEmbeddingProvider`.
- sqlite-vec vector adapter.
- Text/image embedding jobs.
- Embedding metadata persistence.
- Basic benchmark/timing script.
- Graceful disabled/missing-model behavior.

## Constraints

- No cloud embedding APIs.
- Do not make GPU required.
- Do not block UI/API upload flow.
- Do not implement final hybrid scoring; expose vector search primitives for hybrid-search.

## Required Tests

- Mock provider embedding flow.
- Disabled provider no-op/degraded behavior.
- sqlite-vec insert/search with skip or fallback when extension unavailable.
- Missing model reports pending/unavailable status safely.
- Worker embedding job updates state and manifest events.

## Definition Of Done

- Indexed embeddings can be searched through a port.
- The app remains usable without model files.
