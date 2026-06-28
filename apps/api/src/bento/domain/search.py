from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from bento.domain.assets import ProcessingState


class SearchResultType(StrEnum):
    ASSET = "asset"
    FOLDER = "folder"
    PHOTO = "photo"
    VIDEO = "video"
    DOCUMENT = "document"
    PDF_PAGE = "pdf_page"
    OCR_BLOCK = "ocr_block"
    ALBUM = "album"


@dataclass(frozen=True, slots=True)
class SearchQuery:
    text: str
    result_type: SearchResultType | None = None
    folder_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = 50
    cursor: str | None = None


@dataclass(frozen=True, slots=True)
class SearchFacet:
    type: SearchResultType
    count: int


@dataclass(frozen=True, slots=True)
class SearchHit:
    id: str
    type: SearchResultType
    title: str
    score: float
    reason: str
    asset_id: str | None = None
    subtitle: str | None = None
    thumbnail_url: str | None = None
    processing_state: ProcessingState | None = None


@dataclass(frozen=True, slots=True)
class SearchResults:
    items: tuple[SearchHit, ...]
    facets: tuple[SearchFacet, ...]
    next_cursor: str | None
