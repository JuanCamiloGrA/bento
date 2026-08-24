from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

from sqlalchemy import func, select

from bento.adapters.jobs import SQLiteJobQueue
from bento.adapters.manifest import SQLiteManifestJournal
from bento.adapters.media import BlobSourceMaterializer, LocalBlobPathResolver, SQLiteBlobRefCatalog, SQLiteThumbnailCatalog
from bento.adapters.repositories import SQLiteAssetRepository
from bento.adapters.storage.local_blob_store import LocalBlobStoreAdapter
from bento.application.media import MediaProcessingService
from bento.application.media.service import GeneratedMediaFile
from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState
from bento.domain.jobs import JobStatus, JobType
from bento.domain.storage import BlobKind, BlobRef, StorageBackend
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import BlobRefModel, ManifestEventModel, ThumbnailModel
from bento.interfaces.worker.dispatch import WorkerDispatcher

from tests.integration.db.support import FixedClock, NOW, migrated_session_factory


def test_thumbnail_job_creates_blob_thumbnail_records_and_files(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        clock = FixedClock()
        service, assets, blob_refs = await _media_service(tmp_path, factory, clock)
        asset = await _create_original_asset(
            tmp_path,
            assets,
            blob_refs,
            kind=AssetKind.IMAGE,
            filename="photo.jpg",
            content=b"original image bytes",
        )

        stored = await service.process_asset_media(asset.id)

        assert len(stored) == 2
        assert {blob.kind for blob in stored} == {BlobKind.THUMBNAIL, BlobKind.PREVIEW}
        assert (tmp_path / "uploads" / stored[0].object_key).is_file()
        assert not (tmp_path / "generated" / asset.id).exists()
        assert (await assets.get(asset.id)).processing_state == ProcessingState.THUMBNAIL_READY
        with session_scope(factory) as session:
            assert session.scalar(select(func.count()).select_from(BlobRefModel)) == 3
            assert session.scalar(select(func.count()).select_from(ThumbnailModel)) == 1
            assert session.scalar(select(func.count()).select_from(ManifestEventModel)) == 2

    asyncio.run(scenario())


def test_pdf_and_video_thumbnail_worker_handlers_use_media_service_with_fakes(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        clock = FixedClock()
        service, assets, blob_refs = await _media_service(tmp_path, factory, clock)
        pdf = await _create_original_asset(
            tmp_path,
            assets,
            blob_refs,
            kind=AssetKind.PDF,
            filename="scan.pdf",
            content=b"%PDF-1.4\n",
        )
        video = await _create_original_asset(
            tmp_path,
            assets,
            blob_refs,
            kind=AssetKind.VIDEO,
            filename="clip.mp4",
            content=b"\x00\x00\x00\x18ftypmp42",
        )
        jobs = SQLiteJobQueue(factory, clock)
        pdf_job = await jobs.enqueue(type=JobType.PDF_THUMBNAIL, priority=1, payload={}, asset_id=pdf.id)
        video_job = await jobs.enqueue(type=JobType.VIDEO_THUMBNAIL, priority=1, payload={}, asset_id=video.id)
        dispatcher = WorkerDispatcher(jobs=jobs, media=service, clock=clock, worker_id="worker-test")

        assert await dispatcher.process_one() is True
        assert await dispatcher.process_one() is True

        assert (await jobs.get(pdf_job.id)).status == JobStatus.SUCCEEDED
        assert (await jobs.get(video_job.id)).status == JobStatus.SUCCEEDED
        assert (await assets.get(pdf.id)).processing_state == ProcessingState.THUMBNAIL_READY
        assert (await assets.get(video.id)).processing_state == ProcessingState.THUMBNAIL_READY

    asyncio.run(scenario())


def test_unsupported_thumbnail_job_completes_without_media_generation(tmp_path: Path) -> None:
    async def scenario() -> None:
        factory = migrated_session_factory(tmp_path)
        clock = FixedClock()
        service, assets, blob_refs = await _media_service(tmp_path, factory, clock)
        asset = await _create_original_asset(
            tmp_path,
            assets,
            blob_refs,
            kind=AssetKind.DOCUMENT,
            filename="note.txt",
            content=b"plain text",
        )
        jobs = SQLiteJobQueue(factory, clock)
        job = await jobs.enqueue(type=JobType.THUMBNAIL, priority=1, payload={}, asset_id=asset.id)
        dispatcher = WorkerDispatcher(jobs=jobs, media=service, clock=clock, worker_id="worker-test")

        assert await dispatcher.process_one() is True

        assert (await jobs.get(job.id)).status == JobStatus.SUCCEEDED
        assert (await assets.get(asset.id)).processing_state == ProcessingState.THUMBNAIL_PENDING

    asyncio.run(scenario())


def test_remote_source_materializer_downloads_and_cleans_plaintext(tmp_path: Path) -> None:
    async def scenario() -> None:
        storage = RecordingDownloadStore(b"remote image")
        materializer = BlobSourceMaterializer(
            blob_store=storage,
            local_resolver=LocalBlobPathResolver(tmp_path / "uploads"),
            temp_dir=tmp_path / "worker-sources",
        )
        blob_ref = BlobRef(
            id="telegram_original_remote",
            asset_id="asset_remote",
            backend=StorageBackend.TELEGRAM,
            kind=BlobKind.ORIGINAL,
            object_key="telegram/original/remote",
            size_bytes=12,
            file_id="file_remote",
        )

        async with materializer.materialize(blob_ref) as source_path:
            assert source_path.read_bytes() == b"remote image"
            materialized_path = source_path

        assert storage.downloaded_blob == blob_ref
        assert not materialized_path.exists()

    asyncio.run(scenario())


async def _media_service(tmp_path: Path, factory, clock: FixedClock):
    assets = SQLiteAssetRepository(factory)
    blob_refs = SQLiteBlobRefCatalog(factory, clock)
    thumbnails = SQLiteThumbnailCatalog(factory, clock, blob_refs)
    storage = LocalBlobStoreAdapter(tmp_path / "uploads")
    manifest = SQLiteManifestJournal(factory, clock, tmp_path / "journal")
    service = MediaProcessingService(
        assets=assets,
        blob_refs=blob_refs,
        thumbnails=thumbnails,
        blob_store=storage,
        materializer=BlobSourceMaterializer(
            blob_store=storage,
            local_resolver=LocalBlobPathResolver(tmp_path / "uploads"),
            temp_dir=tmp_path / "worker-sources",
        ),
        generator=FakeMediaGenerator(tmp_path / "generated"),
        manifest=manifest,
        clock=clock,
    )
    return service, assets, blob_refs


async def _create_original_asset(
    tmp_path: Path,
    assets: SQLiteAssetRepository,
    blob_refs: SQLiteBlobRefCatalog,
    *,
    kind: AssetKind,
    filename: str,
    content: bytes,
) -> Asset:
    source = tmp_path / f"{filename}.source"
    source.write_bytes(content)
    sha256 = hashlib.sha256(content).hexdigest()
    mime_type = {
        AssetKind.IMAGE: "image/jpeg",
        AssetKind.PDF: "application/pdf",
        AssetKind.VIDEO: "video/mp4",
        AssetKind.DOCUMENT: "text/plain",
    }[kind]
    asset = Asset(
        id=f"asset_{kind.value}_{sha256[:8]}",
        kind=kind,
        mode=AssetMode.PHOTOS if kind in {AssetKind.IMAGE, AssetKind.VIDEO} else AssetMode.DRIVE,
        folder_id=None,
        filename=filename,
        metadata=AssetMetadata(
            original_filename=filename,
            mime_type=mime_type,
            size_bytes=len(content),
            sha256=sha256,
        ),
        processing_state=ProcessingState.THUMBNAIL_PENDING,
        favorite=False,
        created_at=NOW,
        updated_at=NOW,
    )
    await assets.add(asset)
    blob_ref = await LocalBlobStoreAdapter(tmp_path / "uploads").store(
        str(source),
        asset_id=asset.id,
        kind=BlobKind.ORIGINAL,
        metadata=asset.metadata,
    )
    await blob_refs.add(blob_ref)
    return asset


class FakeMediaGenerator:
    def __init__(self, root: Path) -> None:
        self._root = root

    async def generate(self, asset: Asset, source_path: Path) -> tuple[GeneratedMediaFile, ...]:
        del source_path
        target_dir = self._root / asset.id
        target_dir.mkdir(parents=True, exist_ok=True)
        thumb = target_dir / "thumb.jpg"
        preview = target_dir / "preview.jpg"
        thumb.write_bytes(f"thumb:{asset.id}".encode())
        preview.write_bytes(f"preview:{asset.id}".encode())
        return (
            _generated(thumb, BlobKind.THUMBNAIL, f"{asset.id}-thumb.jpg"),
            _generated(preview, BlobKind.PREVIEW, f"{asset.id}-preview.jpg"),
        )

    async def cleanup(self, generated_files: tuple[GeneratedMediaFile, ...]) -> None:
        for generated in generated_files:
            generated.path.unlink(missing_ok=True)
        for parent in {generated.path.parent for generated in generated_files}:
            parent.rmdir()


class RecordingDownloadStore:
    def __init__(self, content: bytes) -> None:
        self._content = content
        self.downloaded_blob: BlobRef | None = None

    async def download(self, blob_ref: BlobRef, destination_path: Path | str) -> Path:
        self.downloaded_blob = blob_ref
        destination = Path(destination_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(self._content)
        return destination


def _generated(path: Path, kind: BlobKind, filename: str) -> GeneratedMediaFile:
    content = path.read_bytes()
    return GeneratedMediaFile(
        path=path,
        kind=kind,
        filename=filename,
        mime_type="image/jpeg",
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        width=256,
        height=128,
    )
