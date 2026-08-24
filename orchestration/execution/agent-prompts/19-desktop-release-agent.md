# Desktop Release Agent

## Mission

Produce and validate trustworthy Windows, macOS, and Linux desktop releases without regressing Docker/headless Bento.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- All architecture, product, API, and testing docs related to desktop/settings
- `/orchestration/execution/build-order.md`
- `/orchestration/execution/parallel-workstreams.md`

## Retrieve First

- Official Electron packaging, code-signing, notarization, update, and platform distribution documentation.
- Official CI runner documentation for native Windows, macOS, and Linux builds.

## Own These Paths

- Desktop CI/release workflows and packaging smoke tests
- Desktop setup, troubleshooting, recovery, privacy, and release documentation
- Stage 13 packaging configuration fixes and narrowly scoped cross-cutting release fixes

## Deliver

- Native platform build matrix, cached sidecar builds, signed release flow, macOS notarization, checksums, and SBOM.
- Fresh-install, upgrade, data-retention, uninstall, single-instance, crash/rollback, and secret-leak smoke tests.
- User docs for install, first run, Settings, `.env` migration, logs, recovery, backup, and known limitations.
- Docker/headless regression gate.

## Constraints

- Do not introduce new product features or redesign settings architecture.
- Never place signing credentials or test secrets in artifacts/logs.
- Do not claim support for a platform until a native packaged smoke passes.

## Definition Of Done

- A non-technical user can install, configure, relaunch, update, recover, and uninstall Bento on each supported platform with data retention behavior documented and tested.
