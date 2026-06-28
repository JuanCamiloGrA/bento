from __future__ import annotations

from bento.domain.security import EncryptionMetadata, EncryptionMode


class NoOpEncryptionAdapter:
    async def encrypt(self, source_ref: str) -> tuple[str, EncryptionMetadata]:
        return source_ref, EncryptionMetadata(mode=EncryptionMode.NONE)

    async def decrypt(self, source_ref: str, metadata: EncryptionMetadata) -> str:
        if metadata.mode != EncryptionMode.NONE:
            msg = "NoOpEncryptionAdapter can only decrypt unencrypted blobs"
            raise ValueError(msg)
        return source_ref
