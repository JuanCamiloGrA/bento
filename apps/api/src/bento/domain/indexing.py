from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class IndexProviderState(StrEnum):
    DISABLED = "disabled"
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class OCRBlock:
    id: str
    asset_id: str
    text: str
    page_number: int | None = None
    confidence: float | None = None


@dataclass(frozen=True, slots=True)
class EmbeddingRecord:
    id: str
    asset_id: str
    provider: str
    vector_ref: str
    dimensions: int


@dataclass(frozen=True, slots=True)
class PDFPage:
    id: str
    asset_id: str
    page_number: int
    text: str | None = None


@dataclass(frozen=True, slots=True)
class VideoSegment:
    id: str
    asset_id: str
    start_ms: int
    end_ms: int
