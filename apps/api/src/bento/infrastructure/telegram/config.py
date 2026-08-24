from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from bento.domain.errors import TelegramNotConfiguredError, ValidationFailedError
from bento.domain.storage import BlobKind


@dataclass(frozen=True, slots=True)
class TelegramStorageConfig:
    bot_api_url: str
    bot_token: str = field(repr=False)
    api_id: str = field(repr=False)
    api_hash: str = field(repr=False)
    webhook_secret: str = field(repr=False)
    raw_chat_id: str
    thumbs_chat_id: str
    journal_chat_id: str
    request_timeout_seconds: float = 30.0
    min_interval_seconds: float = 0.05
    max_attempts: int = 3
    retry_base_delay_seconds: float = 0.25

    def __post_init__(self) -> None:
        required = {
            "TELEGRAM_BOT_API_URL": self.bot_api_url,
            "TELEGRAM_BOT_TOKEN": self.bot_token,
            "TELEGRAM_API_ID": self.api_id,
            "TELEGRAM_API_HASH": self.api_hash,
            "TELEGRAM_WEBHOOK_SECRET": self.webhook_secret,
            "TELEGRAM_RAW_CHAT_ID": self.raw_chat_id,
            "TELEGRAM_THUMBS_CHAT_ID": self.thumbs_chat_id,
            "TELEGRAM_JOURNAL_CHAT_ID": self.journal_chat_id,
        }
        if any(not _present(value) for value in required.values()):
            raise TelegramNotConfiguredError()
        if re.fullmatch(r"[A-Za-z0-9_-]{32,256}", self.webhook_secret) is None:
            raise ValidationFailedError("Telegram webhook secret must contain 32-256 URL-safe characters")
        if self.request_timeout_seconds <= 0:
            raise ValidationFailedError("Telegram request timeout must be positive")
        if self.min_interval_seconds < 0:
            raise ValidationFailedError("Telegram rate limit interval cannot be negative")
        if self.max_attempts < 1:
            raise ValidationFailedError("Telegram retry attempts must be at least one")
        if self.retry_base_delay_seconds < 0:
            raise ValidationFailedError("Telegram retry delay cannot be negative")

    @property
    def normalized_bot_api_url(self) -> str:
        return self.bot_api_url.rstrip("/")

    def chat_id_for_kind(self, kind: BlobKind) -> str:
        if kind == BlobKind.JOURNAL:
            return self.journal_chat_id
        if kind in {BlobKind.THUMBNAIL, BlobKind.PREVIEW}:
            return self.thumbs_chat_id
        return self.raw_chat_id


def load_telegram_storage_config(
    settings: Any,
    environ: Mapping[str, str] | None = None,
) -> TelegramStorageConfig | None:
    if getattr(settings, "storage_backend", "local") != "telegram":
        return None
    return require_telegram_storage_config(settings, environ)


def require_telegram_storage_config(
    settings: Any,
    environ: Mapping[str, str] | None = None,
) -> TelegramStorageConfig:
    env = environ if environ is not None else os.environ
    return TelegramStorageConfig(
        bot_api_url=_setting_or_env(settings, env, "telegram_bot_api_url", "TELEGRAM_BOT_API_URL")
        or "http://telegram-bot-api:8081",
        bot_token=_setting_or_env(settings, env, "telegram_bot_token", "TELEGRAM_BOT_TOKEN") or "",
        api_id=_setting_or_env(settings, env, "telegram_api_id", "TELEGRAM_API_ID") or "",
        api_hash=_setting_or_env(settings, env, "telegram_api_hash", "TELEGRAM_API_HASH") or "",
        webhook_secret=_setting_or_env(settings, env, "telegram_webhook_secret", "TELEGRAM_WEBHOOK_SECRET") or "",
        raw_chat_id=_setting_or_env(settings, env, "telegram_raw_chat_id", "TELEGRAM_RAW_CHAT_ID") or "",
        thumbs_chat_id=_setting_or_env(settings, env, "telegram_thumbs_chat_id", "TELEGRAM_THUMBS_CHAT_ID") or "",
        journal_chat_id=_setting_or_env(settings, env, "telegram_journal_chat_id", "TELEGRAM_JOURNAL_CHAT_ID") or "",
        request_timeout_seconds=float(
            _setting_or_env(settings, env, "telegram_request_timeout_seconds", "TELEGRAM_REQUEST_TIMEOUT_SECONDS")
            or "30"
        ),
        min_interval_seconds=float(
            _setting_or_env(settings, env, "telegram_min_interval_seconds", "TELEGRAM_MIN_INTERVAL_SECONDS") or "0.05"
        ),
        max_attempts=int(_setting_or_env(settings, env, "telegram_max_attempts", "TELEGRAM_MAX_ATTEMPTS") or "3"),
        retry_base_delay_seconds=float(
            _setting_or_env(
                settings,
                env,
                "telegram_retry_base_delay_seconds",
                "TELEGRAM_RETRY_BASE_DELAY_SECONDS",
            )
            or "0.25"
        ),
    )


def _setting_or_env(settings: Any, env: Mapping[str, str], setting_name: str, env_name: str) -> str | None:
    value = getattr(settings, setting_name, None)
    if _present(value):
        return str(value).strip()
    env_value = env.get(env_name)
    if _present(env_value):
        return str(env_value).strip()
    return None


def _present(value: object) -> bool:
    return value is not None and str(value).strip() != ""
