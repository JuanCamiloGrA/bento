from __future__ import annotations

from pathlib import Path
from typing import Protocol

from bento.domain.assets import AssetMetadata
from bento.domain.security import EncryptionMetadata
from bento.domain.storage import BlobKind, BlobRef


class BlobStorePort(Protocol):
    async def store(
        self,
        source_ref: str,
        *,
        asset_id: str | None,
        kind: BlobKind,
        metadata: AssetMetadata,
        encryption: EncryptionMetadata | None = None,
    ) -> BlobRef: ...

    async def get(self, blob_id: str) -> BlobRef | None: ...

    async def download(self, blob_ref: BlobRef, destination_path: Path | str) -> Path: ...

    async def delete(self, blob_id: str) -> None: ...
