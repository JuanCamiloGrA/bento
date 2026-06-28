from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class EncryptionMode(StrEnum):
    NONE = "none"
    AES_GCM = "aes_gcm"


@dataclass(frozen=True, slots=True)
class EncryptionMetadata:
    mode: EncryptionMode
    key_id: str | None = None
    nonce: str | None = None
