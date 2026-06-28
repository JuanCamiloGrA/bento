from __future__ import annotations

from typing import Protocol

from bento.domain.assets import Asset
from bento.domain.indexing import EmbeddingRecord, OCRBlock
from bento.domain.search import SearchQuery, SearchResults


class SearchIndexPort(Protocol):
    async def index_asset(self, asset: Asset) -> None: ...

    async def index_ocr(self, block: OCRBlock) -> None: ...

    async def index_embedding(self, record: EmbeddingRecord) -> None: ...

    async def remove_asset(self, asset_id: str) -> None: ...

    async def search(self, query: SearchQuery) -> SearchResults: ...
