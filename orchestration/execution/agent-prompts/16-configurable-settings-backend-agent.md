# Configurable Settings Backend Agent

## Mission

Replace scattered environment-only configuration with one typed, versioned, safely editable settings system while preserving Docker/headless behavior.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/architecture/desktop-runtime-settings.md`
- `/orchestration/product/settings-recovery-security.md`
- `/orchestration/api/endpoint-map.md`
- `/orchestration/api/error-model.md`
- `/orchestration/testing/critical-journeys.md`

## Own These Paths

- `/apps/api/src/bento/domain/settings*`
- `/apps/api/src/bento/application/settings*`
- `/apps/api/src/bento/ports/settings*`
- `/apps/api/src/bento/adapters/settings/**`
- `/apps/api/src/bento/infrastructure/settings*`
- Settings-related DB models/migrations and API routes/schemas through explicit stage ownership
- Direct environment-read migrations in API/worker/adapters through explicit handoff notes
- Matching backend unit/integration/API tests

## Deliver

- Central registry with legacy env aliases, types, defaults, constraints, sensitivity, availability, and restart scopes.
- Effective settings snapshot consumed identically by API and worker.
- Versioned persistence, optimistic concurrency, validation/probes, source/locked metadata, redacted import preview, and secret-free export.
- Backward-compatible public status endpoint plus typed settings endpoints.
- Contract for desktop secret presence/reference mutations without storing plaintext.

## Constraints

- Do not implement Electron or Settings React UI.
- Do not leak secret material through values, validation errors, logs, repr, fixtures, or snapshots.
- Keep explicit environment overrides authoritative in headless mode and explain their locked state.
- Do not make Docker local mode require persisted settings.

## Required Tests

- Registry completeness and alias uniqueness.
- API/worker effective snapshot parity.
- Validation, source precedence, revision conflict, restart-plan calculation, import redaction, and export exclusion.
- SQLite contains no secret plaintext.
- Existing settings/status and Docker-mode tests remain green.
