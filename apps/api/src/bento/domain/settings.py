from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from bento.domain.indexing import IndexProviderState
from bento.domain.storage import StorageBackend


class WorkerStatus(StrEnum):
    STOPPED = "stopped"
    RUNNING = "running"
    DEGRADED = "degraded"


@dataclass(frozen=True, slots=True)
class PublicSettings:
    storage_backend: StorageBackend
    telegram_configured: bool
    ocr_state: IndexProviderState
    embeddings_state: IndexProviderState
    model_available: bool
    worker_status: WorkerStatus
    worker_concurrency: int
    data_paths: dict[str, str]
