from __future__ import annotations

from typing import Protocol

from bento.domain.settings import PersistedSettings, PublicSettings, SecretReferenceMutation


class SettingsRepositoryPort(Protocol):
    async def load(self) -> PersistedSettings: ...

    async def compare_and_set(
        self,
        *,
        expected_revision: int,
        values: dict[str, str],
        secret_references: dict[str, SecretReferenceMutation],
    ) -> PersistedSettings: ...

    async def get_public_settings(self) -> PublicSettings: ...

    async def set_value(self, key: str, value: str) -> None: ...
