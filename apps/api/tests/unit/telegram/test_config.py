from __future__ import annotations

import pytest

from bento.domain.errors import TelegramNotConfiguredError, ValidationFailedError
from bento.domain.storage import BlobKind
from bento.infrastructure.settings import Settings
from bento.infrastructure.telegram.config import load_telegram_storage_config


def test_local_mode_does_not_require_telegram_config() -> None:
    settings = Settings(storage_backend="local", telegram_bot_token=None)

    assert load_telegram_storage_config(settings, {}) is None


def test_missing_config_errors_only_in_telegram_mode() -> None:
    settings = Settings(storage_backend="telegram", telegram_bot_token=None)

    with pytest.raises(TelegramNotConfiguredError):
        load_telegram_storage_config(settings, {})


def test_explicit_empty_environ_does_not_fall_back_to_process_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:test-token")
    monkeypatch.setenv("TELEGRAM_API_ID", "42")
    monkeypatch.setenv("TELEGRAM_API_HASH", "hash")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "webhook-secret-0123456789abcdefghi")
    monkeypatch.setenv("TELEGRAM_RAW_CHAT_ID", "-1001")
    monkeypatch.setenv("TELEGRAM_THUMBS_CHAT_ID", "-1002")
    monkeypatch.setenv("TELEGRAM_JOURNAL_CHAT_ID", "-1003")
    settings = Settings(storage_backend="telegram", telegram_bot_token=None)

    with pytest.raises(TelegramNotConfiguredError):
        load_telegram_storage_config(settings, {})


def test_telegram_config_maps_blob_kinds_to_channels() -> None:
    settings = Settings(storage_backend="telegram")
    config = load_telegram_storage_config(
        settings,
        {
            "TELEGRAM_BOT_TOKEN": "123:test-token",
            "TELEGRAM_API_ID": "42",
            "TELEGRAM_API_HASH": "hash",
            "TELEGRAM_WEBHOOK_SECRET": "webhook-secret-0123456789abcdefghi",
            "TELEGRAM_RAW_CHAT_ID": "-1001",
            "TELEGRAM_THUMBS_CHAT_ID": "-1002",
            "TELEGRAM_JOURNAL_CHAT_ID": "-1003",
        },
    )

    assert config is not None
    assert config.chat_id_for_kind(BlobKind.ORIGINAL) == "-1001"
    assert config.chat_id_for_kind(BlobKind.THUMBNAIL) == "-1002"
    assert config.chat_id_for_kind(BlobKind.PREVIEW) == "-1002"
    assert config.chat_id_for_kind(BlobKind.JOURNAL) == "-1003"


def test_telegram_config_rejects_weak_webhook_secret() -> None:
    settings = Settings(storage_backend="telegram")
    env = {
        "TELEGRAM_BOT_TOKEN": "123:test-token",
        "TELEGRAM_API_ID": "42",
        "TELEGRAM_API_HASH": "hash",
        "TELEGRAM_WEBHOOK_SECRET": "too-short",
        "TELEGRAM_RAW_CHAT_ID": "-1001",
        "TELEGRAM_THUMBS_CHAT_ID": "-1002",
        "TELEGRAM_JOURNAL_CHAT_ID": "-1003",
    }

    with pytest.raises(ValidationFailedError, match="32-256"):
        load_telegram_storage_config(settings, env)
