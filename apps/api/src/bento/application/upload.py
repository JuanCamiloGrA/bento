from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from bento.domain.assets import Asset, AssetKind, AssetMetadata, AssetMode, ProcessingState, infer_asset_kind, infer_asset_mode
from bento.domain.errors import DuplicateAssetError, FolderNotFoundError, UploadTooLargeError
from bento.domain.jobs import JobPriority, JobType
from bento.domain.manifest import ManifestEntityType, ManifestEventType
from bento.domain.storage import BlobKind, BlobRef
from bento.ports.blob_store import BlobStorePort
from bento.ports.jobs import JobQueuePort
from bento.ports.manifest import ManifestJournalPort
from bento.ports.repositories import AssetRepositoryPort, ClockPort, FolderRepositoryPort


@dataclass(frozen=True, slots=True)
class UploadAssetCommand:
    source_ref: str
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    folder_id: str | None = None
    mode: AssetMode | None = None
    taken_at: datetime | None = None
    exif: dict[str, object] | None = None
    allow_duplicate: bool = True
    ocr_enabled: bool = True
    embeddings_enabled: bool = True
    max_size_bytes: int | None = None


@dataclass(frozen=True, slots=True)
class UploadAssetResult:
    asset: Asset
    blob_ref: BlobRef | None
    duplicate: bool


class UploadAssetUseCase:
    def __init__(
        self,
        *,
        assets: AssetRepositoryPort,
        folders: FolderRepositoryPort,
        blob_store: BlobStorePort,
        jobs: JobQueuePort,
        manifest: ManifestJournalPort,
        clock: ClockPort,
    ) -> None:
        self._assets = assets
        self._folders = folders
        self._blob_store = blob_store
        self._jobs = jobs
        self._manifest = manifest
        self._clock = clock

    async def execute(self, command: UploadAssetCommand) -> UploadAssetResult:
        if command.max_size_bytes is not None and command.size_bytes > command.max_size_bytes:
            raise UploadTooLargeError(command.size_bytes, command.max_size_bytes)

        existing = await self._assets.get_by_sha256(command.sha256)
        if existing is not None and not existing.is_deleted:
            if command.allow_duplicate:
                return UploadAssetResult(asset=existing, blob_ref=None, duplicate=True)
            raise DuplicateAssetError(command.sha256)

        if command.folder_id is not None and await self._folders.get(command.folder_id) is None:
            raise FolderNotFoundError(command.folder_id)

        now = self._clock.now()
        asset_id = await self._assets.next_id()
        kind = infer_asset_kind(command.mime_type)
        mode = command.mode or infer_asset_mode(kind)
        metadata = AssetMetadata(
            original_filename=command.original_filename,
            mime_type=command.mime_type,
            size_bytes=command.size_bytes,
            sha256=command.sha256,
            taken_at=command.taken_at,
            exif=command.exif,
        )
        blob_ref = await self._blob_store.store(
            command.source_ref,
            asset_id=asset_id,
            kind=BlobKind.ORIGINAL,
            metadata=metadata,
        )
        asset = Asset(
            id=asset_id,
            kind=kind,
            mode=mode,
            folder_id=command.folder_id,
            filename=command.original_filename,
            metadata=metadata,
            processing_state=ProcessingState.BLOB_STORED,
            favorite=False,
            created_at=now,
            updated_at=now,
        ).transition_to(ProcessingState.THUMBNAIL_PENDING, now)
        await self._assets.add(asset)
        await self._manifest.append(
            type=ManifestEventType.ASSET_CREATED,
            entity_type=ManifestEntityType.ASSET,
            entity_id=asset.id,
            payload={"filename": asset.filename, "kind": asset.kind.value},
        )
        await self._manifest.append(
            type=ManifestEventType.BLOB_STORED,
            entity_type=ManifestEntityType.BLOB,
            entity_id=blob_ref.id,
            payload={"asset_id": asset.id, "kind": blob_ref.kind.value},
        )
        await self._jobs.enqueue(
            type=JobType.THUMBNAIL,
            priority=int(JobPriority.THUMBNAIL),
            payload={"asset_id": asset.id},
            asset_id=asset.id,
        )
        if command.ocr_enabled and _can_ocr(kind):
            await self._jobs.enqueue(
                type=JobType.OCR,
                priority=int(JobPriority.OCR),
                payload={"asset_id": asset.id},
                asset_id=asset.id,
            )
        if command.embeddings_enabled:
            await self._jobs.enqueue(
                type=JobType.EMBEDDING,
                priority=int(JobPriority.EMBEDDING),
                payload={"asset_id": asset.id},
                asset_id=asset.id,
            )
        return UploadAssetResult(asset=asset, blob_ref=blob_ref, duplicate=False)


def _can_ocr(kind: AssetKind) -> bool:
    return kind in {AssetKind.IMAGE, AssetKind.PDF, AssetKind.DOCUMENT}
