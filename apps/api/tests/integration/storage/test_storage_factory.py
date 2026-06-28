from __future__ import annotations

from pathlib import Path

from bento.adapters.security import NoOpEncryptionAdapter
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.infrastructure.settings import Settings
from bento.infrastructure.storage import create_blob_store, create_encryption_adapter


def test_local_storage_factory_does_not_require_telegram_env(tmp_path: Path) -> None:
    settings = Settings(
        storage_backend="local",
        telegram_bot_token=None,
        data_dir=str(tmp_path),
    )

    blob_store = create_blob_store(settings)
    encryption = create_encryption_adapter(settings)

    assert isinstance(blob_store, LocalBlobStoreAdapter)
    assert isinstance(encryption, NoOpEncryptionAdapter)
