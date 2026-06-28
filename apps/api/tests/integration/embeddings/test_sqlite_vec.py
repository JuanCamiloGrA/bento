from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import func, select

from bento.adapters.repositories import SQLiteAssetRepository
from bento.adapters.search.sqlite_vec import SQLiteVecSearchIndex
from bento.domain.indexing import EmbeddingRecord
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import AssetEmbeddingModel

from tests.integration.db.support import FixedClock, migrated_session_factory, make_asset


def test_sqlite_vec_fallback_inserts_metadata_and_searches_nearest_vector(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        assets = SQLiteAssetRepository(factory)
        await assets.add(make_asset("asset_1", filename="first.jpg"))
        await assets.add(make_asset("asset_2", filename="second.jpg", sha256="b" * 64))
        index = SQLiteVecSearchIndex(factory, FixedClock(), dimensions=3, prefer_sqlite_vec=False)

        await index.index_embedding_vector(_record("emb_1", "asset_1"), (1.0, 0.0, 0.0))
        await index.index_embedding_vector(_record("emb_2", "asset_2"), (0.0, 1.0, 0.0))
        hits = await index.search_vectors((0.9, 0.1, 0.0), limit=2, provider="mock")

        assert [hit.asset_id for hit in hits] == ["asset_1", "asset_2"]
        assert hits[0].score > hits[1].score
        with session_scope(factory) as session:
            assert session.scalar(select(func.count()).select_from(AssetEmbeddingModel)) == 2

        await index.remove_asset("asset_1")
        assert [hit.asset_id for hit in await index.search_vectors((1.0, 0.0, 0.0), limit=2)] == ["asset_2"]

    asyncio.run(scenario())


def _record(record_id: str, asset_id: str) -> EmbeddingRecord:
    return EmbeddingRecord(
        id=record_id,
        asset_id=asset_id,
        provider="mock",
        vector_ref=f"mock:{record_id}",
        dimensions=3,
    )
