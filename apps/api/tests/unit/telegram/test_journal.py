from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime

from bento.domain.manifest import ManifestEntityType, ManifestEvent, ManifestEventType
from bento.infrastructure.telegram.client import TelegramSentMessage
from bento.infrastructure.telegram.config import TelegramStorageConfig
from bento.infrastructure.telegram.journal import TelegramManifestJournal

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_telegram_manifest_journal_mirrors_safe_event_payload() -> None:
    async def scenario() -> None:
        delegate = FakeManifestJournal()
        client = FakeTelegramMessageClient()
        journal = TelegramManifestJournal(delegate=delegate, config=_config(), client=client)  # type: ignore[arg-type]

        event = await journal.append(
            type=ManifestEventType.BLOB_STORED,
            entity_type=ManifestEntityType.BLOB,
            entity_id="blob-1",
            payload={
                "filename": "note.txt",
                "token": "secret",
                "telegram_bot_token": "secret",
                "nested": {"TELEGRAM_API_HASH": "hash", "chat_secret": "secret"},
            },
        )

        assert event.id == "event-1"
        mirrored = json.loads(client.messages[0][1])
        assert client.messages[0][0] == "-100journal"
        assert mirrored["payload"] == {
            "filename": "note.txt",
            "token": "[redacted]",
            "telegram_bot_token": "[redacted]",
            "nested": {"TELEGRAM_API_HASH": "[redacted]", "chat_secret": "[redacted]"},
        }

    asyncio.run(scenario())


@dataclass
class FakeManifestJournal:
    events: list[ManifestEvent] = field(default_factory=list)

    async def next_id(self) -> str:
        return f"event-{len(self.events) + 1}"

    async def append(
        self,
        *,
        type: ManifestEventType,
        entity_type: ManifestEntityType,
        entity_id: str,
        payload: dict[str, object],
    ) -> ManifestEvent:
        event = ManifestEvent(
            id=await self.next_id(),
            type=type,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
            created_at=NOW,
        )
        self.events.append(event)
        return event

    async def export_jsonl(self) -> None:
        return None


@dataclass
class FakeTelegramMessageClient:
    messages: list[tuple[str, str]] = field(default_factory=list)

    async def send_message(self, chat_id: str, text: str) -> TelegramSentMessage:
        self.messages.append((chat_id, text))
        return TelegramSentMessage(chat_id=chat_id, message_id="message-1")


def _config() -> TelegramStorageConfig:
    return TelegramStorageConfig(
        bot_api_url="http://telegram-bot-api:8081",
        bot_token="123:test",
        api_id="42",
        api_hash="hash",
        raw_chat_id="-100raw",
        thumbs_chat_id="-100thumbs",
        journal_chat_id="-100journal",
        min_interval_seconds=0,
    )
