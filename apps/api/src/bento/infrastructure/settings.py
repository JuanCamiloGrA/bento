from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Bento"
    app_version: str = "0.1.0"
    environment: str = "local"
    storage_backend: Literal["local", "telegram"] = "local"
    host: str = "127.0.0.1"
    api_port: int = 8000
    web_port: int = 5173
    worker_concurrency: int = Field(default=1, ge=1)
    telegram_bot_api_url: str = "http://telegram-bot-api:8081"
    telegram_bot_token: str | None = None
    data_dir: str = "/app/data"

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token)


@lru_cache
def get_settings() -> Settings:
    return Settings()