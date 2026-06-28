from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum

from bento.domain.assets import Asset
from bento.domain.errors import InvalidFolderMoveError, ValidationFailedError


class DriveItemType(StrEnum):
    ASSET = "asset"
    FOLDER = "folder"


@dataclass(frozen=True, slots=True)
class Folder:
    id: str
    name: str
    parent_id: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.id.strip():
            raise ValidationFailedError("Folder id is required")
        if not self.name.strip():
            raise ValidationFailedError("Folder name is required")

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def assert_can_move_to(self, parent_id: str | None, descendant_ids: set[str]) -> None:
        if parent_id == self.id or (parent_id is not None and parent_id in descendant_ids):
            raise InvalidFolderMoveError(self.id, parent_id)

    def move_to(self, parent_id: str | None, descendant_ids: set[str], at: datetime) -> Folder:
        self.assert_can_move_to(parent_id, descendant_ids)
        return replace(self, parent_id=parent_id, updated_at=at)

    def rename(self, name: str, at: datetime) -> Folder:
        if not name.strip():
            raise ValidationFailedError("Folder name is required")
        return replace(self, name=name, updated_at=at)

    def mark_deleted(self, at: datetime) -> Folder:
        return replace(self, deleted_at=at, updated_at=at)


@dataclass(frozen=True, slots=True)
class DriveItem:
    type: DriveItemType
    id: str
    name: str
    updated_at: datetime
    asset: Asset | None = None
    folder: Folder | None = None
