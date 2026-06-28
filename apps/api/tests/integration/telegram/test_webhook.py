from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bento.application.ingestion import UploadedAssetFile
from bento.application.upload import UploadAssetResult
from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState
from bento.infrastructure.telegram.client import TelegramApiError, TelegramFileRef
from bento.interfaces.telegram.ingestion import TelegramWebhookIngestionService
from bento.interfaces.telegram.routes import router

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_webhook_ingests_shared_document_with_fake_file(tmp_path: Path) -> None:
    fake_ingestion = FakeIngestion()
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.state.telegram_webhook_ingestion = TelegramWebhookIngestionService(
        client=FakeTelegramFileClient(b"from telegram"),
        ingestion=fake_ingestion,  # type: ignore[arg-type]
        temp_dir=tmp_path,
    )
    client = TestClient(app)

    response = client.post(
        "/api/telegram/webhook",
        json={
            "update_id": 1,
            "message": {
                "message_id": 22,
                "chat": {"id": 33},
                "document": {
                    "file_id": "file-1",
                    "file_unique_id": "unique-1",
                    "file_name": "note.txt",
                    "mime_type": "text/plain",
                    "file_size": 13,
                },
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "accepted": True,
        "ignored": False,
        "asset_id": "asset-telegram",
        "duplicate": False,
    }
    assert fake_ingestion.uploaded == [("note.txt", "text/plain", b"from telegram")]


def test_webhook_ignores_updates_without_files(tmp_path: Path) -> None:
    fake_ingestion = FakeIngestion()
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.state.telegram_webhook_ingestion = TelegramWebhookIngestionService(
        client=FakeTelegramFileClient(b""),
        ingestion=fake_ingestion,  # type: ignore[arg-type]
        temp_dir=tmp_path,
    )
    client = TestClient(app)

    response = client.post("/api/telegram/webhook", json={"update_id": 1, "message": {"text": "hello"}})

    assert response.status_code == 200
    assert response.json() == {"accepted": True, "ignored": True, "asset_id": None, "duplicate": False}
    assert fake_ingestion.uploaded == []


def test_webhook_maps_telegram_download_failure_to_error_envelope(tmp_path: Path) -> None:
    fake_ingestion = FakeIngestion()
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.state.telegram_webhook_ingestion = TelegramWebhookIngestionService(
        client=FakeTelegramFileClient(
            b"",
            failure=TelegramApiError(status_code=503, error_code=503, description="Service unavailable"),
        ),
        ingestion=fake_ingestion,  # type: ignore[arg-type]
        temp_dir=tmp_path,
    )
    client = TestClient(app)

    response = client.post(
        "/api/telegram/webhook",
        json={
            "update_id": 1,
            "message": {
                "message_id": 22,
                "document": {"file_id": "file-1", "file_name": "note.txt"},
            },
        },
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "storage_unavailable"
    assert response.json()["error"]["details"] == {"backend": "telegram"}
    assert fake_ingestion.uploaded == []


@dataclass
class FakeTelegramFileClient:
    content: bytes
    failure: TelegramApiError | None = None

    async def get_file(self, file_id: str) -> TelegramFileRef:
        if self.failure is not None:
            raise self.failure
        return TelegramFileRef(file_id=file_id, file_unique_id="unique-1", file_size=len(self.content), file_path="remote/file")

    async def download_file(self, file_path: str, destination_path: Path) -> None:
        del file_path
        destination_path.write_bytes(self.content)


@dataclass
class FakeIngestion:
    uploaded: list[tuple[str, str | None, bytes]] = field(default_factory=list)

    async def upload_file(self, file: UploadedAssetFile) -> UploadAssetResult:
        content = file.source_path.read_bytes()
        self.uploaded.append((file.original_filename, file.declared_mime_type, content))
        asset = Asset(
            id="asset-telegram",
            kind=AssetKind.DOCUMENT,
            mode=AssetMode.DRIVE,
            folder_id=None,
            filename=file.original_filename,
            metadata=AssetMetadata(
                original_filename=file.original_filename,
                mime_type=file.declared_mime_type or "application/octet-stream",
                size_bytes=len(content),
                sha256="a" * 64,
            ),
            processing_state=ProcessingState.THUMBNAIL_PENDING,
            favorite=False,
            created_at=NOW,
            updated_at=NOW,
        )
        return UploadAssetResult(asset=asset, blob_ref=None, duplicate=False)
