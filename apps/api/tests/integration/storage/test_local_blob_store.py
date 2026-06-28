from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

import pytest

from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.domain.assets import AssetMetadata
from bento.domain.errors import ValidationFailedError
from bento.domain.storage import BlobKind, StorageBackend


def test_local_blob_store_put_get_exists_delete(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "upload.txt"
        content = b"private document"
        source.write_bytes(content)
        sha256 = hashlib.sha256(content).hexdigest()
        store = LocalBlobStoreAdapter(tmp_path / "storage")

        blob_ref = await store.store(
            str(source),
            asset_id="asset_1",
            kind=BlobKind.ORIGINAL,
            metadata=AssetMetadata(
                original_filename="upload.txt",
                mime_type="text/plain",
                size_bytes=len(content),
                sha256=sha256,
            ),
        )

        assert blob_ref.backend == StorageBackend.LOCAL
        assert blob_ref.object_key == f"blobs/original/{sha256[:2]}/{sha256[2:4]}/{sha256}"
        assert (tmp_path / "storage" / blob_ref.object_key).read_bytes() == content
        assert await store.exists(blob_ref.id) is True
        assert await store.get(blob_ref.id) == blob_ref.__class__(
            id=blob_ref.id,
            asset_id=None,
            backend=StorageBackend.LOCAL,
            kind=BlobKind.ORIGINAL,
            object_key=blob_ref.object_key,
            size_bytes=len(content),
            sha256=sha256,
        )

        await store.delete(blob_ref.id)

        assert await store.exists(blob_ref.id) is False
        assert await store.get(blob_ref.id) is None

    asyncio.run(scenario())


def test_local_blob_store_rejects_path_traversal_blob_ids(tmp_path: Path) -> None:
    async def scenario() -> None:
        store = LocalBlobStoreAdapter(tmp_path / "storage")

        with pytest.raises(ValidationFailedError):
            await store.exists("../outside")
        with pytest.raises(ValidationFailedError):
            await store.get("local_original_../outside")
        with pytest.raises(ValidationFailedError):
            await store.delete(r"local_original_aa\outside")

    asyncio.run(scenario())
