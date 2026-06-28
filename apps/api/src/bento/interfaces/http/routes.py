from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from bento.infrastructure.settings import Settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    storage_backend: str
    telegram_configured: bool


class VersionResponse(BaseModel):
    name: str
    version: str
    environment: str


class SettingsResponse(BaseModel):
    storage_backend: str
    worker_concurrency: int
    telegram_enabled: bool


def _settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> dict[str, Any]:
    settings = _settings(request)
    return {
        "status": "ok",
        "storage_backend": settings.storage_backend,
        "telegram_configured": settings.telegram_configured,
    }


@router.get("/version", response_model=VersionResponse)
async def version(request: Request) -> dict[str, str]:
    settings = _settings(request)
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.get("/settings", response_model=SettingsResponse)
async def public_settings(request: Request) -> dict[str, Any]:
    settings = _settings(request)
    return {
        "storage_backend": settings.storage_backend,
        "worker_concurrency": settings.worker_concurrency,
        "telegram_enabled": settings.storage_backend == "telegram" and settings.telegram_configured,
    }