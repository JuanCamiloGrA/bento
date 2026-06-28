from __future__ import annotations

from typing import Protocol

from bento.domain.security import EncryptionMetadata


class EncryptionPort(Protocol):
    async def encrypt(self, source_ref: str) -> tuple[str, EncryptionMetadata]: ...

    async def decrypt(self, source_ref: str, metadata: EncryptionMetadata) -> str: ...
