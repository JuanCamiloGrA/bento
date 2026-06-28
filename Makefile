PYTHON ?= py

.PHONY: dev up down logs doctor seed test setup backend-test frontend-test

dev: up

up: setup
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

setup:
	$(PYTHON) scripts/setup/main.py

doctor:
	$(PYTHON) scripts/doctor/main.py

seed:
	$(PYTHON) scripts/seed/main.py

test: backend-test frontend-test

backend-test:
	cd apps/api && $(PYTHON) -m pytest

frontend-test:
	npm --prefix apps/web test