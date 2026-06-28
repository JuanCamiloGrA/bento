# Domain Contracts Agent

## Mission

Implement pure domain entities, ports, DTOs, and use-case contracts without infrastructure dependencies.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/architecture/boundaries-layers.md`
- `/orchestration/architecture/state-data-management.md`
- `/orchestration/product/upload.md`
- `/orchestration/product/drive.md`
- `/orchestration/product/photos.md`
- `/orchestration/product/search.md`
- `/orchestration/product/jobs.md`
- `/orchestration/product/storage-telegram.md`
- `/orchestration/product/settings-recovery-security.md`
- `/orchestration/testing/tdd-method.md`
- `/orchestration/testing/test-layers.md`

## Retrieve First

- Python typing/protocol docs.
- Pydantic docs only for boundary DTO guidance; domain must not depend on Pydantic unless deliberately isolated outside `domain`.

## Own These Paths

- `/apps/api/src/bento/domain/**`
- `/apps/api/src/bento/ports/**`
- `/apps/api/src/bento/application/**`
- `/apps/api/tests/unit/**`

## Starting Reality Check

- Foundation scaffold is merged.
- Infrastructure adapters do not exist yet.
- Use cases should be testable with fake ports.

## Deliver

- Entities/value objects for assets, folders, photos/albums, search, indexing, jobs, storage, security, settings.
- Processing state and job status enums.
- Required ports from architecture docs.
- Use-case command/query/result DTOs for upload, Drive, Photos, Search, Jobs, Settings, manifest.
- Use-case skeletons or pure orchestration where no adapter is required yet.
- Domain errors mapped to stable error codes.

## Constraints

- No FastAPI, SQLAlchemy, aiogram, RapidOCR, sqlite-vec, ffmpeg, filesystem adapter, or network imports.
- No DB models.
- No endpoint code.
- Do not edit root config or frontend files.

## Required Tests

- Domain invariants: folder move cycle prevention contract, logical delete state, processing state transitions.
- Use cases with fake ports for upload orchestration shape, Drive operations, Photos album/favorite operations, job retry eligibility.
- Import boundary test proving `domain` has no forbidden external imports.

## Definition Of Done

- Domain/application tests pass without DB/network/Docker.
- Ports exactly cover required adapters.
- Every product behavior has a domain/application contract or explicit adapter-stage owner.
