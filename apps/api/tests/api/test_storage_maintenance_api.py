from __future__ import annotations

from dataclasses import dataclass

from fastapi.testclient import TestClient

from bento.application.storage_maintenance import StorageMaintenanceStatus, StorageReclaimResult
from bento.infrastructure.settings import Settings
from bento.interfaces.http.main import create_app
from bento.interfaces.http.routes import StorageMaintenanceDependencies


def test_settings_reports_storage_safety_status(tmp_path) -> None:
    service = FakeStorageMaintenanceService()
    app = create_app(Settings(storage_backend="local", data_dir=str(tmp_path)))
    app.state.storage_maintenance_dependencies = StorageMaintenanceDependencies(service=service)

    response = TestClient(app).get("/api/settings")

    assert response.status_code == 200
    assert response.json()["storage_maintenance"] == {
        "connection_state": "connected",
        "can_reclaim": True,
        "fully_remote": True,
        "reclaimable_bytes": 2048,
        "reclaimable_files": 3,
        "local_blob_count": 0,
        "telegram_blob_count": 7,
    }


def test_reclaim_endpoint_returns_freed_cache_summary(tmp_path) -> None:
    service = FakeStorageMaintenanceService()
    app = create_app(Settings(storage_backend="local", data_dir=str(tmp_path)))
    app.state.storage_maintenance_dependencies = StorageMaintenanceDependencies(service=service)

    response = TestClient(app).post("/api/admin/storage/reclaim")

    assert response.status_code == 200
    assert response.json() == {
        "freed_bytes": 2048,
        "deleted_files": 3,
        "retained_bytes": 128,
        "retained_files": 1,
        "skipped_recent_files": 1,
    }
    assert service.reclaim_calls == 1


@dataclass
class FakeStorageMaintenanceService:
    reclaim_calls: int = 0

    async def status(self) -> StorageMaintenanceStatus:
        return StorageMaintenanceStatus(
            connection_state="connected",
            can_reclaim=True,
            fully_remote=True,
            reclaimable_bytes=2048,
            reclaimable_files=3,
            local_blob_count=0,
            telegram_blob_count=7,
        )

    async def reclaim(self) -> StorageReclaimResult:
        self.reclaim_calls += 1
        return StorageReclaimResult(
            freed_bytes=2048,
            deleted_files=3,
            retained_bytes=128,
            retained_files=1,
            skipped_recent_files=1,
        )
