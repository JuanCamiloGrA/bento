from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any


class ManifestEventType(StrEnum):
    ASSET_CREATED = "asset_created"
    ASSET_UPDATED = "asset_updated"
    ASSET_DELETED = "asset_deleted"
    FOLDER_CREATED = "folder_created"
    FOLDER_MOVED = "folder_moved"
    BLOB_STORED = "blob_stored"
    THUMBNAIL_CREATED = "thumbnail_created"
    OCR_INDEXED = "ocr_indexed"
    EMBEDDING_INDEXED = "embedding_indexed"


class ManifestEntityType(StrEnum):
    ASSET = "asset"
    FOLDER = "folder"
    BLOB = "blob"
    JOB = "job"
    SETTINGS = "settings"


@dataclass(frozen=True, slots=True)
class ManifestEvent:
    id: str
    type: ManifestEventType
    entity_type: ManifestEntityType
    entity_id: str
    payload: dict[str, Any]
    created_at: datetime
