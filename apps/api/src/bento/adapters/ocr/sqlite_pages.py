from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session, sessionmaker

from bento.adapters.repositories.ids import new_id
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import PDFPageModel
from bento.ports.repositories import ClockPort


class SQLitePDFPageTextCatalog:
    def __init__(self, session_factory: sessionmaker[Session], clock: ClockPort) -> None:
        self._session_factory = session_factory
        self._clock = clock

    async def save_page_text(self, *, asset_id: str, page_number: int, text: str) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(
                delete(PDFPageModel).where(
                    PDFPageModel.asset_id == asset_id,
                    PDFPageModel.page_number == page_number,
                )
            )
            session.add(
                PDFPageModel(
                    id=new_id("pdfpage"),
                    asset_id=asset_id,
                    page_number=page_number,
                    text=text,
                    created_at=self._clock.now(),
                )
            )
