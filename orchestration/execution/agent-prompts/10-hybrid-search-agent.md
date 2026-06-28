# Hybrid Search Agent

## Mission

Implement global hybrid search API with query parsing, FTS/vector/metadata fusion, filters, facets, and explanations.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/product/search.md`
- `/orchestration/api/search-contract.md`
- `/orchestration/api/endpoint-map.md`
- `/orchestration/architecture/state-data-management.md`
- `/orchestration/testing/critical-journeys.md`

## Retrieve First

- SQLite FTS5 ranking docs.
- sqlite-vec search docs.
- FastAPI query parameter docs.

## Own These Paths

- `/apps/api/src/bento/application/search/**`
- `/apps/api/src/bento/adapters/search/composite*`
- `/apps/api/src/bento/interfaces/http/routes/search*`
- `/apps/api/tests/unit/search/**`
- `/apps/api/tests/integration/search/**`
- `/apps/api/tests/api/search/**`

## Starting Reality Check

- FTS foundation, OCR indexing, and embedding primitives are merged.
- Search must work if OCR or embeddings are disabled.

## Deliver

- Query parser for document-like, scene-like, and date-like queries.
- FTS, vector, metadata, and recency score fusion.
- Filters: type, folder, date range, limit, cursor.
- Facets.
- Search result explanations.
- `/api/search` route.
- Result processing/indexing state fields.

## Constraints

- Do not implement UI results page or frontend API hooks; search-ui owns that in Stage 9.
- Do not duplicate OCR or embedding adapters.
- Do not make vector search required for search success.

## Required Tests

- Query intent parsing.
- Weight/score fusion.
- Filename-only search with embeddings disabled.
- OCR search.
- Vector search with mock provider.
- Date/type/folder filters.
- Explanation text present for every result.
- API contract shape.

## Definition Of Done

- Global search meets MVP Lite behavior and degrades gracefully.
