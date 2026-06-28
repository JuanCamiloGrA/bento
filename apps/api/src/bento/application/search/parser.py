from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum


class QueryIntent(StrEnum):
    GENERAL = "general"
    DOCUMENT = "document"
    SCENE = "scene"
    DATE = "date"


@dataclass(frozen=True, slots=True)
class ParsedSearchQuery:
    raw_text: str
    tokens: tuple[str, ...]
    intent: QueryIntent
    date_from: datetime | None = None
    date_to: datetime | None = None

    @property
    def has_text(self) -> bool:
        return bool(self.tokens)


DOCUMENT_TERMS = frozenset(
    {
        "cedula",
        "factura",
        "contrato",
        "pasaporte",
        "recibo",
        "invoice",
        "receipt",
        "contract",
        "passport",
        "documento",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "txt",
    }
)

SCENE_TERMS = frozenset(
    {
        "playa",
        "cielo",
        "montana",
        "paisaje",
        "persona",
        "carro",
        "comida",
        "atardecer",
        "sunset",
        "beach",
        "mountain",
        "landscape",
        "people",
        "person",
        "photo",
        "image",
        "scene",
        "blue",
        "red",
        "verde",
    }
)

MONTHS = {
    "enero": 1,
    "january": 1,
    "febrero": 2,
    "february": 2,
    "marzo": 3,
    "march": 3,
    "abril": 4,
    "april": 4,
    "mayo": 5,
    "may": 5,
    "junio": 6,
    "june": 6,
    "julio": 7,
    "july": 7,
    "agosto": 8,
    "august": 8,
    "septiembre": 9,
    "setiembre": 9,
    "september": 9,
    "octubre": 10,
    "october": 10,
    "noviembre": 11,
    "november": 11,
    "diciembre": 12,
    "december": 12,
}

TOKEN_RE = re.compile(r"[\w@.\-]+", flags=re.UNICODE)
EMAIL_RE = re.compile(r"\b[^@\s]+@[^@\s]+\.[^@\s]+\b")
DOCUMENT_NAME_RE = re.compile(r"\b[\w\-]+\.(pdf|docx?|xlsx?|txt|csv)\b", flags=re.IGNORECASE)
ISO_DATE_RE = re.compile(r"\b(20\d{2}|19\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b")
YEAR_RE = re.compile(r"\b(20\d{2}|19\d{2})\b")


def parse_search_query(raw_text: str) -> ParsedSearchQuery:
    normalized = raw_text.strip()
    tokens = tuple(_tokens(normalized))
    date_from, date_to = _date_range(normalized)
    intent = _intent(normalized, tokens, date_from is not None)
    return ParsedSearchQuery(
        raw_text=normalized,
        tokens=tokens,
        intent=intent,
        date_from=date_from,
        date_to=date_to,
    )


def _tokens(value: str) -> list[str]:
    return [token.strip("._-").lower() for token in TOKEN_RE.findall(value) if token.strip("._-")]


def _intent(raw_text: str, tokens: tuple[str, ...], has_date: bool) -> QueryIntent:
    lowered = raw_text.lower()
    if has_date:
        return QueryIntent.DATE
    if any(token in DOCUMENT_TERMS for token in tokens):
        return QueryIntent.DOCUMENT
    if any(char.isdigit() for char in lowered) or EMAIL_RE.search(lowered) or DOCUMENT_NAME_RE.search(lowered):
        return QueryIntent.DOCUMENT
    scene_terms = sum(1 for token in tokens if token in SCENE_TERMS)
    if scene_terms or (len(tokens) >= 3 and not any(token in DOCUMENT_TERMS for token in tokens)):
        return QueryIntent.SCENE
    return QueryIntent.GENERAL


def _date_range(raw_text: str) -> tuple[datetime | None, datetime | None]:
    lowered = raw_text.lower()
    iso_match = ISO_DATE_RE.search(lowered)
    if iso_match is not None:
        year, month, day = (int(part) for part in iso_match.groups())
        start = datetime(year, month, day, tzinfo=UTC)
        return start, start.replace(hour=23, minute=59, second=59, microsecond=999999)

    for month_name, month in MONTHS.items():
        pattern = rf"\b{re.escape(month_name)}\s+(20\d{{2}}|19\d{{2}})\b"
        match = re.search(pattern, lowered)
        if match is not None:
            year = int(match.group(1))
            return _month_range(year, month)

    year_match = YEAR_RE.search(lowered)
    if year_match is not None:
        year = int(year_match.group(1))
        return (
            datetime(year, 1, 1, tzinfo=UTC),
            datetime(year, 12, 31, 23, 59, 59, 999999, tzinfo=UTC),
        )
    return None, None


def _month_range(year: int, month: int) -> tuple[datetime, datetime]:
    last_day = calendar.monthrange(year, month)[1]
    return (
        datetime(year, month, 1, tzinfo=UTC),
        datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=UTC),
    )
