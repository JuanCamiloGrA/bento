from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from bento.adapters.jobs import SQLiteJobQueue
from bento.domain.errors import JobNotRetryableError
from bento.domain.jobs import JobStatus, JobType
from bento.infrastructure.db.engine import create_session_factory, sqlite_url


@dataclass
class MutableClock:
    current: datetime = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current

    def advance(self, delta: timedelta) -> None:
        self.current += delta


def _queue(tmp_path: Path, clock: MutableClock) -> SQLiteJobQueue:
    db_path = tmp_path / "jobs.sqlite3"
    api_root = Path(__file__).parents[3]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    config.set_main_option("sqlalchemy.url", sqlite_url(db_path))
    command.upgrade(config, "head")
    return SQLiteJobQueue(create_session_factory(sqlite_url(db_path)), clock)


def test_job_queue_claims_by_priority_and_locks_running_job(tmp_path: Path) -> None:
    async def scenario() -> None:
        clock = MutableClock()
        queue = _queue(tmp_path, clock)
        await queue.enqueue(type=JobType.OCR, priority=3, payload={"asset_id": "asset_1"})
        fast = await queue.enqueue(type=JobType.THUMBNAIL, priority=1, payload={"asset_id": "asset_2"})

        claimed = await queue.claim_next("worker_a")
        assert claimed is not None
        assert claimed.id == fast.id
        assert claimed.status == JobStatus.RUNNING
        assert claimed.locked_by == "worker_a"

        next_claim = await queue.claim_next("worker_b")
        assert next_claim is not None
        assert next_claim.id != claimed.id
        assert await queue.claim_next("worker_b") is None

        completed = await queue.complete(claimed.id)
        assert completed is not None
        assert completed.status == JobStatus.SUCCEEDED
        assert completed.locked_by is None

    asyncio.run(scenario())


def test_job_queue_retry_backoff_and_max_attempts(tmp_path: Path) -> None:
    async def scenario() -> None:
        clock = MutableClock()
        queue = _queue(tmp_path, clock)
        job = await queue.enqueue(type=JobType.OCR, priority=3, payload={}, max_attempts=2)

        claimed = await queue.claim_next("worker_a")
        assert claimed is not None
        first_failure = await queue.fail(claimed.id, "ocr failed")
        assert first_failure is not None
        assert first_failure.status == JobStatus.RETRYING
        assert first_failure.attempts == 1
        assert first_failure.run_after is not None

        assert await queue.claim_next("worker_a") is None
        clock.advance(timedelta(seconds=31))
        retry_claim = await queue.claim_next("worker_a")
        assert retry_claim is not None
        assert retry_claim.id == job.id
        assert retry_claim.attempts == 1

        final_failure = await queue.fail(retry_claim.id, "still failed")
        assert final_failure is not None
        assert final_failure.status == JobStatus.FAILED
        assert final_failure.attempts == 2
        assert final_failure.error == "still failed"

        with pytest.raises(JobNotRetryableError):
            await queue.retry(final_failure.id)

    asyncio.run(scenario())
