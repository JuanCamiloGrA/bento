# Telegram Storage Agent

## Mission

Implement Telegram blob storage and Telegram webhook ingestion without weakening local mode.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/product/storage-telegram.md`
- `/orchestration/architecture/api-integration.md`
- `/orchestration/api/endpoint-map.md`
- `/orchestration/api/error-model.md`
- `/orchestration/product/upload.md`

## Retrieve First

- Official Telegram Bot API docs.
- aiogram 3 docs.
- Local telegram-bot-api server docs, especially `--local`.
- Docker image/docs selected for telegram-bot-api.

## Own These Paths

- `/apps/api/src/bento/adapters/storage/telegram*`
- `/apps/api/src/bento/infrastructure/telegram/**`
- `/apps/api/src/bento/interfaces/telegram/**`
- `/apps/api/src/bento/interfaces/http/routes/telegram*`
- `/apps/api/tests/unit/telegram/**`
- `/apps/api/tests/integration/telegram/**`
- `/docker-compose.yml` telegram service adjustments only
- `/.env.example` Telegram variables only

## Starting Reality Check

- Local upload/storage path is green.
- Blob refs table includes Telegram fields.
- Telegram config may be absent in default local mode.

## Deliver

- `TelegramBlobStoreAdapter`.
- Config validation for telegram mode.
- Upload original as document.
- Download on demand.
- Delete/exists semantics as supported by Telegram and local metadata.
- Retry and simple rate limiting.
- Webhook route for bot-shared files that feeds ingestion.
- Journal channel sink when Telegram mode is enabled.

## Constraints

- Do not require Telegram variables when `STORAGE_BACKEND=local`.
- Do not use Telegram history as business state.
- Do not log tokens/chat secrets.
- Do not alter local storage behavior except through shared port compatibility.

## Required Tests

- Fake Telegram client put/get/exists behavior.
- Missing config errors only in telegram mode.
- Rate limit/retry behavior with fake failures.
- Webhook ingestion test with fake file.
- Local mode regression test.

## Definition Of Done

- Telegram mode can store/retrieve blobs through local Bot API when configured.
- Local mode remains the default and passes all prior tests.
