from __future__ import annotations

import base64
import binascii
import os
import re
import shutil
import sqlite3
import subprocess
from dataclasses import dataclass
from pathlib import Path

REQUIRED_DATA_DIRS = ("db", "cache", "uploads", "models", "journal", "config")
TELEGRAM_REQUIRED_KEYS = (
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_API_ID",
    "TELEGRAM_API_HASH",
    "TELEGRAM_RAW_CHAT_ID",
    "TELEGRAM_THUMBS_CHAT_ID",
    "TELEGRAM_JOURNAL_CHAT_ID",
    "TELEGRAM_WEBHOOK_SECRET",
)


@dataclass(frozen=True, slots=True)
class Check:
    detail: str
    name: str
    status: str


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    env = _load_environment(root)
    data_dir = _resolve_path(root, env.get("DATA_DIR", "./data"))
    checks = [
        _check_data_dirs(data_dir),
        _check_writable(data_dir),
        _check_db_migrated(data_dir),
        _check_docker_compose(root),
        _check_ffmpeg(),
        _check_model(root, data_dir, env),
        _check_telegram(env),
    ]

    failures = [check for check in checks if check.status == "fail"]
    for check in checks:
        print(f"[{check.status.upper()}] {check.name}: {check.detail}")
    if failures:
        names = ", ".join(check.name for check in failures)
        raise SystemExit(f"Doctor failed: {names}")
    print(f"Doctor passed: STORAGE_BACKEND={env.get('STORAGE_BACKEND', 'local')}.")


def _load_environment(root: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for filename in (".env.example", ".env"):
        path = root / filename
        if path.is_file():
            values.update(_parse_env_file(path))
    values.update({key: value for key, value in os.environ.items() if key in values or key.startswith("TELEGRAM_")})
    return values


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _check_data_dirs(data_dir: Path) -> Check:
    missing = [name for name in REQUIRED_DATA_DIRS if not (data_dir / name).is_dir()]
    if missing:
        return Check(name="data directories", status="fail", detail=f"missing {', '.join(missing)}; run make setup")
    return Check(name="data directories", status="pass", detail=str(data_dir))


def _check_writable(data_dir: Path) -> Check:
    try:
        for child in REQUIRED_DATA_DIRS:
            probe = data_dir / child / ".doctor-write-test"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
    except OSError as exc:
        return Check(name="writable volumes", status="fail", detail=str(exc))
    return Check(name="writable volumes", status="pass", detail="all data directories are writable")


def _check_db_migrated(data_dir: Path) -> Check:
    db_path = data_dir / "db" / "bento.sqlite3"
    if not db_path.is_file():
        return Check(name="database migration", status="fail", detail="missing data/db/bento.sqlite3; run make setup")
    try:
        with sqlite3.connect(db_path) as connection:
            version = connection.execute("select version_num from alembic_version").fetchone()
    except sqlite3.Error as exc:
        return Check(name="database migration", status="fail", detail=f"cannot read alembic_version: {exc}")
    if not version:
        return Check(name="database migration", status="fail", detail="alembic_version is empty")
    return Check(name="database migration", status="pass", detail=f"current revision {version[0]}")


def _check_docker_compose(root: Path) -> Check:
    docker = shutil.which("docker")
    if docker is None:
        return Check(name="docker compose", status="warn", detail="docker CLI not found; Compose smoke cannot run here")
    result = subprocess.run(
        [docker, "compose", "config", "--quiet"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip() or "docker compose config failed"
        return Check(name="docker compose", status="warn", detail=detail)
    return Check(name="docker compose", status="pass", detail="compose file is valid")


def _check_ffmpeg() -> Check:
    if shutil.which("ffmpeg") is None:
        return Check(name="ffmpeg", status="warn", detail="ffmpeg not found; video thumbnails will be unavailable")
    return Check(name="ffmpeg", status="pass", detail="ffmpeg is available")


def _check_model(root: Path, data_dir: Path, env: dict[str, str]) -> Check:
    provider = env.get("EMBEDDINGS_PROVIDER", "disabled")
    if provider == "disabled":
        return Check(name="embedding model", status="pass", detail="embeddings disabled")
    model_path = _resolve_model_path(root, data_dir, env.get("JINA_MODEL_PATH", "./data/models/jina-v5-omni-nano.gguf"))
    if model_path.is_file():
        return Check(name="embedding model", status="pass", detail=f"{provider} model is present")
    return Check(name="embedding model", status="fail", detail=f"{provider} model missing at {model_path}")


def _check_telegram(env: dict[str, str]) -> Check:
    storage_backend = env.get("STORAGE_BACKEND", "local")
    if storage_backend != "telegram":
        return Check(name="telegram config", status="pass", detail="local storage mode does not require Telegram")
    missing = [key for key in TELEGRAM_REQUIRED_KEYS if not env.get(key, "").strip()]
    if env.get("ENCRYPTION_MODE", "none") != "aes_gcm":
        missing.append("ENCRYPTION_MODE=aes_gcm")
    if not env.get("BENTO_ENCRYPTION_KEY", "").strip():
        missing.append("BENTO_ENCRYPTION_KEY")
    if missing:
        return Check(name="telegram config", status="fail", detail=f"missing {', '.join(missing)}")
    webhook_secret = env["TELEGRAM_WEBHOOK_SECRET"].strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{32,256}", webhook_secret) is None:
        return Check(name="telegram config", status="fail", detail="TELEGRAM_WEBHOOK_SECRET has invalid format")
    encoded_key = env["BENTO_ENCRYPTION_KEY"].strip()
    try:
        key = base64.urlsafe_b64decode(encoded_key + "=" * (-len(encoded_key) % 4))
    except (ValueError, binascii.Error):
        key = b""
    if len(key) != 32:
        return Check(name="telegram config", status="fail", detail="BENTO_ENCRYPTION_KEY must decode to 32 bytes")
    return Check(name="telegram config", status="pass", detail="telegram mode has required settings")


def _resolve_path(root: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (root / path).resolve()


def _resolve_model_path(root: Path, data_dir: Path, value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    if path.parts and path.parts[0] == "data":
        return (root / path).resolve()
    return (data_dir / path).resolve()


if __name__ == "__main__":
    main()
