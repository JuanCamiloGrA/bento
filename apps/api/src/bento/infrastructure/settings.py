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
    telegram_api_id: str | None = None
    telegram_api_hash: str | None = None
    telegram_raw_chat_id: str | None = None
    telegram_thumbs_chat_id: str | None = None
    telegram_journal_chat_id: str | None = None
    telegram_min_interval_seconds: float = Field(default=0.05, ge=0)
    telegram_max_attempts: int = Field(default=3, ge=1)
    telegram_retry_base_delay_seconds: float = Field(default=0.25, ge=0)
    ocr_provider: Literal["disabled", "mock", "rapidocr"] = "disabled"
    embeddings_provider: Literal["disabled", "mock", "jina"] = "disabled"
    jina_model_path: str = "./data/models/jina-v5-omni-nano.gguf"
    data_dir: str = "/app/data"

    @property
    def telegram_configured(self) -> bool:
        values = (
            self.telegram_bot_token,
            self.telegram_api_id,
            self.telegram_api_hash,
            self.telegram_raw_chat_id,
            self.telegram_thumbs_chat_id,
            self.telegram_journal_chat_id,
        )
        return all(value is not None and str(value).strip() for value in values)


@lru_cache
def get_settings() -> Settings:
    return Settings()
