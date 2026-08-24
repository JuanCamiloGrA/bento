from __future__ import annotations

import asyncio
import hashlib
import tempfile
from collections.abc import Awaitable, Callable
from pathlib import Path

from bento.domain.assets import AssetMetadata
from bento.domain.errors import StorageUnavailableError, ValidationFailedError
from bento.domain.security import EncryptionMetadata, EncryptionMode
from bento.domain.storage import BlobKind, BlobRef, StorageBackend
from bento.infrastructure.telegram.client import TelegramApiClient, TelegramApiError
from bento.infrastructure.telegram.config import TelegramStorageConfig
from bento.infrastructure.telegram.retry import (
    TelegramRateLimiter,
    TelegramRetryPolicy,
    call_with_telegram_retries,
)


class TelegramBlobStoreAdapter:
    def __init__(
        self,
        *,
        config: TelegramStorageConfig,
        client: TelegramApiClient,
        retry_policy: TelegramRetryPolicy | None = None,
        rate_limiter: TelegramRateLimiter | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._config = config
        self._client = client
        self._retry_policy = retry_policy or TelegramRetryPolicy(
            max_attempts=config.max_attempts,
            base_delay_seconds=config.retry_base_delay_seconds,
        )
        self._rate_limiter = rate_limiter
        self._sleep = sleep
        self._refs: dict[str, BlobRef] = {}

    async def probe(self) -> bool:
        try:
            return await call_with_telegram_retries(
                lambda: self._client.probe(
                    (
                        self._config.raw_chat_id,
                        self._config.thumbs_chat_id,
                        self._config.journal_chat_id,
                    )
                ),
                retry_policy=self._retry_policy,
                rate_limiter=self._rate_limiter,
                sleep=self._sleep,
            )
        except TelegramApiError as exc:
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value) from exc

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
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value)
        actual_sha256 = await asyncio.to_thread(_sha256_file, source_path)
        if actual_sha256 != metadata.sha256:
            raise ValidationFailedError("Blob sha256 does not match metadata")

        chat_id = self._config.chat_id_for_kind(kind)
        try:
            document = await call_with_telegram_retries(
                lambda: self._client.send_document(
                    chat_id,
                    source_path,
                    filename=metadata.original_filename,
                ),
                retry_policy=self._retry_policy,
                rate_limiter=self._rate_limiter,
                sleep=self._sleep,
            )
        except TelegramApiError as exc:
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value) from exc

        blob_ref = BlobRef(
            id=_blob_id(kind, metadata.sha256),
            asset_id=asset_id,
            backend=StorageBackend.TELEGRAM,
            kind=kind,
            object_key=_object_key(kind, metadata.sha256),
            size_bytes=metadata.size_bytes,
            sha256=metadata.sha256,
            chat_id=document.chat_id,
            message_id=document.message_id,
            file_id=document.file_id,
            file_unique_id=document.file_unique_id,
            encryption=encryption,
        )
        self._refs[blob_ref.id] = blob_ref
        return blob_ref

    async def get(self, blob_id: str) -> BlobRef | None:
        return self._refs.get(blob_id)

    async def exists(self, blob_id: str) -> bool:
        return blob_id in self._refs

    async def delete(self, blob_id: str) -> None:
        blob_ref = self._refs.get(blob_id)
        if blob_ref is None or blob_ref.chat_id is None or blob_ref.message_id is None:
            return
        try:
            await call_with_telegram_retries(
                lambda: self._client.delete_message(blob_ref.chat_id or "", blob_ref.message_id or ""),
                retry_policy=self._retry_policy,
                rate_limiter=self._rate_limiter,
                sleep=self._sleep,
            )
        except TelegramApiError as exc:
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value) from exc
        self._refs.pop(blob_id, None)

    async def download(self, blob_ref: BlobRef, destination_path: Path | str) -> Path:
        if blob_ref.backend != StorageBackend.TELEGRAM or not blob_ref.file_id:
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value)
        target_path = Path(destination_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            file_ref = await call_with_telegram_retries(
                lambda: self._client.get_file(blob_ref.file_id or ""),
                retry_policy=self._retry_policy,
                rate_limiter=self._rate_limiter,
                sleep=self._sleep,
            )
            with tempfile.NamedTemporaryFile(dir=target_path.parent, delete=False) as handle:
                temporary_path = Path(handle.name)
            try:
                await call_with_telegram_retries(
                    lambda: self._client.download_file(file_ref.file_path, temporary_path),
                    retry_policy=self._retry_policy,
                    rate_limiter=self._rate_limiter,
                    sleep=self._sleep,
                )
                if blob_ref.sha256 is not None and blob_ref.encryption.mode == EncryptionMode.NONE:
                    actual_sha256 = await asyncio.to_thread(_sha256_file, temporary_path)
                    if actual_sha256 != blob_ref.sha256:
                        raise ValidationFailedError("Downloaded blob sha256 does not match metadata")
                temporary_path.replace(target_path)
            finally:
                temporary_path.unlink(missing_ok=True)
            return target_path
        except TelegramApiError as exc:
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value) from exc

    def register(self, blob_ref: BlobRef) -> None:
        if blob_ref.backend != StorageBackend.TELEGRAM:
            raise ValidationFailedError("Cannot register non-Telegram blob ref")
        self._refs[blob_ref.id] = blob_ref


def _blob_id(kind: BlobKind, sha256: str) -> str:
    return f"telegram_{kind.value}_{sha256}"


def _object_key(kind: BlobKind, sha256: str) -> str:
    return f"telegram/{kind.value}/{sha256[:2]}/{sha256[2:4]}/{sha256}"


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
