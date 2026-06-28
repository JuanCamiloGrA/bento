from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from bento.application.search import SearchAssetsQuery, SearchUseCase
from bento.domain.search import SearchFacet, SearchHit, SearchResultType
from bento.infrastructure.settings import Settings

router = APIRouter()


class SearchItemResponse(BaseModel):
    id: str
    type: str
    asset_id: str | None
    title: str
    subtitle: str | None
    thumbnail_url: str | None
    score: float
    reason: str
    processing_state: str | None


class SearchFacetResponse(BaseModel):
    type: str
    count: int


class SearchResponse(BaseModel):
    items: list[SearchItemResponse]
    facets: list[SearchFacetResponse]
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class SearchRouteDependencies:
    search: SearchUseCase


@router.get("/search", response_model=SearchResponse)
async def search(
    request: Request,
    q: Annotated[str, Query()] = "",
    type_: Annotated[SearchResultType | None, Query(alias="type")] = None,
    folder_id: Annotated[str | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query()] = None,
) -> SearchResponse:
    results = await _search_dependencies(request).search.execute(
        SearchAssetsQuery(
            text=q,
            result_type=type_,
            folder_id=folder_id,
            date_from=_start_of_day(date_from),
            date_to=_end_of_day(date_to),
            limit=limit,
            cursor=cursor,
        )
    )
    return SearchResponse(
        items=[_item_response(item) for item in results.items],
        facets=[_facet_response(facet) for facet in results.facets],
        next_cursor=results.next_cursor,
    )


def _search_dependencies(request: Request) -> SearchRouteDependencies:
    cached = getattr(request.app.state, "search_route_dependencies", None)
    if cached is not None:
        return cached

    from bento.adapters.embeddings import DisabledEmbeddingProvider, JinaOmniNanoGgufAdapter, MockEmbeddingProvider
    from bento.adapters.search.composite import CompositeSearchIndex
    from bento.adapters.search.sqlite_fts import SQLiteFTSSearchIndex
    from bento.adapters.search.sqlite_vec import SQLiteVecSearchIndex
    from bento.infrastructure.db.clock import SystemClock
    from bento.infrastructure.db.engine import create_session_factory, sqlite_url

    settings = _settings(request)
    data_dir = Path(settings.data_dir)
    clock = SystemClock()
    session_factory = create_session_factory(sqlite_url(data_dir / "db" / "bento.sqlite3"))
    provider = _embedding_provider(data_dir, DisabledEmbeddingProvider, MockEmbeddingProvider, JinaOmniNanoGgufAdapter)
    vector_index = SQLiteVecSearchIndex(
        session_factory,
        clock,
        dimensions=int(os.getenv("BENTO_EMBEDDING_DIMENSIONS", "768")),
    )
    dependencies = SearchRouteDependencies(
        search=SearchUseCase(
            index=CompositeSearchIndex(
                session_factory,
                clock,
                text_index=SQLiteFTSSearchIndex(session_factory, clock),
                vector_index=vector_index,
                query_embedding_provider=provider,
            )
        )
    )
    request.app.state.search_route_dependencies = dependencies
    return dependencies


def _embedding_provider(
    data_dir: Path,
    disabled_cls: type[Any],
    mock_cls: type[Any],
    jina_cls: type[Any],
) -> Any:
    provider = os.getenv("BENTO_EMBEDDING_PROVIDER", "disabled").strip().lower()
    dimensions = int(os.getenv("BENTO_EMBEDDING_DIMENSIONS", "768"))
    if provider == "mock":
        return mock_cls(dimensions=dimensions)
    if provider == "jina":
        return jina_cls(
            model_path=Path(
                os.getenv(
                    "BENTO_EMBEDDING_MODEL_PATH",
                    str(data_dir / "models" / "jina-embeddings-v5-omni-nano.gguf"),
                )
            ),
            endpoint_url=os.getenv("BENTO_EMBEDDING_SERVER_URL", "http://127.0.0.1:8080/v1/embeddings"),
            dimensions=dimensions,
        )
    return disabled_cls()


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _start_of_day(value: date | None) -> datetime | None:
    if value is None:
        return None
    return datetime.combine(value, time.min, tzinfo=UTC)


def _end_of_day(value: date | None) -> datetime | None:
    if value is None:
        return None
    return datetime.combine(value, time.max, tzinfo=UTC)


def _item_response(item: SearchHit) -> SearchItemResponse:
    return SearchItemResponse(
        id=item.id,
        type=item.type.value,
        asset_id=item.asset_id,
        title=item.title,
        subtitle=item.subtitle,
        thumbnail_url=item.thumbnail_url,
        score=item.score,
        reason=item.reason,
        processing_state=item.processing_state.value if item.processing_state is not None else None,
    )


def _facet_response(facet: SearchFacet) -> SearchFacetResponse:
    return SearchFacetResponse(type=facet.type.value, count=facet.count)
