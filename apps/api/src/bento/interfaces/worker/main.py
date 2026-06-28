import asyncio
import logging
import os
import signal
from pathlib import Path

from bento.adapters.jobs import SQLiteJobQueue
from bento.adapters.manifest import SQLiteManifestJournal
from bento.adapters.media import LocalBlobPathResolver, LocalMediaGenerator, SQLiteBlobRefCatalog, SQLiteThumbnailCatalog
from bento.adapters.repositories import SQLiteAssetRepository
from bento.application.media import MediaProcessingService
from bento.infrastructure.db.clock import SystemClock
from bento.infrastructure.db.engine import create_session_factory, sqlite_url
from bento.infrastructure.settings import get_settings
from bento.infrastructure.storage.factory import create_blob_store
from bento.interfaces.worker.dispatch import WorkerDispatcher

LOGGER = logging.getLogger("bento.worker")


async def run_worker(stop_event: asyncio.Event | None = None) -> None:
    settings = get_settings()
    LOGGER.info(
        "Worker started in %s mode with concurrency=%s",
        settings.storage_backend,
        settings.worker_concurrency,
    )
    event = stop_event or asyncio.Event()
    dispatcher = _create_dispatcher(worker_id=f"worker-{os.getpid()}")
    while not event.is_set():
        processed = await dispatcher.process_one()
        if processed:
            continue
        try:
            await asyncio.wait_for(event.wait(), timeout=1.0)
        except TimeoutError:
            continue


def _create_dispatcher(worker_id: str) -> WorkerDispatcher:
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    clock = SystemClock()
    session_factory = create_session_factory(sqlite_url(data_dir / "db" / "bento.sqlite3"))
    jobs = SQLiteJobQueue(session_factory, clock)
    assets = SQLiteAssetRepository(session_factory)
    blob_refs = SQLiteBlobRefCatalog(session_factory, clock)
    thumbnails = SQLiteThumbnailCatalog(session_factory, clock, blob_refs)
    manifest = SQLiteManifestJournal(session_factory, clock, data_dir / "journal")
    media = MediaProcessingService(
        assets=assets,
        blob_refs=blob_refs,
        thumbnails=thumbnails,
        blob_store=create_blob_store(settings),
        resolver=LocalBlobPathResolver(data_dir / "uploads"),
        generator=LocalMediaGenerator(data_dir / "cache" / "media"),
        manifest=manifest,
        clock=clock,
    )
    return WorkerDispatcher(jobs=jobs, media=media, clock=clock, worker_id=worker_id)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    stop_event = asyncio.Event()

    for signal_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, signal_name, None)
        if sig is not None:
            try:
                loop.add_signal_handler(sig, stop_event.set)
            except NotImplementedError:
                pass

    try:
        loop.run_until_complete(run_worker(stop_event))
    finally:
        loop.close()


if __name__ == "__main__":
    main()
