# Bento

Bento is a local-first private cloud MVP Lite. It stores metadata, jobs, search indexes, manifests, thumbnails, and settings in local SQLite and uses local filesystem storage by default. Telegram storage is optional and only used when `STORAGE_BACKEND=telegram` is configured.

## Runtime Processes

- `web`: Vite React TypeScript app on `127.0.0.1:5173`.
- `api`: FastAPI app on `127.0.0.1:8000`.
- `worker`: background worker using the same `bento` backend package.
- `telegram-bot-api`: optional local Telegram Bot API profile.

Local mode is the safe default. `STORAGE_BACKEND=local` does not require Telegram credentials.

## Quick Start

```sh
copy .env.example .env
make setup
make doctor
make seed
make up
```

Open the app at `http://127.0.0.1:5173`. The API is available at `http://127.0.0.1:8000/api`.

If your shell exposes Python as `python` instead of the Windows `py` launcher, pass `PYTHON=python`:

```sh
make setup PYTHON=python
make test PYTHON=python
```

## Commands

```sh
make setup          # install local deps, create data dirs, run Alembic migrations
make doctor         # validate local mode, DB, writable volumes, compose config, tools
make seed           # add deterministic demo Drive and Photos assets
make test           # backend pytest and frontend Vitest
make smoke          # backend release smoke journey
make up             # build and start Docker Compose local mode
make down
make logs
```

Backend-only:

```sh
cd apps/api && py -m pytest
```

Frontend-only:

```sh
npm --prefix apps/web test
```

Validate Compose without starting services:

```sh
docker compose config --quiet
```

## Environment

`.env.example` is safe for local mode:

- `STORAGE_BACKEND=local`
- `WORKER_CONCURRENCY=1`
- `OCR_PROVIDER=disabled`
- `EMBEDDINGS_PROVIDER=disabled`
- `VITE_API_BASE_URL=http://127.0.0.1:8000/api`

Telegram mode requires all Telegram fields:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_RAW_CHAT_ID`
- `TELEGRAM_THUMBS_CHAT_ID`
- `TELEGRAM_JOURNAL_CHAT_ID`

Do not commit real Telegram tokens, API hashes, chat IDs, or local secrets.

## Implemented MVP Surface

- Upload to local storage with sha256 dedupe.
- Drive listing, folders, rename, move, logical delete, download, and search.
- Photos timeline, upload, detail, and favorite toggle.
- Search by filename, metadata, OCR text when indexed, and optional vector records.
- Jobs list, retry for failed jobs, and reindex enqueue.
- Settings/status endpoint for storage, providers, model availability, worker concurrency, and data paths.
- Manifest events persisted in SQLite and exported to `data/journal/manifest-events.jsonl`.
- Telegram webhook and Telegram blob adapter wiring when Telegram mode is configured.

## Known Limitations

- OCR and embeddings are disabled by default; real providers require local runtime setup and model files.
- The worker is conservative by default (`WORKER_CONCURRENCY=1`).
- Telegram mode requires a local Telegram Bot API server and private channels; automated tests use fakes, not real Telegram.
- Thumbnails/previews depend on worker/media tooling and may be pending until jobs run.
- No public sharing, mobile app, multi-PC sync, cloud AI, PostgreSQL, or external vector database is included in MVP Lite.

## Release Checks

- `make test`
- `make doctor`
- `make smoke`
- `docker compose config --quiet`
- Docker Compose local smoke: `make up`, open `http://127.0.0.1:5173`, upload, browse Drive/Photos, search, view Jobs/Settings, then `make down`.

## MVP Definition Of Done

- [x] Clean local setup creates data directories and migrates SQLite.
- [x] Local mode works without Telegram configuration.
- [x] Upload, Drive listing, download, Photos timeline, filename search, Jobs, Settings, and manifest export have smoke coverage.
- [x] Docker Compose binds app ports to localhost and waits for API health before starting dependents.
- [x] Defaults avoid cloud AI and keep worker concurrency CPU-safe.
- [x] Known limitations are documented.

## Version Assumptions

- Python 3.12+.
- FastAPI `0.115.x`, SQLAlchemy `2.x`, Alembic `1.x`, Uvicorn `0.34.x`, pytest `8.x`.
- Node 22, Vite `6.x`, React `19.x`, TypeScript `5.7.x`, Tailwind CSS `4.x`, Vitest `3.x`.
- Docker Compose V2 with healthcheck-aware `depends_on`.

Docs consulted during release hardening: project orchestration docs and current official Docker Compose documentation for healthchecks and `depends_on` conditions.
