from __future__ import annotations

import asyncio
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class PDFPageRender:
    page_number: int
    image_path: Path


class Pypdfium2PDFPageRenderer:
    def __init__(self, output_dir: Path | str, *, scale: float = 2.0, max_pages: int | None = None) -> None:
        self._output_dir = Path(output_dir)
        self._scale = scale
        self._max_pages = max_pages

    async def render_pages(self, *, asset_id: str, source_path: Path) -> tuple[PDFPageRender, ...]:
        return await asyncio.to_thread(self._render_pages_sync, asset_id, source_path)

    def _render_pages_sync(self, asset_id: str, source_path: Path) -> tuple[PDFPageRender, ...]:
        import pypdfium2 as pdfium

        target_dir = self._output_dir / asset_id
        if target_dir.exists():
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)

        renders: list[PDFPageRender] = []
        document = pdfium.PdfDocument(source_path)
        try:
            for page_index, page in enumerate(document):
                if self._max_pages is not None and page_index >= self._max_pages:
                    break
                page_number = page_index + 1
                image_path = target_dir / f"page-{page_number:04d}.png"
                bitmap = page.render(scale=self._scale)
                try:
                    image = _to_pil(bitmap)
                    image.save(image_path)
                finally:
                    close = getattr(bitmap, "close", None)
                    if callable(close):
                        close()
                    close_page = getattr(page, "close", None)
                    if callable(close_page):
                        close_page()
                renders.append(PDFPageRender(page_number=page_number, image_path=image_path))
        finally:
            close_document = getattr(document, "close", None)
            if callable(close_document):
                close_document()
        return tuple(renders)


def _to_pil(bitmap: Any) -> Any:
    image = bitmap.to_pil()
    if image.mode not in {"RGB", "RGBA", "L"}:
        return image.convert("RGB")
    return image
