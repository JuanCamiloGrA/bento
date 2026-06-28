from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime

from bento.domain.errors import ValidationFailedError


@dataclass(frozen=True, slots=True)
class Album:
    id: str
    title: str
    asset_ids: frozenset[str]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.id.strip():
            raise ValidationFailedError("Album id is required")
        if not self.title.strip():
            raise ValidationFailedError("Album title is required")

    def rename(self, title: str, at: datetime) -> Album:
        if not title.strip():
            raise ValidationFailedError("Album title is required")
        return replace(self, title=title, updated_at=at)

    def add_asset(self, asset_id: str, at: datetime) -> Album:
        if not asset_id.strip():
            raise ValidationFailedError("Asset id is required")
        return replace(self, asset_ids=self.asset_ids | {asset_id}, updated_at=at)

    def remove_asset(self, asset_id: str, at: datetime) -> Album:
        return replace(self, asset_ids=self.asset_ids - {asset_id}, updated_at=at)

    def mark_deleted(self, at: datetime) -> Album:
        return replace(self, deleted_at=at, updated_at=at)


@dataclass(frozen=True, slots=True)
class TimelineGroup:
    day: date
    asset_ids: tuple[str, ...]
