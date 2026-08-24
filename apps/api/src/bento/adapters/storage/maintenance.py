from __future__ import annotations

import asyncio
import time
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from bento.domain.storage import StorageBackend
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import BlobRefModel
from bento.ports.storage_maintenance import CacheReclaimResult, CacheUsage, StorageInventory


class SQLiteStorageInventory:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def summarize(self) -> StorageInventory:
        with session_scope(self._session_factory) as session:
            counts = dict(
                session.execute(
                    select(BlobRefModel.backend, func.count()).group_by(BlobRefModel.backend)
                ).all()
            )
        telegram = int(counts.get(StorageBackend.TELEGRAM.value, 0))
        local = int(counts.get(StorageBackend.LOCAL.value, 0))
        return StorageInventory(
            total_blobs=sum(int(value) for value in counts.values()),
            telegram_blobs=telegram,
            local_blobs=local,
        )


class LocalEphemeralCache:
    """Owns only reproducible or request-scoped files, never SQLite/config/models."""

    def __init__(self, data_dir: Path | str, *, recent_grace_seconds: int = 300) -> None:
        root = Path(data_dir) / "cache"
        self._roots = (
            root / "crypto",
            root / "downloads",
            root / "media",
            root / "ocr" / "pdf-pages",
            root / "telegram",
            root / "uploads",
            root / "worker-sources",
        )
        self._recent_grace_seconds = recent_grace_seconds

    async def usage(self) -> CacheUsage:
        return await asyncio.to_thread(self._usage)

    async def reclaim(self) -> CacheReclaimResult:
        return await asyncio.to_thread(self._reclaim)

    def _usage(self) -> CacheUsage:
        files = self._files()
        return CacheUsage(bytes=sum(_safe_size(path) for path in files), files=len(files))

    def _reclaim(self) -> CacheReclaimResult:
        cutoff = time.time() - self._recent_grace_seconds
        freed_bytes = 0
        deleted_files = 0
        skipped_recent_files = 0
        for path in self._files():
            try:
                stat = path.stat(follow_symlinks=False)
                if stat.st_mtime > cutoff:
                    skipped_recent_files += 1
                    continue
                path.unlink()
                freed_bytes += stat.st_size
                deleted_files += 1
            except FileNotFoundError:
                continue
        self._remove_empty_directories()
        return CacheReclaimResult(
            freed_bytes=freed_bytes,
            deleted_files=deleted_files,
            retained=self._usage(),
            skipped_recent_files=skipped_recent_files,
        )

    def _files(self) -> list[Path]:
        files: list[Path] = []
        for root in self._roots:
            if not root.is_dir() or root.is_symlink():
                continue
            files.extend(path for path in root.rglob("*") if path.is_file() and not path.is_symlink())
        return files

    def _remove_empty_directories(self) -> None:
        for root in self._roots:
            if not root.is_dir() or root.is_symlink():
                continue
            directories = sorted(
                (path for path in root.rglob("*") if path.is_dir() and not path.is_symlink()),
                key=lambda path: len(path.parts),
                reverse=True,
            )
            for directory in directories:
                try:
                    directory.rmdir()
                except OSError:
                    pass


def _safe_size(path: Path) -> int:
    try:
        return path.stat(follow_symlinks=False).st_size
    except (FileNotFoundError, OSError):
        return 0
