from fastapi.testclient import TestClient

from bento.infrastructure.settings import Settings
from bento.interfaces.http.main import create_app


def test_health_route_reports_local_mode() -> None:
    client = TestClient(create_app(Settings(storage_backend="local")))

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "storage_backend": "local",
        "telegram_configured": False,
    }
