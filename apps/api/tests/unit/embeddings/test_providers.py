from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from bento.adapters.embeddings import (
    DisabledEmbeddingProvider,
    EmbeddingModelUnavailableError,
    JinaOmniNanoGgufAdapter,
    MockEmbeddingProvider,
)
from bento.domain.errors import EmbeddingsDisabledError


def test_mock_embedding_provider_is_deterministic_for_text() -> None:
    async def scenario() -> None:
        provider = MockEmbeddingProvider(dimensions=4)

        first_record, first_vector = await provider.embed_text("asset_1", "Factura cafe")
        second_record, second_vector = await provider.embed_text("asset_1", "Factura cafe")

        assert first_record == second_record
        assert first_vector == second_vector
        assert len(first_vector) == 4

    asyncio.run(scenario())


def test_disabled_embedding_provider_reports_disabled() -> None:
    async def scenario() -> None:
        provider = DisabledEmbeddingProvider()

        assert await provider.is_enabled() is False
        with pytest.raises(EmbeddingsDisabledError):
            await provider.embed_text("asset_1", "hello")

    asyncio.run(scenario())


def test_jina_adapter_missing_model_is_unavailable(tmp_path: Path) -> None:
    async def scenario() -> None:
        provider = JinaOmniNanoGgufAdapter(model_path=tmp_path / "missing.gguf", dimensions=4)

        assert await provider.is_enabled() is False
        with pytest.raises(EmbeddingModelUnavailableError, match="unavailable"):
            await provider.embed_text("asset_1", "hello")

    asyncio.run(scenario())
