from __future__ import annotations

import logging
from dataclasses import dataclass

from bento.application.media import MediaProcessingService
from bento.domain.jobs import Job, JobStatus, JobType
from bento.ports.jobs import JobQueuePort
from bento.ports.repositories import ClockPort


LOGGER = logging.getLogger("bento.worker.dispatch")


@dataclass(frozen=True, slots=True)
class WorkerDispatcher:
    jobs: JobQueuePort
    media: MediaProcessingService
    clock: ClockPort
    worker_id: str

    async def process_one(self) -> bool:
        job = await self.jobs.claim_next(self.worker_id)
        if job is None:
            return False
        try:
            await self._handle(job)
        except Exception as exc:
            safe_error = _safe_error(exc)
            LOGGER.warning("Job %s failed: %s", job.id, safe_error)
            await self.jobs.save(job.fail(safe_error, self.clock.now()))
        else:
            await self.jobs.save(job.complete(self.clock.now()))
        return True

    async def _handle(self, job: Job) -> None:
        if job.type in {JobType.THUMBNAIL, JobType.PDF_THUMBNAIL, JobType.VIDEO_THUMBNAIL}:
            asset_id = job.asset_id or _payload_asset_id(job)
            await self.media.process_asset_media(asset_id)
            return
        raise RuntimeError(f"No handler registered for job type {job.type.value}")


def _payload_asset_id(job: Job) -> str:
    asset_id = job.payload.get("asset_id")
    if isinstance(asset_id, str) and asset_id:
        return asset_id
    raise RuntimeError("Media job missing asset_id")


def _safe_error(exc: Exception) -> str:
    message = str(exc) or exc.__class__.__name__
    return " ".join(message.split())[:500]
