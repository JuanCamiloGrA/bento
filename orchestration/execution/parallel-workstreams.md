# Parallel Workstreams

## Rules

- Parallel means separate git worktrees.
- Same-stage agents may run in parallel only when owned paths do not overlap.
- Each agent merges only after its stage is complete and green.
- Later stages start only after prior stages are merged and green.
- Shared files have exactly one temporary owner per stage.
- If an agent needs a shared-file change it does not own, it records a handoff request.

## Shared File Ownership By Stage

Stage 1:

- Foundation owns all root config and scaffold files.

Stage 2:

- Domain-contracts owns backend package contracts.
- Web-design-system owns frontend primitives, tokens, i18n, shell.

Stage 3:

- Sqlite-data owns backend DB, migrations, repository adapters, settings repository, manifest repository, job queue.
- Storage-agent owns local blob storage adapter after sqlite-data is merged.

Stage 4:

- Ingestion-media owns upload/media routes, use cases, worker handlers, media adapters.

Stage 5:

- Telegram-storage owns Telegram adapters, webhook ingestion, telegram compose/config adjustments.

Stage 6:

- Ocr-indexing owns OCR adapters, OCR jobs, OCR indexing.

Stage 7:

- Embeddings owns embedding providers, sqlite-vec adapter, embedding jobs.

Stage 8:

- Hybrid-search owns search use cases, search adapters composition, and search API.

Stage 9:

- Search-ui owns Search and Documents feature paths.
- Drive-ui owns Drive feature paths.
- Photos-ui owns Photos/Albums/Favorites feature paths.
- Jobs-settings-ui owns Jobs/Settings feature paths and status indicator integration.
- If shared frontend API client changes are needed, jobs-settings-ui is temporary owner in Stage 9 and other UI agents request additions through it.

Stage 10:

- Release-hardening owns root docs, seed/smoke/e2e scripts, final config polish, and cross-cutting fixes.

## Fastest Safe Sequence

1. Foundation.
2. Domain-contracts and web-design-system in parallel.
3. Sqlite-data, then storage-agent.
4. Ingestion-media.
5. Telegram-storage can run after ingestion local path is green.
6. OCR and embeddings can run after ingestion-media; they do not run in parallel if both need the same indexing dispatcher. If dispatcher changes are required, ocr-indexing owns it first, embeddings extends through registered interfaces.
7. Hybrid-search after OCR and embeddings indexing contracts are merged.
8. Search-ui, drive-ui, photos-ui, jobs-settings-ui in parallel after relevant API contracts are stable.
9. Release-hardening last.

## User-Visible Behavior Ownership

- Clone/run/open local app: foundation agent, final verification by release-hardening.
- Web upload ingestion response: ingestion-media agent.
- Drive folder/file browsing and actions: drive-ui agent.
- Photos timeline, lightbox, albums, favorites: photos-ui agent.
- Global Search results and filters: search-ui agent.
- Documents sidebar view: search-ui agent.
- Jobs page, retry, global status indicator: jobs-settings-ui agent.
- Settings storage/OCR/embedding/worker status: jobs-settings-ui agent.
- Telegram shared-file import and Telegram blob mode: telegram-storage agent.
- OCR searchability after indexing: ocr-indexing agent.
- Semantic searchability after indexing: embeddings agent, surfaced through hybrid-search and search-ui.
- Release setup, seed, doctor, and critical journeys: release-hardening agent.

## No Duplicate Ownership

- Backend API client generation belongs to the owning API stage; frontend client wrappers belong to `apps/web/src/api`.
- Shared UI primitives belong only to web-design-system until Stage 9, then release-hardening for fixes.
- Search scoring constants belong only to hybrid-search.
- Blob store constants belong only to storage/telegram storage owners by backend.
- Job type constants belong only to domain-contracts initially; later agents extend via coordinated handoff, not duplication.
