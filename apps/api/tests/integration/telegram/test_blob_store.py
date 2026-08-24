from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from bento.adapters.storage.telegram_blob_store import TelegramBlobStoreAdapter
from bento.domain.assets import AssetMetadata
from bento.domain.errors import StorageUnavailableError
from bento.domain.storage import BlobKind, StorageBackend
from bento.infrastructure.telegram.client import TelegramApiError, TelegramDocumentRef, TelegramFileRef
from bento.infrastructure.telegram.config import TelegramStorageConfig
from bento.infrastructure.telegram.retry import TelegramRateLimiter, TelegramRetryPolicy


def test_fake_telegram_client_put_get_download_exists_and_delete(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "source.txt"
        content = b"telegram backed content"
        source.write_bytes(content)
        sha256 = hashlib.sha256(content).hexdigest()
        client = FakeTelegramClient(download_content=content)
        store = TelegramBlobStoreAdapter(config=_config(), client=client)

        blob_ref = await store.store(
            str(source),
            asset_id="asset-1",
            kind=BlobKind.ORIGINAL,
            metadata=AssetMetadata(
                original_filename="source.txt",
                mime_type="text/plain",
                size_bytes=len(content),
                sha256=sha256,
            ),
        )

        assert blob_ref.backend == StorageBackend.TELEGRAM
        assert blob_ref.chat_id == "-100raw"
        assert blob_ref.message_id == "101"
        assert blob_ref.file_id == "file-1"
        assert blob_ref.file_unique_id == "unique-1"
        assert blob_ref.object_key == f"telegram/original/{sha256[:2]}/{sha256[2:4]}/{sha256}"
        assert await store.exists(blob_ref.id) is True
        assert await store.get(blob_ref.id) == blob_ref

        destination = await store.download(blob_ref, tmp_path / "downloaded.txt")
        assert destination.read_bytes() == content
        assert client.downloaded_file_paths == ["remote/source.txt"]

        await store.delete(blob_ref.id)
        assert await store.exists(blob_ref.id) is False
        assert await store.get(blob_ref.id) is None
        assert client.deleted_messages == [("-100raw", "101")]

    asyncio.run(scenario())


def test_retry_and_rate_limit_behavior_with_fake_failures(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "source.txt"
        content = b"retry me"
        source.write_bytes(content)
        sha256 = hashlib.sha256(content).hexdigest()
        client = FakeTelegramClient(
            download_content=content,
            failures=[
                TelegramApiError(
                    status_code=429,
                    error_code=429,
                    description="Too Many Requests",
                    retry_after=1.25,
                )
            ],
        )
        sleeps: list[float] = []
        now = 10.0

        async def fake_sleep(delay: float) -> None:
            nonlocal now
            sleeps.append(delay)
            now += delay

        store = TelegramBlobStoreAdapter(
            config=_config(),
            client=client,
            retry_policy=TelegramRetryPolicy(max_attempts=3, base_delay_seconds=0.5),
            rate_limiter=TelegramRateLimiter(
                min_interval_seconds=0.5,
                sleep=fake_sleep,
                monotonic=lambda: now,
            ),
            sleep=fake_sleep,
        )

        blob_ref = await store.store(
            str(source),
            asset_id="asset-1",
            kind=BlobKind.ORIGINAL,
            metadata=AssetMetadata(
                original_filename="source.txt",
                mime_type="text/plain",
                size_bytes=len(content),
                sha256=sha256,
            ),
        )
        await store.download(blob_ref, tmp_path / "downloaded.txt")

        assert client.send_attempts == 2
        assert sleeps[:2] == [1.25, 0.5]

    asyncio.run(scenario())


def test_retry_treats_network_failure_as_temporary(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "source.txt"
        content = b"temporary network failure"
        source.write_bytes(content)
        sha256 = hashlib.sha256(content).hexdigest()
        client = FakeTelegramClient(
            download_content=content,
            failures=[TelegramApiError(status_code=None, error_code=None, description="Telegram unavailable")],
        )
        sleeps: list[float] = []

        async def fake_sleep(delay: float) -> None:
            sleeps.append(delay)

        store = TelegramBlobStoreAdapter(
            config=_config(),
            client=client,
            retry_policy=TelegramRetryPolicy(max_attempts=2, base_delay_seconds=0.5),
            sleep=fake_sleep,
        )

        blob_ref = await store.store(
            str(source),
            asset_id="asset-1",
            kind=BlobKind.ORIGINAL,
            metadata=AssetMetadata(
                original_filename="source.txt",
                mime_type="text/plain",
                size_bytes=len(content),
                sha256=sha256,
            ),
        )

        assert blob_ref.file_id == "file-1"
        assert client.send_attempts == 2
        assert sleeps == [0.5]

    asyncio.run(scenario())


def test_non_retryable_telegram_failure_becomes_storage_unavailable(tmp_path: Path) -> None:
    async def scenario() -> None:
        source = tmp_path / "source.txt"
        content = b"bad request"
        source.write_bytes(content)
        client = FakeTelegramClient(
            download_content=content,
            failures=[TelegramApiError(status_code=400, error_code=400, description="Bad Request")],
        )
        store = TelegramBlobStoreAdapter(config=_config(), client=client)

        with pytest.raises(StorageUnavailableError):
            await store.store(
                str(source),
                asset_id="asset-1",
                kind=BlobKind.ORIGINAL,
                metadata=AssetMetadata(
                    original_filename="source.txt",
                    mime_type="text/plain",
                    size_bytes=len(content),
                    sha256=hashlib.sha256(content).hexdigest(),
                ),
            )

        assert client.send_attempts == 1

    asyncio.run(scenario())


@dataclass
class FakeTelegramClient:
    download_content: bytes
    failures: list[TelegramApiError] = field(default_factory=list)
    send_attempts: int = 0
    downloaded_file_paths: list[str] = field(default_factory=list)
    deleted_messages: list[tuple[str, str]] = field(default_factory=list)

    async def send_document(
        self,
        chat_id: str,
        source_path: Path,
        *,
        filename: str,
        caption: str | None = None,
    ) -> TelegramDocumentRef:
        del source_path, filename, caption
        self.send_attempts += 1
        if self.failures:
            raise self.failures.pop(0)
        return TelegramDocumentRef(
            chat_id=chat_id,
            message_id="101",
            file_id="file-1",
            file_unique_id="unique-1",
            file_size=len(self.download_content),
        )

    async def get_file(self, file_id: str) -> TelegramFileRef:
        return TelegramFileRef(
            file_id=file_id,
            file_unique_id="unique-1",
            file_size=len(self.download_content),
            file_path="remote/source.txt",
        )

    async def download_file(self, file_path: str, destination_path: Path) -> None:
        self.downloaded_file_paths.append(file_path)
        destination_path.write_bytes(self.download_content)

    async def delete_message(self, chat_id: str, message_id: str) -> bool:
        self.deleted_messages.append((chat_id, message_id))
        return True

    async def send_message(self, chat_id: str, text: str):
        raise AssertionError("not used")


def _config() -> TelegramStorageConfig:
    return TelegramStorageConfig(
        bot_api_url="http://telegram-bot-api:8081",
        bot_token="123:test",
        api_id="42",
        api_hash="hash",
        webhook_secret="webhook-secret-0123456789abcdefghi",
        raw_chat_id="-100raw",
        thumbs_chat_id="-100thumbs",
        journal_chat_id="-100journal",
        min_interval_seconds=0,
    )
