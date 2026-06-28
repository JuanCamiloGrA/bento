# Bento

Bento is a local-first, Docker-first monorepo scaffold for the Telegram Private Cloud MVP Lite. Stage 1 provides runtime entrypoints and placeholder surfaces only; storage, ingestion, OCR, embeddings, search, Drive, and Photos behavior are intentionally left for later stages.

## Runtime Processes

- `web`: Vite React TypeScript shell on `127.0.0.1:5173`.
- `api`: FastAPI app on `127.0.0.1:8000`.
- `worker`: Python worker entrypoint using the same `bento` package as the API.
- `telegram-bot-api`: optional local Telegram Bot API profile.

Local mode is the default. `STORAGE_BACKEND=local` does not require Telegram credentials.

## Commands

```sh
make setup
make doctor
make test
make up
make down
```

Backend-only tests:

```sh
cd apps/api && py -m pytest
```

Frontend-only tests:

```sh
npm --prefix apps/web install
npm --prefix apps/web test
```

Validate Compose:

```sh
docker compose config
```

## Development Setup

1. Copy `.env.example` to `.env` if you need local overrides.
2. Run `make setup` to create `data/db`, `data/cache`, `data/uploads`, `data/models`, `data/journal`, and `data/config`.
3. Run `make test` to verify the scaffold.
4. Run `make up` to build and start the local stack.

The API exposes:

- `GET /api/health`
- `GET /api/version`
- `GET /api/settings`

The Makefile defaults to the Windows `py` launcher in this worktree. Use `make test PYTHON=python` if your environment exposes the intended Python interpreter as `python`.`r`n`r`nThe worker currently starts and idles safely. Product behavior is not implemented in this stage.

## Version Assumptions

- Python 3.12.
- FastAPI `0.115.x`, Uvicorn `0.34.x`, Pydantic Settings `2.x`, pytest `8.x`.
- Node 22, Vite `6.x`, React `19.x`, TypeScript `5.7.x`, Tailwind CSS `4.x`, Vitest `3.x`.
- Docker Compose V2 syntax.

Docs consulted: official Docker Compose docs, FastAPI docs, Vite React TypeScript guide, pytest docs, Vitest docs, Testing Library docs, and Tailwind Vite installation docs.