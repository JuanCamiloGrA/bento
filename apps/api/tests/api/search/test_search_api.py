from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from bento.adapters.repositories import SQLiteAssetRepository
from bento.adapters.search.sqlite_fts import SQLiteFTSSearchIndex
from bento.infrastructure.db.clock import SystemClock
from bento.infrastructure.db.engine import create_session_factory, sqlite_url
from bento.infrastructure.settings import Settings
from bento.interfaces.http.main import create_app

from tests.integration.db.support import make_asset


def test_search_api_contract_shape(tmp_path: Path) -> None:
    data_dir = _migrated_data_dir(tmp_path)
    factory = create_session_factory(sqlite_url(data_dir / "db" / "bento.sqlite3"))
    asset = make_asset("asset_api", filename="factura-api.pdf")

    async def seed() -> None:
        assets = SQLiteAssetRepository(factory)
        index = SQLiteFTSSearchIndex(factory, SystemClock())
        await assets.add(asset)
        await index.index_asset(asset)

    asyncio.run(seed())

    client = TestClient(create_app(Settings(data_dir=str(data_dir))))
    response = client.get("/api/search", params={"q": "factura", "limit": "10"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["asset_id"] == asset.id
    assert body["items"][0]["title"] == "factura-api.pdf"
    assert body["items"][0]["reason"]
    assert body["items"][0]["processing_state"] == "indexed"
    assert body["facets"] == [{"type": "pdf_page", "count": 1}]
    assert body["next_cursor"] is None


def _migrated_data_dir(tmp_path: Path) -> Path:
    data_dir = tmp_path / "data"
    db_dir = data_dir / "db"
    db_dir.mkdir(parents=True)
    api_root = Path(__file__).parents[3]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    config.set_main_option("sqlalchemy.url", sqlite_url(db_dir / "bento.sqlite3"))
    command.upgrade(config, "head")
    return data_dir
