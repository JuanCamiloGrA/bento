from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import mimetypes
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bento.domain.indexing import EmbeddingRecord


class EmbeddingModelUnavailableError(RuntimeError):
    pass


class EmbeddingServerError(RuntimeError):
    pass


class JinaOmniNanoGgufAdapter:
    def __init__(
        self,
        *,
        model_path: Path | str,
        endpoint_url: str = "http://127.0.0.1:8080/v1/embeddings",
        model: str = "jina-embeddings-v5-omni-nano",
        dimensions: int = 768,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._model_path = Path(model_path)
        self._endpoint_url = endpoint_url
        self._model = model
        self._dimensions = dimensions
        self._timeout_seconds = timeout_seconds

    @property
    def model_path(self) -> Path:
        return self._model_path

    def model_available(self) -> bool:
        return self._model_path.is_file()

    async def is_enabled(self) -> bool:
        return self.model_available()

    async def embed_asset(self, asset_id: str, source_ref: str) -> EmbeddingRecord:
        path = Path(source_ref)
        if path.is_file() and _is_image_path(path):
            record, _ = await self.embed_image(asset_id, path)
            return record
        record, _ = await self.embed_text(asset_id, source_ref)
        return record

    async def embed_text(self, asset_id: str, text: str) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        vector = await self._embed_payload({"model": self._model, "input": text})
        return self._record(asset_id, "text", text, vector), vector

    async def embed_image(self, asset_id: str, image_path: Path) -> tuple[EmbeddingRecord, tuple[float, ...]]:
        if not image_path.is_file():
            raise FileNotFoundError(str(image_path))
        content = await asyncio.to_thread(image_path.read_bytes)
        mime_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
        data_url = f"data:{mime_type};base64,{base64.b64encode(content).decode('ascii')}"
        payload = {
            "model": self._model,
            "input": {"type": "image_url", "image_url": {"url": data_url}},
        }
        vector = await self._embed_payload(payload)
        return self._record(asset_id, "image", hashlib.sha256(content).hexdigest(), vector), vector

    async def _embed_payload(self, payload: dict[str, object]) -> tuple[float, ...]:
        if not self.model_available():
            raise EmbeddingModelUnavailableError(f"Embedding model is unavailable: {self._model_path}")
        response = await asyncio.to_thread(self._post_json, payload)
        vector = _extract_embedding(response)
        if self._dimensions and len(vector) != self._dimensions:
            raise EmbeddingServerError(
                f"Embedding dimensions mismatch: expected {self._dimensions}, got {len(vector)}"
            )
        return vector

    def _post_json(self, payload: dict[str, object]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        request = Request(
            self._endpoint_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                raw = response.read()
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:300]
            raise EmbeddingServerError(f"Embedding server returned {exc.code}: {detail}") from exc
        except URLError as exc:
            raise EmbeddingServerError(f"Embedding server is unavailable: {exc.reason}") from exc
        return json.loads(raw.decode("utf-8"))

    def _record(self, asset_id: str, kind: str, seed: str, vector: tuple[float, ...]) -> EmbeddingRecord:
        digest = hashlib.sha1(f"{self._model}:{asset_id}:{kind}:{seed}".encode("utf-8")).hexdigest()
        return EmbeddingRecord(
            id=f"emb_{digest[:24]}",
            asset_id=asset_id,
            provider=self._model,
            vector_ref=f"llama.cpp:{digest[:32]}",
            dimensions=len(vector),
        )


def _extract_embedding(response: dict[str, Any]) -> tuple[float, ...]:
    data = response.get("data")
    if isinstance(data, list) and data:
        embedding = data[0].get("embedding") if isinstance(data[0], dict) else None
    else:
        embedding = response.get("embedding")
    if not isinstance(embedding, list) or not all(isinstance(value, int | float) for value in embedding):
        raise EmbeddingServerError("Embedding server response did not include a numeric embedding")
    return tuple(float(value) for value in embedding)


def _is_image_path(path: Path) -> bool:
    mime_type = mimetypes.guess_type(path.name)[0] or ""
    return mime_type.startswith("image/")
