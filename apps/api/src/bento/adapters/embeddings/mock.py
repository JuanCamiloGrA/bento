from __future__ import annotations

import hashlib
import math
from pathlib import Path

from bento.domain.indexing import EmbeddingRecord


class MockEmbeddingProvider:
    def __init__(self, *, dimensions: int = 8, provider_name: str = "mock") -> None:
        if dimensions < 1:
            raise ValueError("dimensions must be positive")
        self._dimensions = dimensions
        self._provider_name = provider_name

    async def is_enabled(self) -> bool:
        return True

    async def embed_asset(self, asset_id: str, source_ref: str) -> EmbeddingRecord:
        record, _ = await self._embed(asset_id, source_ref, "asset")
        return record

    async def embed_text(self, asset_id: str, text: str) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        return await self._embed(asset_id, text, "text")

    async def embed_image(self, asset_id: str, image_path: Path) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        if image_path.exists():
            seed = image_path.read_bytes().hex()
        else:
            seed = str(image_path)
        return await self._embed(asset_id, seed, "image")

    async def _embed(self, asset_id: str, value: str, kind: str) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        digest = hashlib.sha1(f"{self._provider_name}:{asset_id}:{kind}:{value}".encode("utf-8")).hexdigest()
        vector = _unit_vector(digest, self._dimensions)
        record = EmbeddingRecord(
            id=f"emb_{digest[:24]}",
            asset_id=asset_id,
            provider=self._provider_name,
            vector_ref=f"{self._provider_name}:{digest[:32]}",
            dimensions=self._dimensions,
        )
        return record, vector


def _unit_vector(seed: str, dimensions: int) -> tuple[float, ...]:
    values: list[float] = []
    counter = 0
    while len(values) < dimensions:
        block = hashlib.sha256(f"{seed}:{counter}".encode("utf-8")).digest()
        for index in range(0, len(block), 4):
            raw = int.from_bytes(block[index : index + 4], "big", signed=False)
            values.append((raw / 0xFFFFFFFF) * 2.0 - 1.0)
            if len(values) == dimensions:
                break
        counter += 1
    magnitude = math.sqrt(sum(value * value for value in values)) or 1.0
    return tuple(value / magnitude for value in values)
