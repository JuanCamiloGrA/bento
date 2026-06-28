# Build Order

Later stages begin only after prior stages are merged and green.

## Stage 1: Foundation Scaffold

Owner: foundation agent.

Deliver:

- Monorepo directories.
- Docker Compose services.
- Makefile commands.
- `.env.example`.
- FastAPI health skeleton.
- Worker entrypoint skeleton.
- Vite React shell.
- Scripts skeleton for doctor/setup/seed.

Exit criteria:

- `make doctor` runs with useful checks, even if some report pending.
- `make test` runs backend/frontend placeholder tests.
- `docker compose config` is valid.
- API health route returns locally.
- Web shell renders.

## Stage 2: Contracts And Shared UI Foundation

Parallel agents:

- domain-contracts agent.
- web-design-system agent.

Exit criteria:

- Domain entities, ports, DTOs, use-case skeletons, and unit tests exist.
- UI tokens, primitives, i18n setup, app shell, routing shell exist.
- No owned paths overlap.

## Stage 3: Local Data, Jobs, Storage

Sequential/parallel:

- sqlite-data agent owns DB/migrations/repositories/jobs first.
- storage-agent may run after sqlite-data repository contracts are merged.

Exit criteria:

- SQLite schema and migrations cover initial tables.
- LocalBlobStore works.
- Job queue claim/retry works.
- Settings and manifest event persistence work.

## Stage 4: Ingestion And Media

Owner: ingestion-media agent.

Exit criteria:

- Upload use case and API work in local mode.
- sha256 dedupe works.
- Metadata extraction and thumbnails/previews are queued/generated.
- PDF first-page and video thumbnail basics exist with tested fakes/fixtures.

## Stage 5: Telegram Storage

Owner: telegram-storage agent.

Exit criteria:

- TelegramBlobStore implements blob put/get/delete/exists semantics where feasible.
- Local mode remains unaffected.
- Telegram config validation and rate limit/retry behavior tested with fakes.

## Stage 6: OCR

Owner: ocr-indexing agent.

Exit criteria:

- RapidOCR adapter behind port.
- OCR jobs write asset text/OCR blocks/FTS records.
- Disabled/mock OCR paths tested.
- PDF page OCR basic path works.

## Stage 7: Embeddings

Owner: embeddings-agent.

Exit criteria:

- Jina GGUF adapter behind port.
- Mock/disabled providers.
- sqlite-vec adapter.
- Text/image embedding jobs.
- Basic benchmark or timing script.

## Stage 8: Hybrid Search API

Owner: hybrid-search agent.

Exit criteria:

- Query parser, scoring fusion, filters, explanations.
- `/api/search` implemented.
- Degrades without OCR/embeddings.

## Stage 9: Product UI Surfaces

Parallel agents:

- search-ui agent.
- drive-ui agent.
- photos-ui agent.
- jobs-settings-ui agent.

Exit criteria:

- Global search and Documents filtered UI work against `/api/search`.
- Drive, Photos, Jobs, Settings UI flows work against API.
- Shared frontend primitives are reused, not duplicated.
- UI remains responsive with indexing pending.

## Stage 10: Release Readiness And Hardening

Owner: release-hardening agent.

Exit criteria:

- Seed data.
- Smoke/integration/e2e coverage.
- Doctor/setup docs.
- Security/performance pass.
- Critical journeys pass.
- MVP Definition of Done satisfied.
