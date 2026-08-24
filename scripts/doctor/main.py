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
from typing import Mapping

from dotenv import dotenv_values
from pydantic import ValidationError

from bento.domain.settings_registry import SETTINGS_BY_KEY, SETTINGS_REGISTRY
from bento.infrastructure.settings import Settings, load_effective_settings


REQUIRED_DATA_DIRS = ("db", "cache", "uploads", "models", "journal", "config")


@dataclass(frozen=True, slots=True)
class Check:
    detail: str
    name: str
    status: str


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    try:
        settings = _load_settings(root)
    except ValidationError as exc:
        detail = _validation_detail(exc)
        print(f"[FAIL] settings registry: {detail}")
        raise SystemExit("Doctor failed: settings registry") from None

    data_dir = _resolve_path(root, settings.data_dir)
    checks = [
        _check_settings_registry(settings),
        _check_data_dirs(data_dir),
        _check_writable(data_dir),
        _check_db_migrated(data_dir),
        _check_docker_compose(root, settings),
        _check_ffmpeg(),
        _check_model(root, data_dir, settings),
        _check_telegram(settings),
    ]

    failures = [check for check in checks if check.status == "fail"]
    for check in checks:
        print(f"[{check.status.upper()}] {check.name}: {check.detail}")
    if failures:
        names = ", ".join(check.name for check in failures)
        raise SystemExit(f"Doctor failed: {names}")
    print(f"Doctor passed: STORAGE_BACKEND={settings.storage_backend}.")


def _load_settings(root: Path, environ: Mapping[str, str] | None = None) -> Settings:
    values: dict[str, str] = {}
    for filename in (".env.example", ".env"):
        path = root / filename
        if path.is_file():
            layer = {key: value for key, value in dotenv_values(path).items() if value is not None}
            _overlay_registered(values, layer)
    process_environment = environ if environ is not None else os.environ
    _overlay_registered(values, process_environment)

    runtime_mode = values.get("BENTO_RUNTIME_MODE", "headless")
    bootstrap: dict[str, str] = {"runtime_mode": runtime_mode}
    for alias, key in (("DATA_DIR", "data_dir"), ("HOST", "host"), ("API_PORT", "api_port"), ("WEB_PORT", "web_port")):
        if alias in values:
            bootstrap[key] = values[alias]
    return load_effective_settings(Settings(_env_file=None, **bootstrap), environ=values)


def _overlay_registered(target: dict[str, str], layer: Mapping[str, str]) -> None:
    for definition in SETTINGS_REGISTRY:
        present = [alias for alias in definition.env_aliases if alias in layer]
        if not present:
            continue
        for alias in definition.env_aliases:
            target.pop(alias, None)
        target.update({alias: layer[alias] for alias in present})


def _validation_detail(exc: ValidationError) -> str:
    fields = sorted({str(error["loc"][-1]) for error in exc.errors(include_input=False) if error["loc"]})
    return f"invalid fields: {', '.join(fields)}" if fields else "configuration is invalid"


def _check_settings_registry(settings: Settings) -> Check:
    snapshot = settings.effective_snapshot
    if snapshot is None or set(snapshot.values) != set(SETTINGS_BY_KEY):
        return Check(name="settings registry", status="fail", detail="effective settings do not match the canonical registry")
    return Check(
        name="settings registry",
        status="pass",
        detail=f"loaded {len(SETTINGS_REGISTRY)} canonical definitions for {settings.runtime_mode} mode",
    )


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


def _check_docker_compose(root: Path, settings: Settings) -> Check:
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
        return Check(name="docker compose", status="warn", detail=_redact_secrets(detail, settings))
    return Check(name="docker compose", status="pass", detail="compose file is valid")


def _check_ffmpeg() -> Check:
    if shutil.which("ffmpeg") is None:
        return Check(name="ffmpeg", status="warn", detail="ffmpeg not found; video thumbnails will be unavailable")
    return Check(name="ffmpeg", status="pass", detail="ffmpeg is available")


def _check_model(root: Path, data_dir: Path, settings: Settings) -> Check:
    provider = settings.embeddings_provider
    if provider == "disabled":
        return Check(name="embedding model", status="pass", detail="embeddings disabled")
    model_path = _resolve_model_path(root, data_dir, settings.jina_model_path)
    if model_path.is_file():
        return Check(name="embedding model", status="pass", detail=f"{provider} model is present")
    return Check(name="embedding model", status="fail", detail=f"{provider} model missing at {model_path}")


def _check_telegram(settings: Settings) -> Check:
    if settings.storage_backend != "telegram":
        return Check(name="telegram config", status="pass", detail="local storage mode does not require Telegram")
    telegram_secrets = (definition for definition in SETTINGS_REGISTRY if definition.group == "telegram" and definition.secret)
    missing = [definition.env_aliases[0] for definition in telegram_secrets if not _configured(settings, definition.key)]
    if settings.encryption_mode != "aes_gcm":
        missing.append("ENCRYPTION_MODE=aes_gcm")
    if not _configured(settings, "bento_encryption_key"):
        missing.append(SETTINGS_BY_KEY["bento_encryption_key"].env_aliases[0])
    if missing:
        return Check(name="telegram config", status="fail", detail=f"missing {', '.join(missing)}")
    webhook_secret = settings.telegram_webhook_secret
    if webhook_secret is not None and re.fullmatch(r"[A-Za-z0-9_-]{32,256}", webhook_secret) is None:
        alias = SETTINGS_BY_KEY["telegram_webhook_secret"].env_aliases[0]
        return Check(name="telegram config", status="fail", detail=f"{alias} has invalid format")
    encoded_key = settings.bento_encryption_key
    if encoded_key is not None:
        try:
            key = base64.urlsafe_b64decode(encoded_key + "=" * (-len(encoded_key) % 4))
        except (ValueError, binascii.Error):
            key = b""
        if len(key) != 32:
            alias = SETTINGS_BY_KEY["bento_encryption_key"].env_aliases[0]
            return Check(name="telegram config", status="fail", detail=f"{alias} must decode to 32 bytes")
    return Check(name="telegram config", status="pass", detail="telegram mode has required settings")


def _configured(settings: Settings, key: str) -> bool:
    value = getattr(settings, key, None)
    if value is not None and bool(str(value).strip()):
        return True
    if settings.runtime_mode != "desktop" or settings.effective_snapshot is None:
        return False
    effective = settings.effective_snapshot.values.get(key)
    return bool(effective and effective.configured)


def _redact_secrets(detail: str, settings: Settings) -> str:
    redacted = detail
    for definition in SETTINGS_REGISTRY:
        if not definition.secret:
            continue
        value = getattr(settings, definition.key, None)
        if value is not None and str(value):
            redacted = redacted.replace(str(value), "[REDACTED]")
    return redacted


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
