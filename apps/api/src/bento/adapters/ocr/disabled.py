from __future__ import annotations

from bento.domain.indexing import OCRBlock


class DisabledOCRAdapter:
    async def is_enabled(self) -> bool:
        return False

    async def extract_text(self, asset_id: str, source_ref: str) -> tuple[OCRBlock, ...]:
        del asset_id, source_ref
        return ()
