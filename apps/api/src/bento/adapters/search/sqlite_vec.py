from __future__ import annotations

import json
import math
import sqlite3
import struct
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import delete, text
from sqlalchemy.orm import Session, sessionmaker

from bento.domain.indexing import EmbeddingRecord
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import AssetEmbeddingModel
from bento.ports.repositories import ClockPort


Vector = tuple[float, ...]


@dataclass(frozen=True, slots=True)
class VectorSearchHit:
    asset_id: str
    embedding_id: str
    provider: str
    distance: float
    score: float


class SQLiteVecSearchIndex:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        clock: ClockPort,
        *,
        dimensions: int,
        allow_fallback: bool = True,
        prefer_sqlite_vec: bool = True,
    ) -> None:
        if dimensions < 1:
            raise ValueError("dimensions must be positive")
        self._session_factory = session_factory
        self._clock = clock
        self._dimensions = dimensions
        self._allow_fallback = allow_fallback
        self._prefer_sqlite_vec = prefer_sqlite_vec
        self._initialized = False
        self._using_sqlite_vec = False

    @property
    def using_sqlite_vec(self) -> bool:
        return self._using_sqlite_vec

    async def initialize(self) -> None:
        if self._initialized:
            return
        with session_scope(self._session_factory) as session:
            self._using_sqlite_vec = self._prefer_sqlite_vec and _load_sqlite_vec(session)
            if not self._using_sqlite_vec and not self._allow_fallback:
                raise RuntimeError("sqlite-vec extension is unavailable")
            _create_vector_map(session)
            if self._using_sqlite_vec:
                session.execute(
                    text(
                        f"""
                        CREATE VIRTUAL TABLE IF NOT EXISTS asset_embedding_vec
                        USING vec0(embedding float[{self._dimensions}])
                        """
                    )
                )
            else:
                session.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS asset_embedding_vectors_fallback (
                            embedding_id TEXT PRIMARY KEY,
                            vector BLOB NOT NULL
                        )
                        """
                    )
                )
        self._initialized = True

    async def index_embedding(self, record: EmbeddingRecord) -> None:
        await self.initialize()
        with session_scope(self._session_factory) as session:
            _persist_metadata(session, record, self._clock.now())

    async def index_embedding_vector(self, record: EmbeddingRecord, vector: Vector) -> None:
        _validate_vector(vector, self._dimensions)
        if record.dimensions != len(vector):
            raise ValueError("record dimensions do not match vector length")

        await self.initialize()
        with session_scope(self._session_factory) as session:
            if self._using_sqlite_vec and not _load_sqlite_vec(session):
                raise RuntimeError("sqlite-vec extension is unavailable on this connection")
            _persist_metadata(session, record, self._clock.now())
            rowid = _upsert_vector_map(session, record, self._clock.now())
            if self._using_sqlite_vec:
                session.execute(text("DELETE FROM asset_embedding_vec WHERE rowid = :rowid"), {"rowid": rowid})
                session.execute(
                    text("INSERT INTO asset_embedding_vec(rowid, embedding) VALUES (:rowid, :embedding)"),
                    {"rowid": rowid, "embedding": _vector_json(vector)},
                )
            else:
                session.execute(
                    text(
                        """
                        INSERT OR REPLACE INTO asset_embedding_vectors_fallback(embedding_id, vector)
                        VALUES (:embedding_id, :vector)
                        """
                    ),
                    {"embedding_id": record.id, "vector": _pack_vector(vector)},
                )

    async def search_vectors(
        self,
        vector: Vector,
        *,
        limit: int = 50,
        provider: str | None = None,
    ) -> tuple[VectorSearchHit, ...]:
        _validate_vector(vector, self._dimensions)
        await self.initialize()
        limit = max(min(limit, 100), 1)
        with session_scope(self._session_factory) as session:
            if self._using_sqlite_vec:
                return _sqlite_vec_search(session, vector, limit=limit, provider=provider)
            return _fallback_search(session, vector, limit=limit, provider=provider)

    async def remove_asset(self, asset_id: str) -> None:
        await self.initialize()
        with session_scope(self._session_factory) as session:
            if self._using_sqlite_vec and not _load_sqlite_vec(session):
                raise RuntimeError("sqlite-vec extension is unavailable on this connection")
            rows = list(
                session.execute(
                    text(
                        """
                        SELECT rowid, embedding_id
                        FROM asset_embedding_vector_map
                        WHERE asset_id = :asset_id
                        """
                    ),
                    {"asset_id": asset_id},
                ).mappings()
            )
            for row in rows:
                if self._using_sqlite_vec:
                    session.execute(text("DELETE FROM asset_embedding_vec WHERE rowid = :rowid"), {"rowid": row["rowid"]})
                else:
                    session.execute(
                        text("DELETE FROM asset_embedding_vectors_fallback WHERE embedding_id = :embedding_id"),
                        {"embedding_id": row["embedding_id"]},
                    )
            session.execute(text("DELETE FROM asset_embedding_vector_map WHERE asset_id = :asset_id"), {"asset_id": asset_id})
            session.execute(delete(AssetEmbeddingModel).where(AssetEmbeddingModel.asset_id == asset_id))


def _load_sqlite_vec(session: Session) -> bool:
    try:
        import sqlite_vec  # type: ignore[import-not-found]
    except ModuleNotFoundError:
        return False

    dbapi_connection = _dbapi_connection(session)
    try:
        if hasattr(sqlite_vec, "load"):
            sqlite_vec.load(dbapi_connection)
        elif hasattr(sqlite_vec, "loadable_path"):
            dbapi_connection.enable_load_extension(True)
            dbapi_connection.load_extension(sqlite_vec.loadable_path())
            dbapi_connection.enable_load_extension(False)
        else:
            return False
    except (AttributeError, sqlite3.Error):
        return False
    return True


def _dbapi_connection(session: Session) -> sqlite3.Connection:
    connection = session.connection().connection
    driver_connection = getattr(connection, "driver_connection", None)
    if driver_connection is not None:
        return driver_connection
    dbapi_connection = getattr(connection, "dbapi_connection", None)
    if dbapi_connection is not None:
        return dbapi_connection
    return connection  # type: ignore[return-value]


def _create_vector_map(session: Session) -> None:
    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS asset_embedding_vector_map (
                rowid INTEGER PRIMARY KEY AUTOINCREMENT,
                embedding_id TEXT NOT NULL UNIQUE,
                asset_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
    )
    session.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_asset_embedding_vector_map_asset
            ON asset_embedding_vector_map(asset_id)
            """
        )
    )
    session.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_asset_embedding_vector_map_provider
            ON asset_embedding_vector_map(provider)
            """
        )
    )


def _persist_metadata(session: Session, record: EmbeddingRecord, now: datetime) -> None:
    session.merge(
        AssetEmbeddingModel(
            id=record.id,
            asset_id=record.asset_id,
            provider=record.provider,
            vector_ref=record.vector_ref,
            dimensions=record.dimensions,
            created_at=now,
        )
    )


def _upsert_vector_map(session: Session, record: EmbeddingRecord, now: datetime) -> int:
    existing = session.execute(
        text("SELECT rowid FROM asset_embedding_vector_map WHERE embedding_id = :embedding_id"),
        {"embedding_id": record.id},
    ).scalar()
    if existing is None:
        session.execute(
            text(
                """
                INSERT INTO asset_embedding_vector_map(embedding_id, asset_id, provider, dimensions, created_at)
                VALUES (:embedding_id, :asset_id, :provider, :dimensions, :created_at)
                """
            ),
            {
                "embedding_id": record.id,
                "asset_id": record.asset_id,
                "provider": record.provider,
                "dimensions": record.dimensions,
                "created_at": now.isoformat(timespec="seconds"),
            },
        )
        existing = session.execute(
            text("SELECT rowid FROM asset_embedding_vector_map WHERE embedding_id = :embedding_id"),
            {"embedding_id": record.id},
        ).scalar_one()
    else:
        session.execute(
            text(
                """
                UPDATE asset_embedding_vector_map
                SET asset_id = :asset_id, provider = :provider, dimensions = :dimensions
                WHERE embedding_id = :embedding_id
                """
            ),
            {
                "embedding_id": record.id,
                "asset_id": record.asset_id,
                "provider": record.provider,
                "dimensions": record.dimensions,
            },
        )
    return int(existing)


def _sqlite_vec_search(session: Session, vector: Vector, *, limit: int, provider: str | None) -> tuple[VectorSearchHit, ...]:
    if not _load_sqlite_vec(session):
        raise RuntimeError("sqlite-vec extension is unavailable on this connection")
    filters = ["v.embedding MATCH :embedding", "k = :limit", "m.dimensions = :dimensions"]
    params: dict[str, object] = {
        "embedding": _vector_json(vector),
        "limit": limit,
        "dimensions": len(vector),
    }
    if provider is not None:
        filters.append("m.provider = :provider")
        params["provider"] = provider
    rows = list(
        session.execute(
            text(
                f"""
                SELECT m.embedding_id, m.asset_id, m.provider, v.distance
                FROM asset_embedding_vec AS v
                JOIN asset_embedding_vector_map AS m ON m.rowid = v.rowid
                WHERE {" AND ".join(filters)}
                ORDER BY v.distance ASC
                LIMIT :limit
                """
            ),
            params,
        ).mappings()
    )
    return tuple(_hit_from_row(row) for row in rows)


def _fallback_search(session: Session, vector: Vector, *, limit: int, provider: str | None) -> tuple[VectorSearchHit, ...]:
    filters = ["m.dimensions = :dimensions"]
    params: dict[str, object] = {"dimensions": len(vector)}
    if provider is not None:
        filters.append("m.provider = :provider")
        params["provider"] = provider
    rows = list(
        session.execute(
            text(
                f"""
                SELECT m.embedding_id, m.asset_id, m.provider, f.vector
                FROM asset_embedding_vector_map AS m
                JOIN asset_embedding_vectors_fallback AS f ON f.embedding_id = m.embedding_id
                WHERE {" AND ".join(filters)}
                """
            ),
            params,
        ).mappings()
    )
    hits = [
        VectorSearchHit(
            asset_id=str(row["asset_id"]),
            embedding_id=str(row["embedding_id"]),
            provider=str(row["provider"]),
            distance=(distance := _l2_distance(vector, _unpack_vector(row["vector"]))),
            score=_score(distance),
        )
        for row in rows
    ]
    hits.sort(key=lambda hit: (hit.distance, hit.asset_id, hit.embedding_id))
    return tuple(hits[:limit])


def _hit_from_row(row: Any) -> VectorSearchHit:
    distance = float(row["distance"])
    return VectorSearchHit(
        asset_id=str(row["asset_id"]),
        embedding_id=str(row["embedding_id"]),
        provider=str(row["provider"]),
        distance=distance,
        score=_score(distance),
    )


def _validate_vector(vector: Vector, dimensions: int) -> None:
    if len(vector) != dimensions:
        raise ValueError(f"expected {dimensions} dimensions, got {len(vector)}")
    if not all(math.isfinite(value) for value in vector):
        raise ValueError("vector contains non-finite values")


def _pack_vector(vector: Vector) -> bytes:
    return struct.pack(f"<{len(vector)}f", *vector)


def _unpack_vector(raw: object) -> Vector:
    data = bytes(raw)
    if len(data) % 4 != 0:
        raise ValueError("stored vector blob has an invalid length")
    return struct.unpack(f"<{len(data) // 4}f", data)


def _l2_distance(left: Vector, right: Vector) -> float:
    if len(left) != len(right):
        return float("inf")
    return math.sqrt(sum((a - b) * (a - b) for a, b in zip(left, right, strict=True)))


def _score(distance: float) -> float:
    return 1.0 / (1.0 + max(distance, 0.0))


def _vector_json(vector: Vector) -> str:
    return json.dumps(list(vector), separators=(",", ":"))
