from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Iterable
from typing import Any

from bento.domain.indexing import OCRBlock


class RapidOCRAdapter:
    def __init__(self, *, params: dict[str, object] | None = None, config_path: str | None = None) -> None:
        self._params = params
        self._config_path = config_path
        self._engine: Any | None = None

    async def is_enabled(self) -> bool:
        try:
            self._load_engine()
        except ModuleNotFoundError:
            return False
        return True

    async def extract_text(self, asset_id: str, source_ref: str) -> tuple[OCRBlock, ...]:
        engine = self._load_engine()
        result = await asyncio.to_thread(engine, source_ref)
        return tuple(
            OCRBlock(
                id=_block_id(asset_id, source_ref, index),
                asset_id=asset_id,
                text=text,
                confidence=confidence,
            )
            for index, (text, confidence) in enumerate(_result_lines(result))
            if text.strip()
        )

    def _load_engine(self) -> Any:
        if self._engine is None:
            from rapidocr import RapidOCR

            kwargs: dict[str, object] = {}
            if self._params is not None:
                kwargs["params"] = self._params
            if self._config_path is not None:
                kwargs["config_path"] = self._config_path
            self._engine = RapidOCR(**kwargs)
        return self._engine


def _result_lines(result: Any) -> tuple[tuple[str, float | None], ...]:
    txts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    if txts is not None:
        return tuple((str(text), _score_at(scores, index)) for index, text in enumerate(txts))

    rec_res = getattr(result, "rec_res", None)
    if rec_res is not None:
        return _pairs_from_iterable(rec_res)

    if isinstance(result, tuple) and result:
        first = result[0]
        if hasattr(first, "txts"):
            return _result_lines(first)
        if isinstance(first, Iterable):
            return _pairs_from_iterable(first)

    if isinstance(result, Iterable) and not isinstance(result, (str, bytes)):
        return _pairs_from_iterable(result)
    return ()


def _pairs_from_iterable(values: Iterable[object]) -> tuple[tuple[str, float | None], ...]:
    lines: list[tuple[str, float | None]] = []
    for value in values:
        if isinstance(value, (str, bytes)):
            lines.append((str(value), None))
            continue
        if isinstance(value, Iterable):
            items = list(value)
            text = next((item for item in items if isinstance(item, str)), None)
            score = next((item for item in reversed(items) if isinstance(item, int | float)), None)
            if text is not None:
                lines.append((text, float(score) if score is not None else None))
    return tuple(lines)


def _score_at(scores: object, index: int) -> float | None:
    if scores is None:
        return None
    try:
        value = scores[index]  # type: ignore[index]
    except (IndexError, TypeError, KeyError):
        return None
    return float(value) if isinstance(value, int | float) else None


def _block_id(asset_id: str, source_ref: str, index: int) -> str:
    digest = hashlib.sha1(f"{asset_id}:{source_ref}:{index}".encode("utf-8")).hexdigest()[:16]
    return f"ocr_{digest}"
