from __future__ import annotations

import asyncio
import base64
import os
import tempfile
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from bento.domain.errors import ValidationFailedError
from bento.domain.security import EncryptionMetadata, EncryptionMode

_MAGIC = b"BENTOENC\x01"
_NONCE_BYTES = 12
_TAG_BYTES = 16
_CHUNK_BYTES = 1024 * 1024


class LocalAesGcmEncryptionAdapter:
    """Streaming AES-256-GCM envelope encryption for large local files."""

    def __init__(self, *, key: bytes, key_id: str, temp_dir: Path | str) -> None:
        if len(key) != 32:
            raise ValidationFailedError("Bento encryption key must decode to exactly 32 bytes")
        encoded_key_id = key_id.encode("utf-8")
        if not encoded_key_id or len(encoded_key_id) > 255:
            raise ValidationFailedError("Bento encryption key id must contain between 1 and 255 bytes")
        self._key = key
        self._key_id = key_id
        self._temp_dir = Path(temp_dir)

    async def encrypt(self, source_ref: str) -> tuple[str, EncryptionMetadata]:
        return await asyncio.to_thread(self._encrypt_file, Path(source_ref))

    async def decrypt(self, source_ref: str, metadata: EncryptionMetadata) -> str:
        return await asyncio.to_thread(self._decrypt_file, Path(source_ref), metadata)

    def _encrypt_file(self, source_path: Path) -> tuple[str, EncryptionMetadata]:
        if not source_path.is_file():
            raise ValidationFailedError("Encryption source file does not exist")
        self._temp_dir.mkdir(parents=True, exist_ok=True)
        nonce = os.urandom(_NONCE_BYTES)
        key_id_bytes = self._key_id.encode("utf-8")
        header = _MAGIC + bytes((len(key_id_bytes),)) + key_id_bytes + nonce
        encryptor = Cipher(algorithms.AES(self._key), modes.GCM(nonce)).encryptor()
        encryptor.authenticate_additional_data(header)
        output_path = _temporary_path(self._temp_dir, ".bento")
        try:
            with source_path.open("rb") as source, output_path.open("wb") as target:
                target.write(header)
                for chunk in iter(lambda: source.read(_CHUNK_BYTES), b""):
                    target.write(encryptor.update(chunk))
                target.write(encryptor.finalize())
                target.write(encryptor.tag)
            return str(output_path), EncryptionMetadata(
                mode=EncryptionMode.AES_GCM,
                key_id=self._key_id,
                nonce=_encode(nonce),
                tag=_encode(encryptor.tag),
            )
        except Exception:
            output_path.unlink(missing_ok=True)
            raise

    def _decrypt_file(self, source_path: Path, metadata: EncryptionMetadata) -> str:
        if metadata.mode != EncryptionMode.AES_GCM:
            raise ValidationFailedError("AES-GCM adapter cannot decrypt this encryption mode")
        self._temp_dir.mkdir(parents=True, exist_ok=True)
        output_path = _temporary_path(self._temp_dir, ".plain")
        try:
            with source_path.open("rb") as source:
                header, key_id, nonce = _read_header(source)
                if key_id != self._key_id or metadata.key_id != self._key_id:
                    raise ValidationFailedError("Required Bento encryption key is not available")
                tag = _read_tag(source)
                if metadata.nonce != _encode(nonce) or metadata.tag != _encode(tag):
                    raise ValidationFailedError("Encrypted blob metadata does not match its envelope")
                ciphertext_bytes = source.seek(0, os.SEEK_END) - len(header) - _TAG_BYTES
                if ciphertext_bytes < 0:
                    raise ValidationFailedError("Encrypted blob is truncated")
                source.seek(len(header))
                decryptor = Cipher(algorithms.AES(self._key), modes.GCM(nonce, tag)).decryptor()
                decryptor.authenticate_additional_data(header)
                with output_path.open("wb") as target:
                    remaining = ciphertext_bytes
                    while remaining:
                        chunk = source.read(min(_CHUNK_BYTES, remaining))
                        if not chunk:
                            raise ValidationFailedError("Encrypted blob is truncated")
                        remaining -= len(chunk)
                        target.write(decryptor.update(chunk))
                    target.write(decryptor.finalize())
            return str(output_path)
        except InvalidTag as exc:
            output_path.unlink(missing_ok=True)
            raise ValidationFailedError("Encrypted blob authentication failed") from exc
        except Exception:
            output_path.unlink(missing_ok=True)
            raise


def decode_encryption_key(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value.strip() + "=" * (-len(value.strip()) % 4))
    except (ValueError, TypeError) as exc:
        raise ValidationFailedError("Bento encryption key must be URL-safe base64") from exc


def _read_header(source) -> tuple[bytes, str, bytes]:
    prefix = source.read(len(_MAGIC) + 1)
    if len(prefix) != len(_MAGIC) + 1 or not prefix.startswith(_MAGIC):
        raise ValidationFailedError("Encrypted blob has an invalid Bento envelope")
    key_id_length = prefix[-1]
    key_id_bytes = source.read(key_id_length)
    nonce = source.read(_NONCE_BYTES)
    if len(key_id_bytes) != key_id_length or len(nonce) != _NONCE_BYTES:
        raise ValidationFailedError("Encrypted blob is truncated")
    try:
        key_id = key_id_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValidationFailedError("Encrypted blob key id is invalid") from exc
    return prefix + key_id_bytes + nonce, key_id, nonce


def _read_tag(source) -> bytes:
    if source.seek(0, os.SEEK_END) < _TAG_BYTES:
        raise ValidationFailedError("Encrypted blob is truncated")
    source.seek(-_TAG_BYTES, os.SEEK_END)
    tag = source.read(_TAG_BYTES)
    if len(tag) != _TAG_BYTES:
        raise ValidationFailedError("Encrypted blob is truncated")
    return tag


def _temporary_path(directory: Path, suffix: str) -> Path:
    with tempfile.NamedTemporaryFile(prefix="bento-crypto-", suffix=suffix, dir=directory, delete=False) as handle:
        return Path(handle.name)


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
