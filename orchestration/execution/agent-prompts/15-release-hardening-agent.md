# Release Hardening Agent

## Mission

Make the MVP Lite release-ready by validating critical journeys, tightening docs, smoke tests, security, performance, and setup.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- All files in `/orchestration/architecture`
- All files in `/orchestration/product`
- All files in `/orchestration/api`
- All files in `/orchestration/testing`
- `/orchestration/execution/build-order.md`
- `/orchestration/execution/parallel-workstreams.md`

## Retrieve First

- Current docs for any failing dependency or integration discovered during hardening.
- Docker Compose docs for final service health checks.
- Playwright or chosen E2E runner docs if adding browser smoke tests.

## Own These Paths

- `/README.md`
- `/scripts/doctor/**`
- `/scripts/setup/**`
- `/scripts/seed/**`
- `/apps/api/tests/e2e/**`
- `/apps/api/tests/smoke/**`
- `/apps/web/src/test/e2e/**`
- `/docker-compose.yml` final healthcheck/env polish only
- `/Makefile` final command polish only
- `/.env.example` final safe defaults only
- Cross-cutting bug fixes only with explicit notes and minimal edits.

## Starting Reality Check

- All feature stages are merged.
- The release candidate should be functionally complete but may have gaps in docs, smoke coverage, setup, and hardening.

## Deliver

- Seed dataset and `make seed`.
- `make doctor` complete checks.
- Docker Compose local mode smoke.
- Critical journey tests.
- Root README setup and known limitations.
- Security pass for secrets/path traversal/logging.
- Performance pass for grids, thumbnail usage, worker concurrency.
- Final MVP Definition of Done checklist.

## Constraints

- Do not redesign architecture.
- Do not introduce new product scope.
- Do not perform broad refactors.
- Do not silently change feature behavior owned by prior agents; document any necessary fix.

## Required Tests

- `make test`.
- `make doctor`.
- Docker Compose local mode smoke.
- Critical journeys from `/orchestration/testing/critical-journeys.md`.
- UI smoke for upload, Drive, Photos, Search, Jobs/Settings.

## Definition Of Done

- A clean user can clone, configure local mode, run Docker Compose, upload, browse Drive/Photos, download, search by filename/OCR/semantic mock or real provider, observe jobs, and use local mode without Telegram.
- Release docs and limitations are accurate.
