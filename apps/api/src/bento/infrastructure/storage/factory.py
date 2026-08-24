from __future__ import annotations

from pathlib import Path

from bento.adapters.security import LocalAesGcmEncryptionAdapter, NoOpEncryptionAdapter, decode_encryption_key
from bento.adapters.storage.encrypted_blob_store import EncryptedBlobStoreAdapter
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.adapters.storage.telegram_blob_store import TelegramBlobStoreAdapter
from bento.domain.errors import ValidationFailedError
from bento.infrastructure.settings import Settings
from bento.infrastructure.telegram.client import StdlibTelegramBotApiClient
from bento.infrastructure.telegram.config import require_telegram_storage_config
from bento.infrastructure.telegram.retry import TelegramRateLimiter
from bento.ports.blob_store import BlobStorePort
from bento.ports.security import EncryptionPort


def create_blob_store(settings: Settings) -> BlobStorePort:
    if settings.storage_backend == "local":
        return LocalBlobStoreAdapter(_local_blob_root(settings))
    if settings.encryption_mode != "aes_gcm":
        raise ValidationFailedError("Telegram storage requires ENCRYPTION_MODE=aes_gcm")
    config = require_telegram_storage_config(settings)
    delegate = TelegramBlobStoreAdapter(
        config=config,
        client=StdlibTelegramBotApiClient(config),
        rate_limiter=TelegramRateLimiter(min_interval_seconds=config.min_interval_seconds),
    )

    encryption = create_encryption_adapter(settings)
    return EncryptedBlobStoreAdapter(delegate=delegate, encryption=encryption)


def create_encryption_adapter(settings: Settings) -> EncryptionPort:
    if settings.encryption_mode == "none":
        return NoOpEncryptionAdapter()
    if not settings.bento_encryption_key:
        raise ValidationFailedError("BENTO_ENCRYPTION_KEY is required for AES-GCM encryption")
    return LocalAesGcmEncryptionAdapter(
        key=decode_encryption_key(settings.bento_encryption_key),
        key_id=settings.bento_encryption_key_id,
        temp_dir=Path(settings.data_dir) / "cache" / "crypto",
    )


def _local_blob_root(settings: Settings) -> Path:
    return Path(settings.data_dir) / "uploads"
