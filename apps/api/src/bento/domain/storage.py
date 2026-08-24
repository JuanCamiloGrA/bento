from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from bento.domain.errors import ValidationFailedError
from bento.domain.security import EncryptionMetadata, EncryptionMode


class StorageBackend(StrEnum):
    LOCAL = "local"
    TELEGRAM = "telegram"


class BlobKind(StrEnum):
    ORIGINAL = "original"
    THUMBNAIL = "thumbnail"
    PREVIEW = "preview"
    JOURNAL = "journal"


@dataclass(frozen=True, slots=True)
class BlobRef:
    id: str
    asset_id: str | None
    backend: StorageBackend
    kind: BlobKind
    object_key: str
    size_bytes: int
    sha256: str | None = None
    chat_id: str | None = None
    message_id: str | None = None
    file_id: str | None = None
    file_unique_id: str | None = None
    encryption: EncryptionMetadata = EncryptionMetadata(mode=EncryptionMode.NONE)

    def __post_init__(self) -> None:
        if not self.id.strip():
            raise ValidationFailedError("Blob id is required")
        if not self.object_key.strip():
            raise ValidationFailedError("Blob object key is required")
        if self.size_bytes < 0:
            raise ValidationFailedError("Blob size cannot be negative", {"size_bytes": self.size_bytes})
