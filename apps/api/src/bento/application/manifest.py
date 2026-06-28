from __future__ import annotations

from bento.ports.manifest import ManifestJournalPort


class ExportManifestUseCase:
    def __init__(self, *, manifest: ManifestJournalPort) -> None:
        self._manifest = manifest

    async def execute(self) -> None:
        await self._manifest.export_jsonl()
