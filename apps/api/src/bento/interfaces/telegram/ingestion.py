from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Protocol

from bento.application.ingestion import AssetIngestionService, UploadedAssetFile
from bento.domain.errors import StorageUnavailableError
from bento.domain.storage import StorageBackend
from bento.infrastructure.telegram.client import TelegramApiError, TelegramFileRef
from bento.interfaces.telegram.updates import TelegramSharedFile, extract_shared_file


class TelegramFileClient(Protocol):
    async def get_file(self, file_id: str) -> TelegramFileRef: ...

    async def download_file(self, file_path: str, destination_path: Path) -> None: ...


@dataclass(frozen=True, slots=True)
class TelegramWebhookResult:
    accepted: bool
    ignored: bool
    asset_id: str | None = None
    duplicate: bool = False


class TelegramWebhookIngestionService:
    def __init__(
        self,
        *,
        client: TelegramFileClient,
        ingestion: AssetIngestionService,
        temp_dir: Path | str,
    ) -> None:
        self._client = client
        self._ingestion = ingestion
        self._temp_dir = Path(temp_dir)

    async def ingest_update(self, update: Mapping[str, Any]) -> TelegramWebhookResult:
        shared_file = extract_shared_file(update)
        if shared_file is None:
            return TelegramWebhookResult(accepted=True, ignored=True)
        result = await self._ingest_shared_file(shared_file)
        return TelegramWebhookResult(accepted=True, ignored=False, asset_id=result.asset.id, duplicate=result.duplicate)

    async def _ingest_shared_file(self, shared_file: TelegramSharedFile):
        self._temp_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(shared_file.filename).suffix
        with tempfile.NamedTemporaryFile(prefix="telegram-", suffix=suffix, dir=self._temp_dir, delete=False) as handle:
            temp_path = Path(handle.name)
        try:
            try:
                file_ref = await self._client.get_file(shared_file.file_id)
                await self._client.download_file(file_ref.file_path, temp_path)
            except TelegramApiError as exc:
                raise StorageUnavailableError(StorageBackend.TELEGRAM.value) from exc
            return await self._ingestion.upload_file(
                UploadedAssetFile(
                    source_path=temp_path,
                    original_filename=shared_file.filename,
                    declared_mime_type=shared_file.mime_type,
                )
            )
        finally:
            temp_path.unlink(missing_ok=True)
