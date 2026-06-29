PYTHON ?= py

.PHONY: dev up down logs doctor seed test setup backend-install frontend-install backend-test frontend-test smoke

dev: up

up: setup
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

setup: backend-install frontend-install
	$(PYTHON) scripts/setup/main.py

doctor:
	$(PYTHON) scripts/doctor/main.py

seed: backend-install
	$(PYTHON) scripts/seed/main.py

test: backend-test frontend-test

backend-install:
	$(PYTHON) -m pip install -e "./apps/api[dev]"

frontend-install:
	npm --prefix apps/web install

backend-test: backend-install
	cd apps/api && $(PYTHON) -m pytest

frontend-test: frontend-install
	npm --prefix apps/web test

smoke: backend-install
	cd apps/api && $(PYTHON) -m pytest tests/smoke
