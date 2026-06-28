from __future__ import annotations

import json

from bento.domain.manifest import ManifestEntityType, ManifestEvent, ManifestEventType
from bento.infrastructure.telegram.client import TelegramApiClient, TelegramApiError
from bento.infrastructure.telegram.config import TelegramStorageConfig
from bento.infrastructure.telegram.retry import (
    TelegramRateLimiter,
    TelegramRetryPolicy,
    call_with_telegram_retries,
)
from bento.ports.manifest import ManifestJournalPort


class TelegramManifestJournal:
    def __init__(
        self,
        *,
        delegate: ManifestJournalPort,
        config: TelegramStorageConfig,
        client: TelegramApiClient,
        retry_policy: TelegramRetryPolicy | None = None,
        rate_limiter: TelegramRateLimiter | None = None,
    ) -> None:
        self._delegate = delegate
        self._config = config
        self._client = client
        self._retry_policy = retry_policy or TelegramRetryPolicy(
            max_attempts=config.max_attempts,
            base_delay_seconds=config.retry_base_delay_seconds,
        )
        self._rate_limiter = rate_limiter

    async def next_id(self) -> str:
        return await self._delegate.next_id()

    async def append(
        self,
        *,
        type: ManifestEventType,
        entity_type: ManifestEntityType,
        entity_id: str,
        payload: dict[str, object],
    ) -> ManifestEvent:
        event = await self._delegate.append(type=type, entity_type=entity_type, entity_id=entity_id, payload=payload)
        try:
            await call_with_telegram_retries(
                lambda: self._client.send_message(self._config.journal_chat_id, _event_json(event)),
                retry_policy=self._retry_policy,
                rate_limiter=self._rate_limiter,
            )
        except TelegramApiError:
            # SQLite remains the source of truth; a failed Telegram mirror must not roll back the event.
            pass
        return event

    async def export_jsonl(self) -> None:
        await self._delegate.export_jsonl()


def _event_json(event: ManifestEvent) -> str:
    return json.dumps(
        {
            "id": event.id,
            "type": event.type.value,
            "entity_type": event.entity_type.value,
            "entity_id": event.entity_id,
            "payload": _safe_payload(event.payload),
            "created_at": event.created_at.isoformat(),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def _safe_payload(payload: dict[str, object]) -> dict[str, object]:
    safe: dict[str, object] = {}
    for key, value in payload.items():
        if _should_redact_key(key):
            safe[key] = "[redacted]"
        elif isinstance(value, dict):
            safe[key] = _safe_payload(value)
        else:
            safe[key] = _json_safe(value)
    return safe


def _json_safe(value: object) -> object:
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    return str(value)


def _should_redact_key(key: str) -> bool:
    normalized = key.lower()
    return "token" in normalized or "secret" in normalized or normalized.endswith("api_hash")
