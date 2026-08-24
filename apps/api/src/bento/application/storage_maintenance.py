from __future__ import annotations

from dataclasses import dataclass

from bento.domain.errors import StorageUnavailableError, ValidationFailedError
from bento.domain.storage import StorageBackend
from bento.ports.blob_store import BlobStorePort
from bento.ports.storage_maintenance import EphemeralCachePort, StorageInventoryPort


@dataclass(frozen=True, slots=True)
class StorageMaintenanceStatus:
    connection_state: str
    can_reclaim: bool
    fully_remote: bool
    reclaimable_bytes: int
    reclaimable_files: int
    local_blob_count: int
    telegram_blob_count: int


@dataclass(frozen=True, slots=True)
class StorageReclaimResult:
    freed_bytes: int
    deleted_files: int
    retained_bytes: int
    retained_files: int
    skipped_recent_files: int


class StorageMaintenanceService:
    def __init__(
        self,
        *,
        storage_backend: StorageBackend,
        telegram_configured: bool,
        blob_store: BlobStorePort | None,
        inventory: StorageInventoryPort,
        cache: EphemeralCachePort,
    ) -> None:
        self._storage_backend = storage_backend
        self._telegram_configured = telegram_configured
        self._blob_store = blob_store
        self._inventory = inventory
        self._cache = cache

    async def status(self) -> StorageMaintenanceStatus:
        inventory = await self._inventory.summarize()
        usage = await self._cache.usage()
        connection_state = "not_configured"
        if self._storage_backend == StorageBackend.TELEGRAM and self._telegram_configured:
            connected = False
            if self._blob_store is not None:
                try:
                    connected = await self._blob_store.probe()
                except StorageUnavailableError:
                    connected = False
            connection_state = "connected" if connected else "unavailable"
        fully_remote = inventory.local_blobs == 0 and inventory.telegram_blobs == inventory.total_blobs
        return StorageMaintenanceStatus(
            connection_state=connection_state,
            can_reclaim=connection_state == "connected" and fully_remote,
            fully_remote=fully_remote,
            reclaimable_bytes=usage.bytes,
            reclaimable_files=usage.files,
            local_blob_count=inventory.local_blobs,
            telegram_blob_count=inventory.telegram_blobs,
        )

    async def reclaim(self) -> StorageReclaimResult:
        status = await self.status()
        if status.connection_state != "connected":
            raise StorageUnavailableError(StorageBackend.TELEGRAM.value)
        if not status.fully_remote:
            raise ValidationFailedError(
                "Local cache cannot be reclaimed while local blobs still exist",
                {"local_blob_count": status.local_blob_count},
            )
        result = await self._cache.reclaim()
        return StorageReclaimResult(
            freed_bytes=result.freed_bytes,
            deleted_files=result.deleted_files,
            retained_bytes=result.retained.bytes,
            retained_files=result.retained.files,
            skipped_recent_files=result.skipped_recent_files,
        )
