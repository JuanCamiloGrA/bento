from __future__ import annotations

from pathlib import Path

from bento.domain.errors import EmbeddingsDisabledError
from bento.domain.indexing import EmbeddingRecord


class DisabledEmbeddingProvider:
    async def is_enabled(self) -> bool:
        return False

    async def embed_asset(self, asset_id: str, source_ref: str) -> EmbeddingRecord:
        del asset_id, source_ref
        raise EmbeddingsDisabledError()

    async def embed_text(self, asset_id: str, text: str) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        del asset_id, text
        raise EmbeddingsDisabledError()

    async def embed_image(self, asset_id: str, image_path: Path) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        del asset_id, image_path
        raise EmbeddingsDisabledError()
