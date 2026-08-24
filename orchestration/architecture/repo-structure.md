# Repo Structure

Assumption: create this monorepo layout from an empty repository.

```txt
apps/
  desktop/
    package.json
    forge.config.ts
    src/
      main/
      preload/
      shared/
    resources/
      sidecars/
    tests/
  api/
    pyproject.toml
    alembic.ini
    src/bento/
      domain/
      application/
      ports/
      adapters/
      infrastructure/
      interfaces/
        http/
        worker/
        telegram/
    tests/
      unit/
      integration/
      api/
  web/
    package.json
    vite.config.ts
    tailwind.config.ts
    src/
      app/
      api/
      components/
      features/
      i18n/
      lib/
      routes/
      styles/
scripts/
  doctor/
  setup/
  seed/
data/
  db/
  cache/
  uploads/
  models/
  journal/
  config/
docker/
  api.Dockerfile
  web.Dockerfile
docker-compose.yml
Makefile
.env.example
README.md
```

Desktop packaging output belongs under ignored `dist/desktop/`. Packaged Python sidecars are built from the existing `apps/api/src/bento` package; no second backend implementation is allowed.

## Backend Package

- `domain/`: pure entities, value objects, enums, domain errors.
- `ports/`: protocols/interfaces for repositories, blob stores, OCR, embeddings, thumbnails, jobs, encryption, manifest journal.
- `application/`: use cases and orchestration services.
- `adapters/`: concrete adapters that implement ports.
- `infrastructure/`: DB sessions, migrations, config loading, logging, dependency wiring.
- `interfaces/http/`: FastAPI routers, request/response schemas, dependency overrides.
- `interfaces/worker/`: worker entrypoint, job dispatch loop, handler registration.
- `interfaces/telegram/`: webhook handler and Telegram-specific interface glue.

## Frontend App

- `app/`: app bootstrap, providers, router shell.
- `api/`: generated or hand-written typed API client and query hooks.
- `components/`: shared primitives only.
- `features/`: Drive, Photos, Search, Jobs, Settings feature modules.
- `i18n/`: locale dictionaries and string helper.
- `routes/`: route modules mapping to user surfaces.
- `styles/`: Tailwind entry and design token CSS variables.

## Root Files

- `docker-compose.yml`: service graph and volumes.
- `Makefile`: `dev`, `up`, `down`, `logs`, `doctor`, `seed`, `test`.
- `.env.example`: safe defaults with `STORAGE_BACKEND=local`.
- Root `README.md`: user setup, commands, architecture summary, limitations.
- Desktop packaging configuration may add root workspace scripts only while the desktop-runtime stage owns shared root files.
