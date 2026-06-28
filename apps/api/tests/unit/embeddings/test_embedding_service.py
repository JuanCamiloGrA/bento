from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from bento.adapters.embeddings import DisabledEmbeddingProvider, MockEmbeddingProvider
from bento.application.indexing.embedding import EmbeddingIndexingService
from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState
from bento.domain.indexing import EmbeddingRecord
from bento.domain.manifest import ManifestEntityType, ManifestEvent, ManifestEventType
from bento.domain.storage import BlobKind, BlobRef, StorageBackend

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_mock_provider_indexes_image_vector_manifest_and_state(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.IMAGE)
        assets = FakeAssets(asset)
        index = FakeVectorIndex()
        manifest = FakeManifest()
        service = service_for(
            tmp_path,
            asset,
            assets=assets,
            provider=MockEmbeddingProvider(dimensions=4),
            index=index,
            manifest=manifest,
        )

        record = await service.process_asset_embedding(asset.id)

        assert record is not None
        assert index.records == [record]
        assert len(index.vectors[0]) == 4
        assert assets.by_id[asset.id].processing_state == ProcessingState.INDEXED
        assert [event.type for event in manifest.events] == [ManifestEventType.EMBEDDING_INDEXED]

    asyncio.run(scenario())


def test_disabled_provider_completes_without_vector_or_manifest(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.IMAGE)
        assets = FakeAssets(asset)
        index = FakeVectorIndex()
        manifest = FakeManifest()
        service = service_for(
            tmp_path,
            asset,
            assets=assets,
            provider=DisabledEmbeddingProvider(),
            index=index,
            manifest=manifest,
        )

        assert await service.process_asset_embedding(asset.id) is None
        assert index.records == []
        assert manifest.events == []
        assert assets.by_id[asset.id].processing_state == ProcessingState.INDEXED

    asyncio.run(scenario())


def test_provider_failure_marks_partial_failure(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.IMAGE)
        assets = FakeAssets(asset)
        service = service_for(tmp_path, asset, assets=assets, provider=FailingEmbeddingProvider())

        with pytest.raises(RuntimeError, match="model unavailable"):
            await service.process_asset_embedding(asset.id)

        assert assets.by_id[asset.id].processing_state == ProcessingState.FAILED_PARTIAL

    asyncio.run(scenario())


def test_text_embedding_uses_text_catalog_before_metadata(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.PDF, filename="scan.pdf")
        provider = CapturingTextProvider()
        service = service_for(
            tmp_path,
            asset,
            assets=FakeAssets(asset),
            provider=provider,
            text_catalog=FakeTextCatalog("Contrato arrendamiento"),
        )

        await service.process_asset_embedding(asset.id)

        assert provider.texts == ["Contrato arrendamiento"]

    asyncio.run(scenario())


def service_for(
    tmp_path: Path,
    asset: Asset,
    *,
    assets: "FakeAssets",
    provider: Any,
    index: "FakeVectorIndex | None" = None,
    manifest: "FakeManifest | None" = None,
    text_catalog: Any | None = None,
) -> EmbeddingIndexingService:
    source = tmp_path / asset.filename
    source.write_bytes(b"source")
    blob = BlobRef(
        id="blob_1",
        asset_id=asset.id,
        backend=StorageBackend.LOCAL,
        kind=BlobKind.ORIGINAL,
        object_key=source.name,
        size_bytes=source.stat().st_size,
        sha256=asset.metadata.sha256,
    )
    return EmbeddingIndexingService(
        assets=assets,
        blob_refs=FakeBlobRefs(blob),
        resolver=FakeResolver(tmp_path),
        provider=provider,
        index=index or FakeVectorIndex(),
        manifest=manifest or FakeManifest(),
        clock=FakeClock(),
        text_catalog=text_catalog,
    )


def make_asset(kind: AssetKind, *, filename: str | None = None) -> Asset:
    chosen_filename = filename or ("photo.jpg" if kind == AssetKind.IMAGE else "receipt.pdf")
    return Asset(
        id=f"asset_{kind.value}",
        kind=kind,
        mode=AssetMode.PHOTOS if kind == AssetKind.IMAGE else AssetMode.DRIVE,
        folder_id=None,
        filename=chosen_filename,
        metadata=AssetMetadata(
            original_filename=chosen_filename,
            mime_type="image/jpeg" if kind == AssetKind.IMAGE else "application/pdf",
            size_bytes=10,
            sha256="a" * 64,
        ),
        processing_state=ProcessingState.THUMBNAIL_READY,
        favorite=False,
        created_at=NOW,
        updated_at=NOW,
    )


@dataclass
class FakeClock:
    def now(self) -> datetime:
        return NOW


@dataclass
class FakeAssets:
    asset: Asset
    saved: list[Asset] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.by_id = {self.asset.id: self.asset}

    async def next_id(self) -> str:
        return "asset_next"

    async def get(self, asset_id: str) -> Asset | None:
        return self.by_id.get(asset_id)

    async def get_by_sha256(self, sha256: str) -> Asset | None:
        del sha256
        return None

    async def add(self, asset: Asset) -> None:
        self.by_id[asset.id] = asset

    async def save(self, asset: Asset) -> None:
        self.by_id[asset.id] = asset
        self.saved.append(asset)

    async def list_photos_timeline(self, *, cursor: str | None = None, limit: int = 50) -> tuple[tuple[Any, ...], None]:
        del cursor, limit
        return (), None


@dataclass
class FakeBlobRefs:
    blob: BlobRef

    async def add(self, blob_ref: BlobRef) -> None:
        self.blob = blob_ref

    async def latest_for_asset(self, asset_id: str, kind: BlobKind) -> BlobRef | None:
        return self.blob if self.blob.asset_id == asset_id and self.blob.kind == kind else None


@dataclass
class FakeResolver:
    root: Path

    def resolve(self, blob_ref: BlobRef) -> Path:
        return self.root / blob_ref.object_key


@dataclass
class FakeVectorIndex:
    records: list[EmbeddingRecord] = field(default_factory=list)
    vectors: list[tuple[float, ...]] = field(default_factory=list)

    async def index_embedding_vector(self, record: EmbeddingRecord, vector: tuple[float, ...]) -> None:
        self.records.append(record)
        self.vectors.append(vector)


@dataclass
class FakeManifest:
    events: list[ManifestEvent] = field(default_factory=list)

    async def next_id(self) -> str:
        return f"event-{len(self.events) + 1}"

    async def append(
        self,
        *,
        type: ManifestEventType,
        entity_type: ManifestEntityType,
        entity_id: str,
        payload: dict[str, object],
    ) -> ManifestEvent:
        event = ManifestEvent(
            id=await self.next_id(),
            type=type,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
            created_at=NOW,
        )
        self.events.append(event)
        return event

    async def export_jsonl(self) -> None:
        return None


class FailingEmbeddingProvider:
    async def is_enabled(self) -> bool:
        return True

    async def embed_text(self, asset_id: str, text: str) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        del asset_id, text
        raise RuntimeError("model unavailable")

    async def embed_image(self, asset_id: str, image_path: Path) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        del asset_id, image_path
        raise RuntimeError("model unavailable")


@dataclass
class FakeTextCatalog:
    text: str | None

    async def text_for_asset(self, asset_id: str) -> str | None:
        del asset_id
        return self.text


@dataclass
class CapturingTextProvider:
    texts: list[str] = field(default_factory=list)

    async def is_enabled(self) -> bool:
        return True

    async def embed_text(self, asset_id: str, text: str) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        self.texts.append(text)
        return (
            EmbeddingRecord(
                id="emb_text",
                asset_id=asset_id,
                provider="capture",
                vector_ref="capture:text",
                dimensions=2,
            ),
            (1.0, 0.0),
        )

    async def embed_image(self, asset_id: str, image_path: Path) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        del asset_id, image_path
        raise AssertionError("image embedding was not expected")
