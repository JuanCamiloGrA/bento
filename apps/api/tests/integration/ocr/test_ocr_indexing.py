from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

from sqlalchemy import func, select

from bento.adapters.manifest import SQLiteManifestJournal
from bento.adapters.media import LocalBlobPathResolver, SQLiteBlobRefCatalog
from bento.adapters.ocr import MockOCRAdapter, SQLitePDFPageTextCatalog
from bento.adapters.repositories import SQLiteAssetRepository
from bento.adapters.search.sqlite_fts import SQLiteFTSSearchIndex
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.application.indexing import OCRIndexingService, PDFPageRender
from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState
from bento.domain.manifest import ManifestEventType
from bento.domain.search import SearchQuery, SearchResultType
from bento.domain.storage import BlobKind
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import AssetTextModel, ManifestEventModel, OCRBlockModel, PDFPageModel

from tests.integration.db.support import FixedClock, NOW, migrated_session_factory


def test_mock_ocr_persists_text_blocks_manifest_and_fts_search(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        clock = FixedClock()
        assets = SQLiteAssetRepository(factory)
        blob_refs = SQLiteBlobRefCatalog(factory, clock)
        source = tmp_path / "source-photo.jpg"
        source.write_bytes(b"image bytes")
        asset = _asset(source, kind=AssetKind.IMAGE, filename="photo.jpg")
        await assets.add(asset)
        blob = await LocalBlobStoreAdapter(tmp_path / "uploads").store(
            str(source),
            asset_id=asset.id,
            kind=BlobKind.ORIGINAL,
            metadata=asset.metadata,
        )
        await blob_refs.add(blob)
        index = SQLiteFTSSearchIndex(factory, clock)
        service = OCRIndexingService(
            assets=assets,
            blob_refs=blob_refs,
            resolver=LocalBlobPathResolver(tmp_path / "uploads"),
            provider=MockOCRAdapter(default_text="Numero de pasaporte ABC123"),
            index=index,
            manifest=SQLiteManifestJournal(factory, clock, tmp_path / "journal"),
            clock=clock,
        )

        await service.process_asset_ocr(asset.id)

        results = await index.search(SearchQuery(text="pasaporte", result_type=SearchResultType.PHOTO))
        assert [hit.asset_id for hit in results.items] == [asset.id]
        assert (await assets.get(asset.id)).processing_state == ProcessingState.OCR_READY
        with session_scope(factory) as session:
            assert session.scalar(select(func.count()).select_from(OCRBlockModel)) == 1
            assert session.scalar(select(func.count()).select_from(AssetTextModel)) == 1
            assert session.scalar(select(ManifestEventModel.type)) == ManifestEventType.OCR_INDEXED.value

    asyncio.run(scenario())


def test_pdf_page_ocr_persists_pdf_page_text_and_is_searchable(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        clock = FixedClock()
        assets = SQLiteAssetRepository(factory)
        blob_refs = SQLiteBlobRefCatalog(factory, clock)
        source = tmp_path / "source-scan.pdf"
        source.write_bytes(b"%PDF-1.4\n")
        page_image = tmp_path / "page-1.png"
        page_image.write_bytes(b"rendered page")
        asset = _asset(source, kind=AssetKind.PDF, filename="scan.pdf")
        await assets.add(asset)
        blob = await LocalBlobStoreAdapter(tmp_path / "uploads").store(
            str(source),
            asset_id=asset.id,
            kind=BlobKind.ORIGINAL,
            metadata=asset.metadata,
        )
        await blob_refs.add(blob)
        index = SQLiteFTSSearchIndex(factory, clock)
        service = OCRIndexingService(
            assets=assets,
            blob_refs=blob_refs,
            resolver=LocalBlobPathResolver(tmp_path / "uploads"),
            provider=MockOCRAdapter(default_text="Contrato arrendamiento"),
            index=index,
            manifest=SQLiteManifestJournal(factory, clock, tmp_path / "journal"),
            clock=clock,
            pdf_renderer=FakePDFRenderer((PDFPageRender(page_number=1, image_path=page_image),)),
            pdf_pages=SQLitePDFPageTextCatalog(factory, clock),
        )

        await service.process_asset_ocr(asset.id)

        results = await index.search(SearchQuery(text="arrendamiento", result_type=SearchResultType.PDF_PAGE))
        assert [hit.asset_id for hit in results.items] == [asset.id]
        with session_scope(factory) as session:
            assert session.scalar(select(PDFPageModel.text)) == "Contrato arrendamiento"

    asyncio.run(scenario())


def _asset(source: Path, *, kind: AssetKind, filename: str) -> Asset:
    content = source.read_bytes()
    mime_type = "application/pdf" if kind == AssetKind.PDF else "image/jpeg"
    return Asset(
        id=f"asset_{kind.value}",
        kind=kind,
        mode=AssetMode.DRIVE if kind == AssetKind.PDF else AssetMode.PHOTOS,
        folder_id=None,
        filename=filename,
        metadata=AssetMetadata(
            original_filename=filename,
            mime_type=mime_type,
            size_bytes=len(content),
            sha256=hashlib.sha256(content).hexdigest(),
        ),
        processing_state=ProcessingState.THUMBNAIL_READY,
        favorite=False,
        created_at=NOW,
        updated_at=NOW,
    )


class FakePDFRenderer:
    def __init__(self, renders: tuple[PDFPageRender, ...]) -> None:
        self._renders = renders

    async def render_pages(self, *, asset_id: str, source_path: Path) -> tuple[PDFPageRender, ...]:
        del asset_id, source_path
        return self._renders
