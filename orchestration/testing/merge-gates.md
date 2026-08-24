# Merge Gates

## Per Agent

- Own-path tests pass.
- No forbidden layer imports.
- No duplicate shared helpers, clients, stores, DTOs, or primitives.
- Prompt Definition of Done satisfied.
- Stage handoff notes mention docs consulted and assumptions.

## Per Stage

- All agents in stage merged.
- Shared files owned by that stage are coherent.
- Stage test target green.
- API contracts and frontend client stay aligned where both exist.
- Docker/dev commands remain usable after Stage 1.

## Release

- `make test` green.
- `make doctor` passes in local mode.
- Docker Compose local mode smoke passes.
- Critical journeys covered.
- README setup docs work from a clean clone.
- No required secret committed.
- No product behavior from the spec unassigned or untested.

## Desktop Release

- Renderer, preload, main-process, backend settings, and sidecar lifecycle tests pass.
- Fresh-install smoke passes on native Windows, macOS, and Linux CI runners.
- Packaged builds contain no development server URL, source `.env`, plaintext secret, or writable executable resource path.
- macOS artifact is signed/notarized; Windows artifact is signed for production; Linux artifact publishes checksum and dependency notes.
- Sidecar crash, restart, rollback, single-instance, upgrade, and uninstall-with-data-retained journeys pass.
- Docker/headless regression suite remains green.
