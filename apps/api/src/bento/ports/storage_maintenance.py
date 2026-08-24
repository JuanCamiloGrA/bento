from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class StorageInventory:
    total_blobs: int
    telegram_blobs: int
    local_blobs: int


@dataclass(frozen=True, slots=True)
class CacheUsage:
    bytes: int
    files: int


@dataclass(frozen=True, slots=True)
class CacheReclaimResult:
    freed_bytes: int
    deleted_files: int
    retained: CacheUsage
    skipped_recent_files: int


class StorageInventoryPort(Protocol):
    async def summarize(self) -> StorageInventory: ...


class EphemeralCachePort(Protocol):
    async def usage(self) -> CacheUsage: ...

    async def reclaim(self) -> CacheReclaimResult: ...
