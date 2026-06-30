.PHONY: dev up watch down logs doctor seed test setup backend-install frontend-install backend-test frontend-test smoke pre-commit-install pre-commit pre-push

dev: up

up: setup
	docker compose up --build

watch: setup
	docker compose watch

down:
	docker compose down

logs:
	docker compose logs -f

setup: backend-install frontend-install
	uv run --project apps/api python scripts/setup/main.py

doctor:
	uv run --project apps/api python scripts/doctor/main.py

seed: backend-install
	uv run --project apps/api python scripts/seed/main.py

test: backend-test frontend-test

backend-install:
	uv sync --project apps/api --extra dev

frontend-install:
	npm --prefix apps/web install

backend-test: backend-install
	cd apps/api && uv run pytest

frontend-test: frontend-install
	npm --prefix apps/web test

smoke: backend-install
	cd apps/api && uv run pytest tests/smoke

pre-commit-install: backend-install
	uv run --project apps/api pre-commit install --install-hooks

pre-commit: backend-install
	uv run --project apps/api pre-commit run --all-files

pre-push: backend-install frontend-install
	uv run --project apps/api pre-commit run --all-files --hook-stage pre-push
