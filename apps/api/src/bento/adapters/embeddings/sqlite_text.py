from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import AssetTextModel


class SQLiteEmbeddingTextCatalog:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    async def text_for_asset(self, asset_id: str) -> str | None:
        with session_scope(self._session_factory) as session:
            rows = list(
                session.scalars(
                    select(AssetTextModel.text)
                    .where(AssetTextModel.asset_id == asset_id)
                    .order_by(AssetTextModel.source.asc(), AssetTextModel.id.asc())
                )
            )
        text = "\n".join(row.strip() for row in rows if row.strip())
        return text or None
