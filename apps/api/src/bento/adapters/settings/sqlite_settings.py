from __future__ import annotations

import json
from dataclasses import dataclass, field

from sqlalchemy import select, update
from sqlalchemy.orm import Session, sessionmaker

from bento.domain.indexing import IndexProviderState
from bento.domain.errors import SettingsRevisionConflictError, ValidationFailedError
from bento.domain.settings import PersistedSettings, PublicSettings, SecretReferenceMutation, WorkerStatus
from bento.domain.settings_registry import SETTINGS_BY_KEY
from bento.domain.storage import StorageBackend
from bento.infrastructure.db.engine import session_scope
from bento.infrastructure.db.models import SettingModel, SettingSecretReferenceModel, SettingsMetaModel
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

    async def load(self) -> PersistedSettings:
        with session_scope(self._session_factory) as session:
            values = {setting.key: setting.value for setting in session.scalars(select(SettingModel))}
            meta = session.get(SettingsMetaModel, 1)
            references = {
                item.key: SecretReferenceMutation(reference=item.reference, configured=item.configured)
                for item in session.scalars(select(SettingSecretReferenceModel))
            }
        return PersistedSettings(
            revision=meta.revision if meta is not None else 0,
            values=values,
            secret_references=references,
        )

    async def compare_and_set(
        self,
        *,
        expected_revision: int,
        values: dict[str, str],
        secret_references: dict[str, SecretReferenceMutation],
    ) -> PersistedSettings:
        secret_value_keys = [key for key in values if SETTINGS_BY_KEY.get(key) and SETTINGS_BY_KEY[key].secret]
        if secret_value_keys:
            raise ValidationFailedError("Secret plaintext cannot be stored", {"keys": sorted(secret_value_keys)})
        invalid_reference_keys = [
            key
            for key, mutation in secret_references.items()
            if key not in SETTINGS_BY_KEY
            or not SETTINGS_BY_KEY[key].secret
            or (mutation.configured and not (mutation.reference or "").startswith(("secure:", "desktop-secret:")))
            or (not mutation.configured and mutation.reference is not None)
        ]
        if invalid_reference_keys:
            raise ValidationFailedError("Invalid secret reference", {"keys": sorted(invalid_reference_keys)})
        now = self._clock.now()
        with session_scope(self._session_factory) as session:
            meta = session.get(SettingsMetaModel, 1)
            current_revision = meta.revision if meta is not None else 0
            if meta is None:
                session.add(SettingsMetaModel(id=1, revision=0, updated_at=now))
                session.flush()
            claimed = session.execute(
                update(SettingsMetaModel)
                .where(SettingsMetaModel.id == 1, SettingsMetaModel.revision == expected_revision)
                .values(revision=expected_revision + 1, updated_at=now)
            )
            if claimed.rowcount != 1:
                current = session.get(SettingsMetaModel, 1)
                raise SettingsRevisionConflictError(
                    expected_revision=expected_revision,
                    current_revision=current.revision if current is not None else current_revision,
                )
            for key, value in values.items():
                session.merge(SettingModel(key=key, value=value, updated_at=now))
            for key, mutation in secret_references.items():
                if mutation.configured:
                    session.merge(
                        SettingSecretReferenceModel(
                            key=key,
                            reference=mutation.reference,
                            configured=True,
                            updated_at=now,
                        )
                    )
                else:
                    existing = session.get(SettingSecretReferenceModel, key)
                    if existing is not None:
                        session.delete(existing)
        return await self.load()

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
        if SETTINGS_BY_KEY.get(key) and SETTINGS_BY_KEY[key].secret:
            raise ValidationFailedError("Secret plaintext cannot be stored", {"keys": [key]})
        now = self._clock.now()
        with session_scope(self._session_factory) as session:
            session.merge(SettingModel(key=key, value=value, updated_at=now))


def _enum_value(enum_type: type, raw: str | None, default: object) -> object:
    if raw is None:
        return default
    try:
        return enum_type(_stored_value(raw))
    except ValueError:
        return default


def _bool_value(raw: str | None, default: bool) -> bool:
    if raw is None:
        return default
    value = _stored_value(raw)
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _int_value(raw: str | None, default: int) -> int:
    if raw is None:
        return default
    try:
        return int(_stored_value(raw))
    except (TypeError, ValueError):
        return default


def _data_paths(values: dict[str, str], defaults: dict[str, str]) -> dict[str, str]:
    paths = dict(defaults)
    prefix = "data_path."
    for key, value in values.items():
        if key.startswith(prefix):
            paths[key.removeprefix(prefix)] = str(_stored_value(value))
    return paths


def _stored_value(raw: str) -> object:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw
