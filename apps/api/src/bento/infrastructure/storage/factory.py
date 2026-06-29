from __future__ import annotations

from pathlib import Path

from bento.adapters.security import NoOpEncryptionAdapter
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.adapters.storage.telegram_blob_store import TelegramBlobStoreAdapter
from bento.infrastructure.settings import Settings
from bento.infrastructure.telegram.client import StdlibTelegramBotApiClient
from bento.infrastructure.telegram.config import require_telegram_storage_config
from bento.infrastructure.telegram.retry import TelegramRateLimiter
from bento.ports.blob_store import BlobStorePort
from bento.ports.security import EncryptionPort


def create_blob_store(settings: Settings) -> BlobStorePort:
    if settings.storage_backend == "local":
        return LocalBlobStoreAdapter(_local_blob_root(settings))

    config = require_telegram_storage_config(settings)
    return TelegramBlobStoreAdapter(
        config=config,
        client=StdlibTelegramBotApiClient(config),
        rate_limiter=TelegramRateLimiter(min_interval_seconds=config.min_interval_seconds),
    )


def create_encryption_adapter(settings: Settings) -> EncryptionPort:
    del settings
    return NoOpEncryptionAdapter()


def _local_blob_root(settings: Settings) -> Path:
    return Path(settings.data_dir) / "uploads"
