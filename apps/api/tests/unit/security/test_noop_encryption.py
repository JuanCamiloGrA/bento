from __future__ import annotations

import asyncio

import pytest

from bento.adapters.security import NoOpEncryptionAdapter
from bento.domain.security import EncryptionMetadata, EncryptionMode


def test_noop_encryption_round_trip_returns_same_reference() -> None:
    async def scenario() -> None:
        adapter = NoOpEncryptionAdapter()

        encrypted_ref, metadata = await adapter.encrypt("tmp/upload.bin")
        decrypted_ref = await adapter.decrypt(encrypted_ref, metadata)

        assert encrypted_ref == "tmp/upload.bin"
        assert decrypted_ref == "tmp/upload.bin"
        assert metadata == EncryptionMetadata(mode=EncryptionMode.NONE)

    asyncio.run(scenario())


def test_noop_encryption_rejects_encrypted_metadata() -> None:
    async def scenario() -> None:
        adapter = NoOpEncryptionAdapter()

        with pytest.raises(ValueError):
            await adapter.decrypt("tmp/upload.bin", EncryptionMetadata(mode=EncryptionMode.AES_GCM))

    asyncio.run(scenario())
