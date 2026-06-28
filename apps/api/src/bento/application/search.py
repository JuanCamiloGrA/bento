from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from bento.domain.search import SearchQuery, SearchResultType, SearchResults
from bento.ports.search import SearchIndexPort


@dataclass(frozen=True, slots=True)
class SearchAssetsQuery:
    text: str
    result_type: SearchResultType | None = None
    folder_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = 50
    cursor: str | None = None


class SearchUseCase:
    def __init__(self, *, index: SearchIndexPort) -> None:
        self._index = index

    async def execute(self, query: SearchAssetsQuery) -> SearchResults:
        return await self._index.search(
            SearchQuery(
                text=query.text,
                result_type=query.result_type,
                folder_id=query.folder_id,
                date_from=query.date_from,
                date_to=query.date_to,
                limit=query.limit,
                cursor=query.cursor,
            )
        )
