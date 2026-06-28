from __future__ import annotations

from bento.domain.settings import PublicSettings
from bento.ports.settings import SettingsRepositoryPort


class GetSettingsUseCase:
    def __init__(self, *, settings: SettingsRepositoryPort) -> None:
        self._settings = settings

    async def execute(self) -> PublicSettings:
        return await self._settings.get_public_settings()
