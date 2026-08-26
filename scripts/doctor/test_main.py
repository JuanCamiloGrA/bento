from __future__ import annotations

import base64
from pathlib import Path

import pytest
from pydantic import ValidationError

from bento.infrastructure.settings import Settings
from main import (
    _check_settings_registry,
    _check_telegram,
    _load_settings,
    _redact_secrets,
    _validation_detail,
)


def test_load_settings_uses_registry_aliases_and_process_precedence(tmp_path: Path) -> None:
    (tmp_path / ".env.example").write_text(
        "DATA_DIR=./data\nEMBEDDINGS_PROVIDER=disabled\n",
        encoding="utf-8",
    )

    settings = _load_settings(
        tmp_path,
        environ={"BENTO_EMBEDDING_PROVIDER": "mock"},
    )

    assert settings.embeddings_provider == "mock"
    assert settings.data_dir == "./data"
    assert _check_settings_registry(settings).status == "pass"


def test_telegram_requirements_are_derived_without_echoing_secret_values() -> None:
    secret = "do-not-print-this-secret"
    settings = Settings(
        storage_backend="telegram",
        telegram_bot_token=secret,
        telegram_api_id="123",
        telegram_api_hash=secret,
        telegram_raw_chat_id="-1",
        telegram_thumbs_chat_id="-2",
        telegram_journal_chat_id="-3",
        telegram_webhook_secret="a" * 32,
        encryption_mode="aes_gcm",
        bento_encryption_key=base64.urlsafe_b64encode(b"k" * 32).decode().rstrip("="),
    )

    check = _check_telegram(settings)

    assert check.status == "pass"
    assert secret not in check.detail


def test_telegram_failure_names_alias_but_never_configured_secret() -> None:
    secret = "do-not-print-this-secret"
    settings = Settings(storage_backend="telegram", telegram_bot_token=secret)

    check = _check_telegram(settings)

    assert check.status == "fail"
    assert "TELEGRAM_API_ID" in check.detail
    assert secret not in check.detail


def test_validation_and_external_diagnostics_redact_secret_values() -> None:
    secret = "do-not-print-this-secret"
    with pytest.raises(ValidationError) as raised:
        Settings(telegram_bot_token=secret, worker_concurrency=99)

    assert _validation_detail(raised.value) == "invalid fields: worker_concurrency"
    assert secret not in _validation_detail(raised.value)
    assert _redact_secrets(f"compose failed near {secret}", Settings(telegram_bot_token=secret)) == (
        "compose failed near [REDACTED]"
    )
