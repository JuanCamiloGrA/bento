from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from bento.infrastructure.settings import Settings, settings_database_path

router = APIRouter()


class ReadinessResponse(BaseModel):
    status: str
    version: str


@router.get("/readiness", response_model=ReadinessResponse)
def readiness(request: Request) -> ReadinessResponse | JSONResponse:
    settings: Settings = request.app.state.settings
    if not _database_is_migrated(settings):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "starting", "code": "database_not_migrated"},
        )
    return ReadinessResponse(status="ready", version=settings.app_version)


def _database_is_migrated(settings: Settings) -> bool:
    database_path = settings_database_path(settings)
    if not database_path.is_file():
        return False
    try:
        with sqlite3.connect(f"file:{database_path}?mode=ro", uri=True, timeout=1) as connection:
            row = connection.execute("SELECT version_num FROM alembic_version LIMIT 1").fetchone()
            return row is not None and bool(row[0])
    except (OSError, sqlite3.Error):
        return False
