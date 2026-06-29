from __future__ import annotations

from pathlib import Path

from bento.adapters.security import NoOpEncryptionAdapter
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.adapters.storage.telegram_blob_store import TelegramBlobStoreAdapter
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


def test_telegram_storage_factory_wires_configured_adapter(tmp_path: Path) -> None:
    settings = Settings(
        storage_backend="telegram",
        telegram_bot_api_url="http://127.0.0.1:8081",
        telegram_bot_token="123:test",
        telegram_api_id="42",
        telegram_api_hash="hash",
        telegram_raw_chat_id="-100raw",
        telegram_thumbs_chat_id="-100thumbs",
        telegram_journal_chat_id="-100journal",
        data_dir=str(tmp_path),
    )

    blob_store = create_blob_store(settings)

    assert isinstance(blob_store, TelegramBlobStoreAdapter)
