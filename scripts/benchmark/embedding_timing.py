from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_SRC = REPO_ROOT / "apps" / "api" / "src"
if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))

from bento.adapters.embeddings import JinaOmniNanoGgufAdapter, MockEmbeddingProvider
from bento.adapters.search.sqlite_vec import SQLiteVecSearchIndex
from bento.infrastructure.db.engine import create_session_factory, sqlite_url


class BenchmarkClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


async def main() -> None:
    args = _parse_args()
    provider = _provider(args)
    samples = [f"{args.text} #{index}" for index in range(args.count)]
    timings: list[float] = []
    records = []

    for index, text in enumerate(samples, start=1):
        start = time.perf_counter()
        record, vector = await provider.embed_text(f"bench_asset_{index}", text)
        timings.append(time.perf_counter() - start)
        records.append((record, vector))

    print(f"provider={args.provider} count={len(records)} dimensions={len(records[0][1]) if records else 0}")
    print(f"embed_ms_avg={statistics.fmean(timings) * 1000:.2f}")
    print(f"embed_ms_min={min(timings) * 1000:.2f} embed_ms_max={max(timings) * 1000:.2f}")

    if args.sqlite_db is not None and records:
        factory = create_session_factory(sqlite_url(args.sqlite_db))
        index = SQLiteVecSearchIndex(
            factory,
            BenchmarkClock(),
            dimensions=len(records[0][1]),
            prefer_sqlite_vec=not args.force_fallback,
        )
        start = time.perf_counter()
        for record, vector in records:
            await index.index_embedding_vector(record, vector)
        insert_elapsed = time.perf_counter() - start

        start = time.perf_counter()
        hits = await index.search_vectors(records[0][1], limit=min(args.limit, args.count))
        search_elapsed = time.perf_counter() - start
        print(f"vector_insert_ms_total={insert_elapsed * 1000:.2f}")
        print(f"vector_search_ms={search_elapsed * 1000:.2f} hits={len(hits)} sqlite_vec={index.using_sqlite_vec}")


def _provider(args: argparse.Namespace) -> MockEmbeddingProvider | JinaOmniNanoGgufAdapter:
    if args.provider == "mock":
        return MockEmbeddingProvider(dimensions=args.dimensions)
    if args.model_path is None:
        raise SystemExit("--model-path is required for --provider jina")
    return JinaOmniNanoGgufAdapter(
        model_path=args.model_path,
        endpoint_url=args.endpoint_url,
        dimensions=args.dimensions,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Time local embedding providers and optional SQLite vector search.")
    parser.add_argument("--provider", choices=("mock", "jina"), default="mock")
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--dimensions", type=int, default=768)
    parser.add_argument("--text", default="Contrato de arrendamiento con firma")
    parser.add_argument("--model-path", type=Path)
    parser.add_argument("--endpoint-url", default="http://127.0.0.1:8080/v1/embeddings")
    parser.add_argument("--sqlite-db", type=Path)
    parser.add_argument("--force-fallback", action="store_true")
    parser.add_argument("--limit", type=int, default=5)
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(main())
