from __future__ import annotations

from typing import Protocol

from bento.domain.indexing import EmbeddingRecord, OCRBlock


class OCRProviderPort(Protocol):
    async def is_enabled(self) -> bool: ...

    async def extract_text(self, asset_id: str, source_ref: str) -> tuple[OCRBlock, ...]: ...


class EmbeddingProviderPort(Protocol):
    async def is_enabled(self) -> bool: ...

    async def embed_asset(self, asset_id: str, source_ref: str) -> EmbeddingRecord: ...
