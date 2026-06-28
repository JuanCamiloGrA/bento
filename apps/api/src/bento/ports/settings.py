from __future__ import annotations

from typing import Protocol

from bento.domain.settings import PublicSettings


class SettingsRepositoryPort(Protocol):
    async def get_public_settings(self) -> PublicSettings: ...

    async def set_value(self, key: str, value: str) -> None: ...
