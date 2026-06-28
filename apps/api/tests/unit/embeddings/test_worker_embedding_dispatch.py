from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from bento.domain.jobs import Job, JobStatus, JobType
from bento.interfaces.worker.dispatch import WorkerDispatcher

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_worker_dispatcher_handles_embedding_job() -> None:
    async def scenario() -> None:
        job = Job(
            id="job_1",
            type=JobType.EMBEDDING,
            status=JobStatus.RUNNING,
            priority=4,
            payload={"asset_id": "asset_1"},
            attempts=0,
            max_attempts=3,
            asset_id=None,
            created_at=NOW,
            updated_at=NOW,
        )
        jobs = FakeJobs(job)
        embedding = FakeEmbeddingService()
        dispatcher = WorkerDispatcher(
            jobs=jobs,
            media=FakeMedia(),
            clock=FakeClock(),
            worker_id="worker_1",
            embedding=embedding,
        )

        assert await dispatcher.process_one() is True

        assert embedding.asset_ids == ["asset_1"]
        assert jobs.saved[-1].status == JobStatus.SUCCEEDED

    asyncio.run(scenario())


@dataclass
class FakeClock:
    def now(self) -> datetime:
        return NOW


@dataclass
class FakeJobs:
    job: Job
    saved: list[Job] = field(default_factory=list)
    claimed: bool = False

    async def enqueue(self, **kwargs: Any) -> Job:
        raise AssertionError(kwargs)

    async def get(self, job_id: str) -> Job | None:
        del job_id
        return None

    async def list(self, *, cursor: str | None = None, limit: int = 50) -> tuple[tuple[Job, ...], str | None]:
        del cursor, limit
        return (), None

    async def claim_next(self, worker_id: str) -> Job | None:
        del worker_id
        if self.claimed:
            return None
        self.claimed = True
        return self.job

    async def save(self, job: Job) -> None:
        self.saved.append(job)

    async def complete(self, job_id: str) -> Job | None:
        del job_id
        return None

    async def fail(self, job_id: str, error: str) -> Job | None:
        del job_id, error
        return None

    async def retry(self, job_id: str) -> Job:
        del job_id
        raise AssertionError("retry was not expected")


class FakeMedia:
    async def process_asset_media(self, asset_id: str) -> tuple[Any, ...]:
        raise AssertionError(asset_id)


@dataclass
class FakeEmbeddingService:
    asset_ids: list[str] = field(default_factory=list)

    async def process_asset_embedding(self, asset_id: str) -> None:
        self.asset_ids.append(asset_id)
