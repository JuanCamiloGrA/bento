from __future__ import annotations

import hashlib

from bento.domain.indexing import OCRBlock


class MockOCRAdapter:
    def __init__(self, text_by_source: dict[str, str | tuple[str, ...]] | None = None, *, default_text: str = "") -> None:
        self._text_by_source = text_by_source or {}
        self._default_text = default_text

    async def is_enabled(self) -> bool:
        return True

    async def extract_text(self, asset_id: str, source_ref: str) -> tuple[OCRBlock, ...]:
        values = self._text_by_source.get(source_ref, self._default_text)
        if isinstance(values, str):
            texts = (values,) if values else ()
        else:
            texts = tuple(text for text in values if text)
        return tuple(
            OCRBlock(
                id=_block_id(asset_id, source_ref, index),
                asset_id=asset_id,
                text=text,
                confidence=1.0,
            )
            for index, text in enumerate(texts)
        )


def _block_id(asset_id: str, source_ref: str, index: int) -> str:
    digest = hashlib.sha1(f"{asset_id}:{source_ref}:{index}".encode("utf-8")).hexdigest()[:16]
    return f"ocr_{digest}"
