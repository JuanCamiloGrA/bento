from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class DomainError(Exception):
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return self.message


class AssetNotFoundError(DomainError):
    def __init__(self, asset_id: str) -> None:
        super().__init__("asset_not_found", "Asset not found", {"asset_id": asset_id})


class FolderNotFoundError(DomainError):
    def __init__(self, folder_id: str) -> None:
        super().__init__("folder_not_found", "Folder not found", {"folder_id": folder_id})


class AlbumNotFoundError(DomainError):
    def __init__(self, album_id: str) -> None:
        super().__init__("album_not_found", "Album not found", {"album_id": album_id})


class JobNotFoundError(DomainError):
    def __init__(self, job_id: str) -> None:
        super().__init__("job_not_found", "Job not found", {"job_id": job_id})


class DuplicateAssetError(DomainError):
    def __init__(self, sha256: str) -> None:
        super().__init__("duplicate_asset", "Duplicate asset", {"sha256": sha256})


class InvalidFolderMoveError(DomainError):
    def __init__(self, folder_id: str, parent_id: str | None) -> None:
        super().__init__(
            "invalid_folder_move",
            "Folder cannot be moved into itself or its descendants",
            {"folder_id": folder_id, "parent_id": parent_id},
        )


class UnsupportedMediaTypeError(DomainError):
    def __init__(self, mime_type: str) -> None:
        super().__init__("unsupported_media_type", "Unsupported media type", {"mime_type": mime_type})


class UploadTooLargeError(DomainError):
    def __init__(self, size_bytes: int, max_bytes: int) -> None:
        super().__init__(
            "upload_too_large",
            "Upload is too large",
            {"size_bytes": size_bytes, "max_bytes": max_bytes},
        )


class StorageUnavailableError(DomainError):
    def __init__(self, backend: str) -> None:
        super().__init__("storage_unavailable", "Storage backend is unavailable", {"backend": backend})


class TelegramNotConfiguredError(DomainError):
    def __init__(self) -> None:
        super().__init__("telegram_not_configured", "Telegram storage is not configured")


class OCRDisabledError(DomainError):
    def __init__(self) -> None:
        super().__init__("ocr_disabled", "OCR is disabled")


class EmbeddingsDisabledError(DomainError):
    def __init__(self) -> None:
        super().__init__("embeddings_disabled", "Embeddings are disabled")


class JobNotRetryableError(DomainError):
    def __init__(self, job_id: str, status: str) -> None:
        super().__init__("job_not_retryable", "Job is not retryable", {"job_id": job_id, "status": status})


class ValidationFailedError(DomainError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("validation_failed", message, details or {})


class SettingsRevisionConflictError(DomainError):
    def __init__(self, *, expected_revision: int, current_revision: int) -> None:
        super().__init__(
            "settings_revision_conflict",
            "Settings were changed by another client",
            {"expected_revision": expected_revision, "current_revision": current_revision},
        )


class SettingsSourceLockedError(DomainError):
    def __init__(self, keys: list[str]) -> None:
        super().__init__(
            "settings_source_locked",
            "One or more settings are controlled by the environment or policy",
            {"keys": sorted(keys)},
        )
