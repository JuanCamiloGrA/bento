from __future__ import annotations

import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config

from bento.infrastructure.db.engine import sqlite_url


def test_initial_migration_creates_expected_sqlite_tables(tmp_path: Path) -> None:
    db_path = tmp_path / "migration.sqlite3"
    api_root = Path(__file__).parents[3]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    config.set_main_option("sqlalchemy.url", sqlite_url(db_path))

    command.upgrade(config, "head")

    connection = sqlite3.connect(db_path)
    try:
        names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
            )
        }
        assert {
            "assets",
            "folders",
            "albums",
            "album_assets",
            "blob_refs",
            "thumbnails",
            "asset_text",
            "asset_embeddings",
            "pdf_pages",
            "ocr_blocks",
            "jobs",
            "manifest_events",
            "settings",
            "asset_fts",
        }.issubset(names)

        embedding_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(asset_embeddings)")
        }
        assert {"provider", "vector_ref", "dimensions"}.issubset(embedding_columns)

        connection.execute(
            "INSERT INTO asset_fts(asset_id, title, text, metadata) VALUES (?, ?, ?, ?)",
            ("asset_1", "receipt.pdf", "coffee receipt", "application/pdf"),
        )
        assert connection.execute(
            "SELECT asset_id FROM asset_fts WHERE asset_fts MATCH ?",
            ("coffee",),
        ).fetchone() == ("asset_1",)
    finally:
        connection.close()
