from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

from sqlalchemy import func, select

from bento.adapters.embeddings import MockEmbeddingProvider
from bento.adapters.manifest import SQLiteManifestJournal
from bento.adapters.media import LocalBlobPathResolver, SQLiteBlobRefCatalog
from bento.adapters.repositories import SQLiteAssetRepository
from bento.adapters.search.sqlite_vec import SQLiteVecSearchIndex
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.application.indexing.embedding import EmbeddingIndexingService
from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState
from bento.domain.manifest import ManifestEventType
from bento.domain.storage import BlobKind
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import AssetEmbeddingModel, ManifestEventModel

from tests.integration.db.support import FixedClock, NOW, migrated_session_factory


def test_embedding_job_persists_vector_metadata_manifest_and_state(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        clock = FixedClock()
        assets = SQLiteAssetRepository(factory)
        blob_refs = SQLiteBlobRefCatalog(factory, clock)
        source = tmp_path / "source-photo.jpg"
        source.write_bytes(b"image bytes")
        asset = _asset(source)
        await assets.add(asset)
        blob = await LocalBlobStoreAdapter(tmp_path / "uploads").store(
            str(source),
            asset_id=asset.id,
            kind=BlobKind.ORIGINAL,
            metadata=asset.metadata,
        )
        await blob_refs.add(blob)
        index = SQLiteVecSearchIndex(factory, clock, dimensions=3, prefer_sqlite_vec=False)
        service = EmbeddingIndexingService(
            assets=assets,
            blob_refs=blob_refs,
            resolver=LocalBlobPathResolver(tmp_path / "uploads"),
            provider=MockEmbeddingProvider(dimensions=3),
            index=index,
            manifest=SQLiteManifestJournal(factory, clock, tmp_path / "journal"),
            clock=clock,
        )

        record = await service.process_asset_embedding(asset.id)

        assert record is not None
        hits = await index.search_vectors((1.0, 0.0, 0.0), limit=10)
        assert asset.id in {hit.asset_id for hit in hits}
        assert (await assets.get(asset.id)).processing_state == ProcessingState.INDEXED
        with session_scope(factory) as session:
            assert session.scalar(select(func.count()).select_from(AssetEmbeddingModel)) == 1
            assert session.scalar(select(ManifestEventModel.type)) == ManifestEventType.EMBEDDING_INDEXED.value

    asyncio.run(scenario())


def _asset(source: Path) -> Asset:
    content = source.read_bytes()
    return Asset(
        id="asset_image",
        kind=AssetKind.IMAGE,
        mode=AssetMode.PHOTOS,
        folder_id=None,
        filename="source-photo.jpg",
        metadata=AssetMetadata(
            original_filename="source-photo.jpg",
            mime_type="image/jpeg",
            size_bytes=len(content),
            sha256=hashlib.sha256(content).hexdigest(),
        ),
        processing_state=ProcessingState.THUMBNAIL_READY,
        favorite=False,
        created_at=NOW,
        updated_at=NOW,
    )
