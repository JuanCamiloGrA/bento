from __future__ import annotations

from pathlib import Path

from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session, sessionmaker

from bento.adapters.repositories.ids import new_id
from bento.domain.errors import StorageUnavailableError, ValidationFailedError
from bento.domain.storage import BlobKind, BlobRef, StorageBackend
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import BlobRefModel, ThumbnailModel
from bento.ports.repositories import ClockPort


class SQLiteBlobRefCatalog:
    def __init__(self, session_factory: sessionmaker[Session], clock: ClockPort) -> None:
        self._session_factory = session_factory
        self._clock = clock

    async def add(self, blob_ref: BlobRef) -> None:
        now = self._clock.now()
        with session_scope(self._session_factory) as session:
            session.merge(
                BlobRefModel(
                    id=blob_ref.id,
                    asset_id=blob_ref.asset_id,
                    backend=blob_ref.backend.value,
                    kind=blob_ref.kind.value,
                    object_key=blob_ref.object_key,
                    size_bytes=blob_ref.size_bytes,
                    sha256=blob_ref.sha256,
                    chat_id=blob_ref.chat_id,
                    message_id=blob_ref.message_id,
                    file_id=blob_ref.file_id,
                    file_unique_id=blob_ref.file_unique_id,
                    created_at=now,
                )
            )

    async def latest_for_asset(self, asset_id: str, kind: BlobKind) -> BlobRef | None:
        statement: Select[tuple[BlobRefModel]] = (
            select(BlobRefModel)
            .where(BlobRefModel.asset_id == asset_id, BlobRefModel.kind == kind.value)
            .order_by(BlobRefModel.created_at.desc(), BlobRefModel.id.desc())
            .limit(1)
        )
        with session_scope(self._session_factory) as session:
            model = session.scalar(statement)
            return _blob_ref_from_model(model) if model is not None else None


class SQLiteThumbnailCatalog:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        clock: ClockPort,
        blob_refs: SQLiteBlobRefCatalog,
    ) -> None:
        self._session_factory = session_factory
        self._clock = clock
        self._blob_refs = blob_refs

    async def add(self, *, asset_id: str, blob_ref: BlobRef, width: int | None, height: int | None) -> None:
        await self._blob_refs.add(blob_ref)
        with session_scope(self._session_factory) as session:
            session.add(
                ThumbnailModel(
                    id=new_id("thumb"),
                    asset_id=asset_id,
                    blob_ref_id=blob_ref.id,
                    width=width,
                    height=height,
                    created_at=self._clock.now(),
                )
            )

    async def latest_thumbnail_blob(self, asset_id: str) -> BlobRef | None:
        statement = (
            select(BlobRefModel)
            .join(ThumbnailModel, ThumbnailModel.blob_ref_id == BlobRefModel.id)
            .where(ThumbnailModel.asset_id == asset_id)
            .order_by(desc(ThumbnailModel.width), ThumbnailModel.created_at.desc(), ThumbnailModel.id.desc())
            .limit(1)
        )
        with session_scope(self._session_factory) as session:
            model = session.scalar(statement)
            return _blob_ref_from_model(model) if model is not None else None


class LocalBlobPathResolver:
    def __init__(self, root_dir: Path | str) -> None:
        self._root_dir = Path(root_dir)

    def resolve(self, blob_ref: BlobRef) -> Path:
        if blob_ref.backend != StorageBackend.LOCAL:
            raise StorageUnavailableError(blob_ref.backend.value)
        object_path = Path(blob_ref.object_key)
        if object_path.is_absolute() or ".." in object_path.parts:
            raise ValidationFailedError("Invalid blob object key")
        root = self._root_dir.resolve()
        path = (root / object_path).resolve()
        if not path.is_relative_to(root):
            raise ValidationFailedError("Invalid blob object key")
        if not path.is_file():
            raise StorageUnavailableError(blob_ref.backend.value)
        return path


def _blob_ref_from_model(model: BlobRefModel) -> BlobRef:
    return BlobRef(
        id=model.id,
        asset_id=model.asset_id,
        backend=StorageBackend(model.backend),
        kind=BlobKind(model.kind),
        object_key=model.object_key,
        size_bytes=model.size_bytes,
        sha256=model.sha256,
        chat_id=model.chat_id,
        message_id=model.message_id,
        file_id=model.file_id,
        file_unique_id=model.file_unique_id,
    )
