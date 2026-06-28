# TDD Method

Use thin, focused TDD at each layer.

## Method

1. Write or update the smallest failing test for the behavior.
2. Implement through the intended layer boundary.
3. Refactor only inside owned paths.
4. Run the stage test target.
5. Document residual gaps in the stage handoff.

## Rules

- Tests must be deterministic and local.
- Prefer fakes/mocks for Telegram, OCR, embeddings, and ffmpeg in unit tests.
- Use temporary directories and temporary SQLite DBs for adapter tests.
- Do not require real Telegram credentials for automated tests.
- Do not require the real embedding model for automated tests.
