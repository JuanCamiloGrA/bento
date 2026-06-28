from __future__ import annotations

from typing import Protocol

from bento.domain.storage import BlobRef


class ThumbnailPort(Protocol):
    async def create_thumbnail(self, asset_id: str, source_ref: str) -> BlobRef: ...

    async def create_preview(self, asset_id: str, source_ref: str) -> BlobRef | None: ...
