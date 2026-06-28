from __future__ import annotations

import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from starlette.datastructures import UploadFile

from bento.application.ingestion import AssetFileQueryService, AssetIngestionService, UploadedAssetFile
from bento.domain.assets import Asset, AssetMode
from bento.domain.errors import DomainError, UnsupportedMediaTypeError, ValidationFailedError
from bento.domain.storage import BlobRef
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


class AssetResponse(BaseModel):
    id: str
    kind: str
    mode: str
    folder_id: str | None
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    favorite: bool
    processing_state: str
    created_at: str
    updated_at: str
    duplicate: bool = False


@dataclass(frozen=True, slots=True)
class AssetRouteDependencies:
    ingestion: AssetIngestionService
    files: AssetFileQueryService
    resolver: Any


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


@router.post("/assets/upload", response_model=AssetResponse)
async def upload_asset(request: Request, response: Response) -> AssetResponse | JSONResponse:
    try:
        form = await request.form()
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise ValidationFailedError("Multipart field 'file' is required")
        folder_id = _optional_form_value(form.get("folder_id"))
        mode = _optional_asset_mode(form.get("mode"))
        temp_path = await _save_upload_file(upload, _data_dir(_settings(request)) / "cache" / "uploads")
        try:
            result = await _asset_dependencies(request).ingestion.upload_file(
                UploadedAssetFile(
                    source_path=temp_path,
                    original_filename=upload.filename or "upload",
                    declared_mime_type=upload.content_type,
                    folder_id=folder_id,
                    mode=mode,
                )
            )
        finally:
            temp_path.unlink(missing_ok=True)
            await upload.close()
        response.headers["X-Bento-Duplicate"] = "true" if result.duplicate else "false"
        return _asset_response(result.asset, duplicate=result.duplicate)
    except DomainError as exc:
        return _domain_error_response(request, exc)


@router.get("/assets/{asset_id}", response_model=AssetResponse)
async def asset_detail(asset_id: str, request: Request) -> AssetResponse | JSONResponse:
    try:
        asset = await _asset_dependencies(request).files.get_asset(asset_id)
        return _asset_response(asset)
    except DomainError as exc:
        return _domain_error_response(request, exc)


@router.get("/assets/{asset_id}/download", response_model=None)
async def download_asset(asset_id: str, request: Request) -> FileResponse | JSONResponse:
    try:
        dependencies = _asset_dependencies(request)
        asset_file = await dependencies.files.original_file(asset_id)
        path = dependencies.resolver.resolve(asset_file.blob_ref)
        return FileResponse(path, media_type=asset_file.asset.metadata.mime_type, filename=asset_file.asset.filename)
    except DomainError as exc:
        return _domain_error_response(request, exc)


@router.get("/assets/{asset_id}/thumbnail", response_model=None)
async def asset_thumbnail(asset_id: str, request: Request) -> FileResponse | JSONResponse:
    try:
        dependencies = _asset_dependencies(request)
        asset_file = await dependencies.files.thumbnail_file(asset_id)
        path = dependencies.resolver.resolve(asset_file.blob_ref)
        return FileResponse(path, media_type=_blob_media_type(asset_file.blob_ref))
    except DomainError as exc:
        return _domain_error_response(request, exc)


@router.get("/assets/{asset_id}/preview", response_model=None)
async def asset_preview(asset_id: str, request: Request) -> FileResponse | JSONResponse:
    try:
        dependencies = _asset_dependencies(request)
        asset_file = await dependencies.files.preview_file(asset_id)
        path = dependencies.resolver.resolve(asset_file.blob_ref)
        return FileResponse(path, media_type=_blob_media_type(asset_file.blob_ref))
    except DomainError as exc:
        return _domain_error_response(request, exc)


@router.delete("/assets/{asset_id}", response_model=AssetResponse)
async def delete_asset(asset_id: str, request: Request) -> AssetResponse | JSONResponse:
    try:
        asset = await _asset_dependencies(request).files.delete_asset(asset_id)
        return _asset_response(asset)
    except DomainError as exc:
        return _domain_error_response(request, exc)


def _asset_dependencies(request: Request) -> AssetRouteDependencies:
    cached = getattr(request.app.state, "asset_route_dependencies", None)
    if cached is not None:
        return cached

    from bento.adapters.jobs import SQLiteJobQueue
    from bento.adapters.manifest import SQLiteManifestJournal
    from bento.adapters.media import LocalBlobPathResolver, LocalUploadMetadataExtractor, SQLiteBlobRefCatalog
    from bento.adapters.repositories import SQLiteAssetRepository, SQLiteFolderRepository
    from bento.application.upload import UploadAssetUseCase
    from bento.infrastructure.db.clock import SystemClock
    from bento.infrastructure.db.engine import create_session_factory, sqlite_url
    from bento.infrastructure.storage.factory import create_blob_store

    settings = _settings(request)
    data_dir = _data_dir(settings)
    clock = SystemClock()
    session_factory = create_session_factory(sqlite_url(data_dir / "db" / "bento.sqlite3"))
    assets = SQLiteAssetRepository(session_factory)
    folders = SQLiteFolderRepository(session_factory)
    blob_refs = SQLiteBlobRefCatalog(session_factory, clock)
    manifest = SQLiteManifestJournal(session_factory, clock, data_dir / "journal")
    upload_use_case = UploadAssetUseCase(
        assets=assets,
        folders=folders,
        blob_store=create_blob_store(settings),
        jobs=SQLiteJobQueue(session_factory, clock),
        manifest=manifest,
        clock=clock,
    )
    dependencies = AssetRouteDependencies(
        ingestion=AssetIngestionService(
            upload=upload_use_case,
            blob_refs=blob_refs,
            metadata_extractor=LocalUploadMetadataExtractor(),
        ),
        files=AssetFileQueryService(assets=assets, blob_refs=blob_refs, manifest=manifest, clock=clock),
        resolver=LocalBlobPathResolver(data_dir / "uploads"),
    )
    request.app.state.asset_route_dependencies = dependencies
    return dependencies


async def _save_upload_file(upload: UploadFile, upload_dir: Path) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix="upload-", suffix=".tmp", dir=upload_dir, delete=False) as handle:
        temp_path = Path(handle.name)
        while chunk := await upload.read(1024 * 1024):
            handle.write(chunk)
    return temp_path


def _data_dir(settings: Settings) -> Path:
    return Path(settings.data_dir)


def _optional_form_value(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_asset_mode(value: object) -> AssetMode | None:
    text = _optional_form_value(value)
    if text is None:
        return None
    try:
        return AssetMode(text)
    except ValueError as exc:
        raise ValidationFailedError("Invalid asset mode", {"mode": text}) from exc


def _asset_response(asset: Asset, *, duplicate: bool = False) -> AssetResponse:
    return AssetResponse(
        id=asset.id,
        kind=asset.kind.value,
        mode=asset.mode.value,
        folder_id=asset.folder_id,
        filename=asset.filename,
        mime_type=asset.metadata.mime_type,
        size_bytes=asset.metadata.size_bytes,
        sha256=asset.metadata.sha256,
        favorite=asset.favorite,
        processing_state=asset.processing_state.value,
        created_at=asset.created_at.isoformat(),
        updated_at=asset.updated_at.isoformat(),
        duplicate=duplicate,
    )


def _blob_media_type(blob_ref: BlobRef) -> str:
    if blob_ref.kind.value in {"thumbnail", "preview"}:
        return "image/jpeg"
    if blob_ref.object_key.lower().endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if blob_ref.object_key.lower().endswith(".png"):
        return "image/png"
    return "application/octet-stream"


def _domain_error_response(request: Request, error: DomainError) -> JSONResponse:
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    return JSONResponse(
        status_code=_status_code(error),
        content={
            "error": {
                "code": error.code,
                "message": error.message,
                "details": error.details,
                "request_id": request_id,
            }
        },
    )


def _status_code(error: DomainError) -> int:
    if error.code in {"asset_not_found", "folder_not_found", "album_not_found", "job_not_found"}:
        return 404
    if error.code in {"duplicate_asset", "invalid_folder_move", "job_not_retryable"}:
        return 409
    if error.code == "upload_too_large":
        return 413
    if isinstance(error, UnsupportedMediaTypeError):
        return 415
    if error.code in {"storage_unavailable", "telegram_not_configured"}:
        return 503
    return 400
