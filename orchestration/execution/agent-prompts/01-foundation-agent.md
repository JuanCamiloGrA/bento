# Foundation Agent

## Mission

Create the Docker-first monorepo scaffold that all later agents can build on.

## First Read

- `/orchestration/README.md`
- `/orchestration/AGENTS.md`
- `/orchestration/architecture/system-overview.md`
- `/orchestration/architecture/repo-structure.md`
- `/orchestration/architecture/routing-entrypoints.md`
- `/orchestration/testing/merge-gates.md`

## Retrieve First

- Official Docker Compose docs.
- Official FastAPI docs for app structure and health route.
- Official Vite React TypeScript docs.
- Official pytest and frontend test runner docs for chosen setup.

## Own These Paths

- `/apps/api/pyproject.toml`
- `/apps/api/src/bento/**` scaffold only
- `/apps/api/tests/**` placeholder/smoke only
- `/apps/web/**` scaffold only
- `/docker/**`
- `/docker-compose.yml`
- `/Makefile`
- `/.env.example`
- `/scripts/**`
- `/README.md`

## Starting Reality Check

- Repository may be empty.
- No product feature code exists.
- Later agents depend on stable package names, commands, and service names.

## Deliver

- Create `apps/api` backend package skeleton.
- Create FastAPI health/version/settings placeholder routes.
- Create worker entrypoint skeleton.
- Create `apps/web` Vite React TypeScript shell with Tailwind installed/configured.
- Create Dockerfiles and Compose services: `web`, `api`, `worker`, `telegram-bot-api`.
- Create required volumes under `data`.
- Create `.env.example` with local mode defaults.
- Create Make targets: `dev`, `up`, `down`, `logs`, `doctor`, `seed`, `test`.
- Create doctor/setup/seed script skeletons.
- Document setup in root README.

## Constraints

- Do not implement domain, storage, ingestion, OCR, embeddings, search, Drive, or Photos behavior.
- Do not add a second backend package for worker.
- Do not require Telegram credentials in local mode.
- Keep skeleton tests minimal but executable.

## Required Tests

- Backend health route test.
- Frontend shell render test.
- `docker compose config` validation.
- `make test` runs both backend and frontend test commands.

## Definition Of Done

- Fresh clone can install/run documented commands.
- API health returns success.
- Web shell renders with sidebar/search placeholders.
- Worker starts and idles safely.
- Local mode is default.
