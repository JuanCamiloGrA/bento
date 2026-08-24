# Desktop Runtime Agent

## Mission

Create the secure Electron host that runs Bento as a desktop app without Docker and supervises the existing Python runtime.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/architecture/desktop-runtime-settings.md`
- `/orchestration/architecture/system-overview.md`
- `/orchestration/architecture/performance-security.md`
- `/orchestration/testing/merge-gates.md`

## Retrieve First

- Current official Electron security, process model, `safeStorage`, packaging, signing, and auto-update documentation.
- Current official Python sidecar bundler documentation selected by the implementation spike.

## Own These Paths

- `/apps/desktop/**`
- Desktop packaging/build scripts and Stage 12 root build wiring
- Desktop-specific main/preload tests

## Deliver

- Secure BrowserWindow/preload setup and typed allowlisted bridge.
- Single-instance lifecycle, platform data directories, authenticated loopback sidecars, readiness, graceful shutdown, bounded restart, recovery mode, and log redaction.
- OS-backed secure secret storage and transactional settings apply/restart bridge.
- Native folder/file pickers and platform metadata.
- Platform packaging scaffold and Python API/worker sidecar builds from the existing package.

## Constraints

- Do not duplicate Python domain/application behavior in Electron.
- Do not expose Node, generic IPC, shell execution, arbitrary paths, or secret reads to the renderer.
- Do not require Docker, system Python, or Node at runtime.
- Do not edit Settings feature UI owned by the Stage 12 UI agent.

## Required Tests

- Main/preload contract tests and hostile-payload validation.
- API/worker startup order, auth, readiness, graceful shutdown, crash backoff, and recovery mode.
- Secret store unavailable behavior and redaction.
- Settings apply success, targeted restart, failure rollback, and last-known-good recovery.
- Packaged local-mode smoke on the current native OS.
