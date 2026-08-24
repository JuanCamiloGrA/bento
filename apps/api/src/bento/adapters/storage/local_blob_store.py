from __future__ import annotations

import asyncio
import hashlib
import shutil
import tempfile
from pathlib import Path

from bento.domain.assets import AssetMetadata
from bento.domain.errors import StorageUnavailableError, ValidationFailedError
from bento.domain.security import EncryptionMetadata, EncryptionMode
from bento.domain.storage import BlobKind, BlobRef, StorageBackend


class LocalBlobStoreAdapter:
    def __init__(self, root_dir: str | Path) -> None:
        self._root_dir = Path(root_dir)

    async def probe(self) -> bool:
        await asyncio.to_thread(self._root_dir.mkdir, parents=True, exist_ok=True)
        return True

    async def store(
        self,
        source_ref: str,
        *,
        asset_id: str | None,
        kind: BlobKind,
        metadata: AssetMetadata,
        encryption: EncryptionMetadata | None = None,
    ) -> BlobRef:
        encryption = encryption or EncryptionMetadata(mode=EncryptionMode.NONE)
        source_path = Path(source_ref)
        if not source_path.is_file():
            raise StorageUnavailableError(StorageBackend.LOCAL.value)

        actual_sha256 = await asyncio.to_thread(_sha256_file, source_path)
        if actual_sha256 != metadata.sha256:
            raise ValidationFailedError("Blob sha256 does not match metadata")

        blob_id = _blob_id(kind, metadata.sha256)
        object_key = _object_key(kind, metadata.sha256)
        target_path = self._root_dir / object_key
        await asyncio.to_thread(_copy_atomic, source_path, target_path)

        return BlobRef(
            id=blob_id,
            asset_id=asset_id,
            backend=StorageBackend.LOCAL,
            kind=kind,
            object_key=object_key.as_posix(),
            size_bytes=metadata.size_bytes,
            sha256=metadata.sha256,
            encryption=encryption,
        )

    async def get(self, blob_id: str) -> BlobRef | None:
        kind, sha256 = _parse_blob_id(blob_id)
        object_key = _object_key(kind, sha256)
        path = self._root_dir / object_key
        if not await asyncio.to_thread(path.is_file):
            return None
        size_bytes = await asyncio.to_thread(lambda: path.stat().st_size)
        return BlobRef(
            id=blob_id,
            asset_id=None,
            backend=StorageBackend.LOCAL,
            kind=kind,
            object_key=object_key.as_posix(),
            size_bytes=size_bytes,
            sha256=sha256,
        )

    async def exists(self, blob_id: str) -> bool:
        kind, sha256 = _parse_blob_id(blob_id)
        return await asyncio.to_thread((self._root_dir / _object_key(kind, sha256)).is_file)

    async def delete(self, blob_id: str) -> None:
        kind, sha256 = _parse_blob_id(blob_id)
        path = self._root_dir / _object_key(kind, sha256)
        await asyncio.to_thread(_delete_if_present, path)

    async def download(self, blob_ref: BlobRef, destination_path: Path | str) -> Path:
        if blob_ref.backend != StorageBackend.LOCAL:
            raise StorageUnavailableError(StorageBackend.LOCAL.value)
        object_path = Path(blob_ref.object_key)
        if object_path.is_absolute() or ".." in object_path.parts:
            raise ValidationFailedError("Invalid blob object key")
        source_path = (self._root_dir / object_path).resolve()
        root = self._root_dir.resolve()
        if not source_path.is_relative_to(root) or not source_path.is_file():
            raise StorageUnavailableError(StorageBackend.LOCAL.value)
        target_path = Path(destination_path)
        await asyncio.to_thread(_copy_atomic, source_path, target_path)
        return target_path


def _blob_id(kind: BlobKind, sha256: str) -> str:
    return f"local_{kind.value}_{sha256}"


def _parse_blob_id(blob_id: str) -> tuple[BlobKind, str]:
    if "/" in blob_id or "\\" in blob_id or ".." in blob_id:
        raise ValidationFailedError("Invalid local blob id")
    parts = blob_id.split("_", maxsplit=2)
    if len(parts) != 3 or parts[0] != "local":
        raise ValidationFailedError("Invalid local blob id")
    try:
        kind = BlobKind(parts[1])
    except ValueError as exc:
        raise ValidationFailedError("Invalid local blob kind") from exc
    sha256 = parts[2]
    if len(sha256) != 64:
        raise ValidationFailedError("Invalid local blob sha256")
    try:
        int(sha256, 16)
    except ValueError as exc:
        raise ValidationFailedError("Invalid local blob sha256") from exc
    return kind, sha256


def _object_key(kind: BlobKind, sha256: str) -> Path:
    return Path("blobs") / kind.value / sha256[:2] / sha256[2:4] / sha256


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _copy_atomic(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target_path.parent, delete=False) as temp_file:
        temp_path = Path(temp_file.name)
        with source_path.open("rb") as source:
            shutil.copyfileobj(source, temp_file)
    temp_path.replace(target_path)


def _delete_if_present(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        return
