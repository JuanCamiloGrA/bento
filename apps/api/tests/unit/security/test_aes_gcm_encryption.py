from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from bento.adapters.security import LocalAesGcmEncryptionAdapter
from bento.domain.errors import ValidationFailedError
from bento.domain.security import EncryptionMode


def test_aes_gcm_streaming_round_trip_and_random_nonce(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "private.txt"
        content = (b"private-content-" * 100_000) + b"end"
        source.write_bytes(content)
        adapter = _adapter(tmp_path)

        first_path, first_metadata = await adapter.encrypt(str(source))
        second_path, second_metadata = await adapter.encrypt(str(source))
        try:
            first_ciphertext = Path(first_path).read_bytes()
            assert content not in first_ciphertext
            assert first_ciphertext != Path(second_path).read_bytes()
            assert first_metadata.mode == EncryptionMode.AES_GCM
            assert first_metadata.nonce != second_metadata.nonce

            plaintext_path = Path(await adapter.decrypt(first_path, first_metadata))
            try:
                assert plaintext_path.read_bytes() == content
            finally:
                plaintext_path.unlink(missing_ok=True)
        finally:
            Path(first_path).unlink(missing_ok=True)
            Path(second_path).unlink(missing_ok=True)

    asyncio.run(scenario())


def test_aes_gcm_rejects_tampered_ciphertext(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "private.txt"
        source.write_bytes(b"authenticated content")
        adapter = _adapter(tmp_path)
        encrypted_path_text, metadata = await adapter.encrypt(str(source))
        encrypted_path = Path(encrypted_path_text)
        try:
            payload = bytearray(encrypted_path.read_bytes())
            payload[len(payload) // 2] ^= 1
            encrypted_path.write_bytes(payload)
            with pytest.raises(ValidationFailedError, match="authentication failed"):
                await adapter.decrypt(str(encrypted_path), metadata)
        finally:
            encrypted_path.unlink(missing_ok=True)

    asyncio.run(scenario())


def _adapter(tmp_path: Path) -> LocalAesGcmEncryptionAdapter:
    return LocalAesGcmEncryptionAdapter(key=b"k" * 32, key_id="primary", temp_dir=tmp_path / "crypto")
