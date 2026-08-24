from __future__ import annotations

import argparse
import asyncio
import contextlib
import io
import json
import multiprocessing
import os
import shutil
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import URL

from bento.infrastructure.settings import Settings, get_settings, settings_database_path


def main(argv: Sequence[str] | None = None) -> int:
    multiprocessing.freeze_support()
    arguments = _parser().parse_args(argv)
    if arguments.command == "api":
        return _run_api(arguments)
    if arguments.command == "worker":
        return _run_worker()
    if arguments.command == "migrate":
        return _run_migrations()
    if arguments.command == "probe":
        return _run_probe(arguments)
    raise AssertionError(f"Unhandled command: {arguments.command}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bento-sidecar")
    subparsers = parser.add_subparsers(dest="command", required=True)

    api = subparsers.add_parser("api", help="run the local Bento API")
    api.add_argument("--host", help=argparse.SUPPRESS)
    api.add_argument("--port", type=int)
    subparsers.add_parser("worker", help="run the Bento background worker")
    subparsers.add_parser("migrate", help="upgrade the local database schema")

    probe = subparsers.add_parser("probe", help="run one bounded, secret-free capability probe")
    probe.add_argument(
        "kind",
        choices=("runtime", "writable-directory", "model-file", "ffmpeg", "ocr", "telegram"),
    )
    probe.add_argument("--path")
    return parser


def _run_api(arguments: argparse.Namespace) -> int:
    import uvicorn

    from bento.interfaces.http.main import create_app

    settings = get_settings()
    host = arguments.host or settings.host
    if settings.runtime_mode == "desktop" and host not in {"127.0.0.1", "::1"}:
        raise SystemExit("desktop API must bind to an explicit loopback address")
    port = arguments.port if arguments.port is not None else settings.api_port
    if not 1 <= port <= 65535:
        raise SystemExit("API port must be between 1 and 65535")
    uvicorn.run(create_app(settings), host=host, port=port, reload=False, access_log=False)
    return 0


def _run_worker() -> int:
    from bento.interfaces.worker.main import main as worker_main

    worker_main()
    return 0


def _run_migrations() -> int:
    settings = get_settings()
    database_path = settings_database_path(settings)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    config = Config(str(_bundle_root() / "alembic.ini"))
    config.set_main_option("script_location", str(_bundle_root() / "migrations"))
    config.set_main_option(
        "sqlalchemy.url",
        URL.create("sqlite+pysqlite", database=str(database_path)).render_as_string(hide_password=False),
    )
    command.upgrade(config, "head")
    return 0


def _run_probe(arguments: argparse.Namespace) -> int:
    settings = get_settings()
    probe = arguments.kind
    if probe == "runtime":
        result = {"probe": probe, "status": "ok", "version": settings.app_version}
    elif probe == "writable-directory":
        path = Path(arguments.path or settings.data_dir)
        result = _probe_writable_directory(path)
    elif probe == "model-file":
        path = Path(arguments.path or settings.jina_model_path)
        result = _probe_model_file(path)
    elif probe == "ffmpeg":
        result = _probe_ffmpeg()
    elif probe == "ocr":
        result = _probe_ocr()
    else:
        result = asyncio.run(_probe_telegram(settings))
    print(json.dumps(result, sort_keys=True, separators=(",", ":")), flush=True)
    return 0 if result["status"] == "ok" else 1


def _probe_writable_directory(path: Path) -> dict[str, str]:
    try:
        resolved = path.expanduser().resolve()
        if resolved == Path(resolved.anchor):
            return _failed("writable-directory", "unsafe_path")
        resolved.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_path = tempfile.mkstemp(prefix=".bento-write-probe-", dir=resolved)
        os.close(descriptor)
        Path(temporary_path).unlink()
    except OSError:
        return _failed("writable-directory", "not_writable")
    return {"probe": "writable-directory", "status": "ok"}


def _probe_model_file(path: Path) -> dict[str, str]:
    try:
        available = path.expanduser().resolve().is_file() and os.access(path, os.R_OK)
    except OSError:
        available = False
    return {"probe": "model-file", "status": "ok"} if available else _failed("model-file", "not_readable")


def _probe_ffmpeg() -> dict[str, str]:
    available = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
    return {"probe": "ffmpeg", "status": "ok"} if available else _failed("ffmpeg", "not_available")


def _probe_ocr() -> dict[str, str]:
    try:
        # RapidOCR logs engine and model paths during construction; one-shot probe
        # stdout is reserved for the fixed JSON contract and must not expose them.
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            from rapidocr import RapidOCR

            RapidOCR()
    except Exception:
        return _failed("ocr", "not_available")
    return {"probe": "ocr", "status": "ok"}


async def _probe_telegram(settings: Settings) -> dict[str, str]:
    if not settings.telegram_configured:
        return _failed("telegram", "not_configured")
    try:
        from bento.infrastructure.storage.factory import create_blob_store

        connected = await create_blob_store(settings).probe()
    except Exception:  # External failures are intentionally reduced to a fixed, non-sensitive code.
        connected = False
    return {"probe": "telegram", "status": "ok"} if connected else _failed("telegram", "connection_failed")


def _failed(probe: str, code: str) -> dict[str, str]:
    return {"probe": probe, "status": "failed", "code": code}


def _bundle_root() -> Path:
    frozen_root = getattr(sys, "_MEIPASS", None)
    if frozen_root is not None:
        return Path(frozen_root)
    return Path(__file__).resolve().parents[4]


if __name__ == "__main__":
    raise SystemExit(main())
