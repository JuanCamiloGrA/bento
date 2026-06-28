from __future__ import annotations

from dataclasses import dataclass

from bento.domain.errors import JobNotFoundError
from bento.domain.jobs import Job
from bento.ports.jobs import JobQueuePort
from bento.ports.repositories import ClockPort


@dataclass(frozen=True, slots=True)
class ListJobsQuery:
    cursor: str | None = None
    limit: int = 50


@dataclass(frozen=True, slots=True)
class ListJobsResult:
    items: tuple[Job, ...]
    next_cursor: str | None


class JobsUseCases:
    def __init__(self, *, jobs: JobQueuePort, clock: ClockPort) -> None:
        self._jobs = jobs
        self._clock = clock

    async def list_jobs(self, query: ListJobsQuery) -> ListJobsResult:
        items, next_cursor = await self._jobs.list(cursor=query.cursor, limit=query.limit)
        return ListJobsResult(items=items, next_cursor=next_cursor)

    async def retry_failed_job(self, job_id: str) -> Job:
        job = await self._jobs.get(job_id)
        if job is None:
            raise JobNotFoundError(job_id)
        updated = job.retry(self._clock.now())
        await self._jobs.save(updated)
        return updated
