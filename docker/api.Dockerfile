FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/api/pyproject.toml ./apps/api/pyproject.toml
COPY apps/api/alembic.ini ./apps/api/alembic.ini
COPY apps/api/migrations ./apps/api/migrations
COPY apps/api/src ./apps/api/src

RUN pip install --no-cache-dir ./apps/api

EXPOSE 8000

CMD ["python", "-m", "bento.interfaces.http.main"]
