from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path, PurePath
from typing import Any


_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10)),
}


@dataclass(frozen=True, slots=True)
class ExtractedUploadMetadata:
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    taken_at: datetime | None
    exif: dict[str, Any] | None


def sanitize_filename(filename: str) -> str:
    name = PurePath(filename.replace("\\", "/")).name
    name = _CONTROL_CHARS.sub("", name).strip().strip(".")
    name = name.replace("/", "_").replace("\\", "_")
    if not name:
        name = "upload"
    stem = name.split(".", maxsplit=1)[0].upper()
    if stem in _WINDOWS_RESERVED_NAMES:
        name = f"_{name}"
    if len(name) > 255:
        suffix = "".join(Path(name).suffixes)
        max_stem = max(1, 255 - len(suffix))
        name = f"{Path(name).stem[:max_stem]}{suffix}"[:255]
    return name
