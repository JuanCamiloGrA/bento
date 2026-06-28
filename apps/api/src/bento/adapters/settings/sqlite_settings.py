from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from bento.domain.indexing import IndexProviderState
from bento.domain.settings import PublicSettings, WorkerStatus
from bento.domain.storage import StorageBackend
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import SettingModel
from bento.ports.repositories import ClockPort


@dataclass(frozen=True, slots=True)
class SettingsDefaults:
    storage_backend: StorageBackend = StorageBackend.LOCAL
    telegram_configured: bool = False
    ocr_state: IndexProviderState = IndexProviderState.DISABLED
    embeddings_state: IndexProviderState = IndexProviderState.DISABLED
    model_available: bool = False
    worker_status: WorkerStatus = WorkerStatus.STOPPED
    worker_concurrency: int = 1
    data_paths: dict[str, str] = field(default_factory=dict)


class SQLiteSettingsRepository:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        clock: ClockPort,
        defaults: SettingsDefaults | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._clock = clock
        self._defaults = defaults or SettingsDefaults()

    async def get_public_settings(self) -> PublicSettings:
        with session_scope(self._session_factory) as session:
            values = {setting.key: setting.value for setting in session.scalars(select(SettingModel))}

        return PublicSettings(
            storage_backend=_enum_value(
                StorageBackend,
                values.get("storage_backend"),
                self._defaults.storage_backend,
            ),
            telegram_configured=_bool_value(values.get("telegram_configured"), self._defaults.telegram_configured),
            ocr_state=_enum_value(IndexProviderState, values.get("ocr_state"), self._defaults.ocr_state),
            embeddings_state=_enum_value(
                IndexProviderState,
                values.get("embeddings_state"),
                self._defaults.embeddings_state,
            ),
            model_available=_bool_value(values.get("model_available"), self._defaults.model_available),
            worker_status=_enum_value(WorkerStatus, values.get("worker_status"), self._defaults.worker_status),
            worker_concurrency=_int_value(values.get("worker_concurrency"), self._defaults.worker_concurrency),
            data_paths=_data_paths(values, self._defaults.data_paths),
        )

    async def set_value(self, key: str, value: str) -> None:
        now = self._clock.now()
        with session_scope(self._session_factory) as session:
            session.merge(SettingModel(key=key, value=value, updated_at=now))


def _enum_value(enum_type: type, raw: str | None, default: object) -> object:
    if raw is None:
        return default
    try:
        return enum_type(raw)
    except ValueError:
        return default


def _bool_value(raw: str | None, default: bool) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int_value(raw: str | None, default: int) -> int:
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _data_paths(values: dict[str, str], defaults: dict[str, str]) -> dict[str, str]:
    paths = dict(defaults)
    prefix = "data_path."
    for key, value in values.items():
        if key.startswith(prefix):
            paths[key.removeprefix(prefix)] = value
    return paths
