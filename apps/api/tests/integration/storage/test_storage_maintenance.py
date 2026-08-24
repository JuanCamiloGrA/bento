from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

import pytest

from bento.adapters.storage.maintenance import LocalEphemeralCache
from bento.application.storage_maintenance import StorageMaintenanceService
from bento.domain.errors import StorageUnavailableError, ValidationFailedError
from bento.domain.storage import StorageBackend
from bento.ports.storage_maintenance import StorageInventory


def test_reclaim_removes_old_ephemeral_files_but_keeps_recent_and_service_data(tmp_path: Path) -> None:
    async def scenario() -> None:
        old_media = tmp_path / "cache" / "media" / "asset-1" / "thumb.jpg"
        recent_download = tmp_path / "cache" / "downloads" / "active"
        bot_api_data = tmp_path / "cache" / "telegram-bot-api" / "state.binlog"
        database = tmp_path / "db" / "bento.sqlite3"
        for path, content in (
            (old_media, b"old-cache"),
            (recent_download, b"active"),
            (bot_api_data, b"bot-state"),
            (database, b"database"),
        ):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        old_timestamp = time.time() - 3600
        os.utime(old_media, (old_timestamp, old_timestamp))

        cache = LocalEphemeralCache(tmp_path, recent_grace_seconds=300)
        result = await cache.reclaim()

        assert result.freed_bytes == len(b"old-cache")
        assert result.deleted_files == 1
        assert result.skipped_recent_files == 1
        assert not old_media.exists()
        assert recent_download.is_file()
        assert bot_api_data.is_file()
        assert database.is_file()

    asyncio.run(scenario())


def test_service_only_reclaims_when_telegram_is_connected_and_inventory_is_remote(tmp_path: Path) -> None:
    async def scenario() -> None:
        cached = tmp_path / "cache" / "media" / "asset-1" / "preview.jpg"
        cached.parent.mkdir(parents=True)
        cached.write_bytes(b"preview")
        old_timestamp = time.time() - 3600
        os.utime(cached, (old_timestamp, old_timestamp))
        service = StorageMaintenanceService(
            storage_backend=StorageBackend.TELEGRAM,
            telegram_configured=True,
            blob_store=ConnectedBlobStore(),
            inventory=StaticInventory(StorageInventory(total_blobs=4, telegram_blobs=4, local_blobs=0)),
            cache=LocalEphemeralCache(tmp_path, recent_grace_seconds=300),
        )

        status = await service.status()
        result = await service.reclaim()

        assert status.connection_state == "connected"
        assert status.can_reclaim is True
        assert status.fully_remote is True
        assert status.reclaimable_bytes == len(b"preview")
        assert result.freed_bytes == len(b"preview")
        assert not cached.exists()

    asyncio.run(scenario())


def test_service_blocks_reclaim_for_unavailable_telegram_or_local_blobs(tmp_path: Path) -> None:
    async def scenario() -> None:
        unavailable = StorageMaintenanceService(
            storage_backend=StorageBackend.TELEGRAM,
            telegram_configured=True,
            blob_store=UnavailableBlobStore(),
            inventory=StaticInventory(StorageInventory(total_blobs=1, telegram_blobs=1, local_blobs=0)),
            cache=LocalEphemeralCache(tmp_path),
        )
        with pytest.raises(StorageUnavailableError):
            await unavailable.reclaim()

        mixed = StorageMaintenanceService(
            storage_backend=StorageBackend.TELEGRAM,
            telegram_configured=True,
            blob_store=ConnectedBlobStore(),
            inventory=StaticInventory(StorageInventory(total_blobs=2, telegram_blobs=1, local_blobs=1)),
            cache=LocalEphemeralCache(tmp_path),
        )
        with pytest.raises(ValidationFailedError, match="local blobs"):
            await mixed.reclaim()

    asyncio.run(scenario())


class StaticInventory:
    def __init__(self, value: StorageInventory) -> None:
        self._value = value

    async def summarize(self) -> StorageInventory:
        return self._value


class ConnectedBlobStore:
    async def probe(self) -> bool:
        return True


class UnavailableBlobStore:
    async def probe(self) -> bool:
        raise StorageUnavailableError(StorageBackend.TELEGRAM.value)
