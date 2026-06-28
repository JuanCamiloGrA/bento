from __future__ import annotations

from pathlib import Path

from bento.adapters.security import NoOpEncryptionAdapter
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.domain.errors import TelegramNotConfiguredError
from bento.infrastructure.settings import Settings
from bento.ports.blob_store import BlobStorePort
from bento.ports.security import EncryptionPort


def create_blob_store(settings: Settings) -> BlobStorePort:
    if settings.storage_backend == "local":
        return LocalBlobStoreAdapter(_local_blob_root(settings))
    raise TelegramNotConfiguredError()


def create_encryption_adapter(settings: Settings) -> EncryptionPort:
    del settings
    return NoOpEncryptionAdapter()


def _local_blob_root(settings: Settings) -> Path:
    return Path(settings.data_dir) / "uploads"
