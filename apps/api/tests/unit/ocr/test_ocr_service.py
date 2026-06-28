from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from bento.adapters.ocr import DisabledOCRAdapter
from bento.application.indexing import OCRIndexingService, PDFPageRender
from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState
from bento.domain.indexing import OCRBlock
from bento.domain.manifest import ManifestEntityType, ManifestEvent, ManifestEventType
from bento.domain.search import SearchResults
from bento.domain.storage import BlobKind, BlobRef, StorageBackend

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_mock_ocr_marks_ready_indexes_blocks_and_manifest_event(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.IMAGE)
        assets = FakeAssets(asset)
        provider = FakeOCRProvider((OCRBlock(id="ocr_1", asset_id=asset.id, text="Factura 123"),))
        index = FakeSearchIndex()
        manifest = FakeManifest()
        service = service_for(tmp_path, asset, assets=assets, provider=provider, index=index, manifest=manifest)

        blocks = await service.process_asset_ocr(asset.id)

        assert [block.text for block in blocks] == ["Factura 123"]
        assert index.blocks == list(blocks)
        assert assets.saved[-1].processing_state == ProcessingState.OCR_READY
        assert [event.type for event in manifest.events] == [ManifestEventType.OCR_INDEXED]

    asyncio.run(scenario())


def test_disabled_ocr_does_not_fail_asset_processing(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.IMAGE)
        assets = FakeAssets(asset)
        service = service_for(tmp_path, asset, assets=assets, provider=DisabledOCRAdapter())

        assert await service.process_asset_ocr(asset.id) == ()
        assert assets.saved[-1].processing_state == ProcessingState.OCR_READY

    asyncio.run(scenario())


def test_ocr_failure_marks_partial_failure_and_preserves_asset(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.IMAGE)
        assets = FakeAssets(asset)
        service = service_for(tmp_path, asset, assets=assets, provider=FailingOCRProvider())

        with pytest.raises(RuntimeError, match="ocr unavailable"):
            await service.process_asset_ocr(asset.id)

        assert assets.by_id[asset.id].processing_state == ProcessingState.FAILED_PARTIAL

    asyncio.run(scenario())


def test_pdf_page_ocr_uses_renderer_and_saves_page_text(tmp_path: Path) -> None:
    async def scenario() -> None:
        asset = make_asset(AssetKind.PDF)
        assets = FakeAssets(asset)
        page_1 = tmp_path / "page-1.png"
        page_2 = tmp_path / "page-2.png"
        page_1.write_bytes(b"page 1")
        page_2.write_bytes(b"page 2")
        provider = FakeOCRProvider(
            (
                OCRBlock(id="ocr_page", asset_id=asset.id, text="uno"),
                OCRBlock(id="ocr_page", asset_id=asset.id, text="dos"),
            )
        )
        pages = FakePDFPages()
        service = service_for(
            tmp_path,
            asset,
            assets=assets,
            provider=provider,
            pdf_renderer=FakePDFRenderer(
                (PDFPageRender(page_number=1, image_path=page_1), PDFPageRender(page_number=2, image_path=page_2))
            ),
            pdf_pages=pages,
        )

        blocks = await service.process_asset_ocr(asset.id)

        assert [block.page_number for block in blocks] == [1, 1, 2, 2]
        assert pages.items == [(asset.id, 1, "uno\ndos"), (asset.id, 2, "uno\ndos")]

    asyncio.run(scenario())


def service_for(
    tmp_path: Path,
    asset: Asset,
    *,
    assets: "FakeAssets",
    provider: Any,
    index: "FakeSearchIndex | None" = None,
    manifest: "FakeManifest | None" = None,
    pdf_renderer: Any | None = None,
    pdf_pages: Any | None = None,
) -> OCRIndexingService:
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
    return OCRIndexingService(
        assets=assets,
        blob_refs=FakeBlobRefs(blob),
        resolver=FakeResolver(tmp_path),
        provider=provider,
        index=index or FakeSearchIndex(),
        manifest=manifest or FakeManifest(),
        clock=FakeClock(),
        pdf_renderer=pdf_renderer,
        pdf_pages=pdf_pages,
    )


def make_asset(kind: AssetKind) -> Asset:
    filename = "scan.pdf" if kind == AssetKind.PDF else "photo.jpg"
    return Asset(
        id=f"asset_{kind.value}",
        kind=kind,
        mode=AssetMode.DRIVE if kind == AssetKind.PDF else AssetMode.PHOTOS,
        folder_id=None,
        filename=filename,
        metadata=AssetMetadata(
            original_filename=filename,
            mime_type="application/pdf" if kind == AssetKind.PDF else "image/jpeg",
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
        return None

    async def add(self, asset: Asset) -> None:
        self.by_id[asset.id] = asset

    async def save(self, asset: Asset) -> None:
        self.by_id[asset.id] = asset
        self.saved.append(asset)

    async def list_photos_timeline(self, *, cursor: str | None = None, limit: int = 50) -> tuple[tuple[Any, ...], None]:
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
class FakeOCRProvider:
    blocks: tuple[OCRBlock, ...]
    enabled: bool = True

    async def is_enabled(self) -> bool:
        return self.enabled

    async def extract_text(self, asset_id: str, source_ref: str) -> tuple[OCRBlock, ...]:
        del asset_id, source_ref
        return self.blocks


class FailingOCRProvider:
    async def is_enabled(self) -> bool:
        return True

    async def extract_text(self, asset_id: str, source_ref: str) -> tuple[OCRBlock, ...]:
        del asset_id, source_ref
        raise RuntimeError("ocr unavailable")


@dataclass
class FakeSearchIndex:
    blocks: list[OCRBlock] = field(default_factory=list)

    async def index_asset(self, asset: Asset) -> None:
        return None

    async def index_ocr(self, block: OCRBlock) -> None:
        self.blocks.append(block)

    async def index_embedding(self, record: Any) -> None:
        return None

    async def remove_asset(self, asset_id: str) -> None:
        return None

    async def search(self, query: Any) -> SearchResults:
        return SearchResults(items=(), facets=(), next_cursor=None)


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


@dataclass
class FakePDFRenderer:
    renders: tuple[PDFPageRender, ...]

    async def render_pages(self, *, asset_id: str, source_path: Path) -> tuple[PDFPageRender, ...]:
        del asset_id, source_path
        return self.renders


@dataclass
class FakePDFPages:
    items: list[tuple[str, int, str]] = field(default_factory=list)

    async def save_page_text(self, *, asset_id: str, page_number: int, text: str) -> None:
        self.items.append((asset_id, page_number, text))
