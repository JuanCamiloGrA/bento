from __future__ import annotations

import asyncio
import hashlib
from dataclasses import replace
from pathlib import Path
from typing import Any

from bento.domain.assets import AssetMetadata
from bento.domain.errors import ValidationFailedError
from bento.domain.security import EncryptionMetadata, EncryptionMode
from bento.domain.storage import BlobKind, BlobRef
from bento.ports.security import EncryptionPort


class EncryptedBlobStoreAdapter:
    def __init__(self, *, delegate: Any, encryption: EncryptionPort) -> None:
        self._delegate = delegate
        self._encryption = encryption

    async def store(
        self,
        source_ref: str,
        *,
        asset_id: str | None,
        kind: BlobKind,
        metadata: AssetMetadata,
        encryption: EncryptionMetadata | None = None,
    ) -> BlobRef:
        del encryption
        encrypted_ref, encryption_metadata = await self._encryption.encrypt(source_ref)
        encrypted_path = Path(encrypted_ref)
        try:
            encrypted_sha256 = await asyncio.to_thread(_sha256_file, encrypted_path)
            encrypted_metadata = replace(
                metadata,
                original_filename=f"{encrypted_sha256}.bento",
                mime_type="application/octet-stream",
                size_bytes=encrypted_path.stat().st_size,
                sha256=encrypted_sha256,
            )
            stored = await self._delegate.store(
                encrypted_ref,
                asset_id=asset_id,
                kind=kind,
                metadata=encrypted_metadata,
                encryption=encryption_metadata,
            )
            return replace(
                stored,
                size_bytes=metadata.size_bytes,
                sha256=metadata.sha256,
                encryption=encryption_metadata,
            )
        finally:
            encrypted_path.unlink(missing_ok=True)

    async def download(self, blob_ref: BlobRef, destination_path: Path | str) -> Path:
        if blob_ref.encryption.mode != EncryptionMode.AES_GCM:
            return await self._delegate.download(blob_ref, destination_path)
        target_path = Path(destination_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        encrypted_path = target_path.with_name(f".{target_path.name}.encrypted")
        plaintext_path: Path | None = None
        try:
            await self._delegate.download(replace(blob_ref, sha256=None), encrypted_path)
            plaintext_path = Path(await self._encryption.decrypt(str(encrypted_path), blob_ref.encryption))
            if blob_ref.sha256 is not None:
                actual_sha256 = await asyncio.to_thread(_sha256_file, plaintext_path)
                if actual_sha256 != blob_ref.sha256:
                    raise ValidationFailedError("Decrypted blob sha256 does not match metadata")
            plaintext_path.replace(target_path)
            plaintext_path = None
            return target_path
        finally:
            encrypted_path.unlink(missing_ok=True)
            if plaintext_path is not None:
                plaintext_path.unlink(missing_ok=True)

    async def get(self, blob_id: str) -> BlobRef | None:
        return await self._delegate.get(blob_id)

    async def exists(self, blob_id: str) -> bool:
        return await self._delegate.exists(blob_id)

    async def delete(self, blob_id: str) -> None:
        await self._delegate.delete(blob_id)

    def register(self, blob_ref: BlobRef) -> None:
        register = getattr(self._delegate, "register", None)
        if register is not None:
            register(blob_ref)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
