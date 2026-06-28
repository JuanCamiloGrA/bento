import asyncio
import logging
import signal

from bento.infrastructure.settings import get_settings

LOGGER = logging.getLogger("bento.worker")


async def run_worker(stop_event: asyncio.Event | None = None) -> None:
    settings = get_settings()
    LOGGER.info(
        "Worker started in %s mode with concurrency=%s",
        settings.storage_backend,
        settings.worker_concurrency,
    )
    event = stop_event or asyncio.Event()
    await event.wait()


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