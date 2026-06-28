from __future__ import annotations

from typing import Protocol

from bento.domain.manifest import ManifestEntityType, ManifestEvent, ManifestEventType


class ManifestJournalPort(Protocol):
    async def next_id(self) -> str: ...

    async def append(
        self,
        *,
        type: ManifestEventType,
        entity_type: ManifestEntityType,
        entity_id: str,
        payload: dict[str, object],
    ) -> ManifestEvent: ...

    async def export_jsonl(self) -> None: ...
