"""Konfigurasi runtime — override lewat env (prefix TRANSKRIP_) atau .env."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from constants import (
    DEFAULT_ASR_PROVIDER,
    DEFAULT_LANGUAGE,
    DEFAULT_LLM_PROVIDER,
    DEFAULT_LOCAL_MODEL,
    MEDIA_RETENTION_DAYS,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TRANSKRIP_", env_file=".env", extra="ignore"
    )

    data_dir: Path = Path("data")
    asr_provider: str = DEFAULT_ASR_PROVIDER
    local_whisper_model: str = DEFAULT_LOCAL_MODEL
    groq_api_key: str = ""
    default_language: str = DEFAULT_LANGUAGE
    media_retention_days: int = MEDIA_RETENTION_DAYS

    # LLM (ringkasan/chat). Kosong = ikut katalog constants / pilihan dari UI.
    llm_provider: str = DEFAULT_LLM_PROVIDER
    llm_model: str = ""
    llm_base_url: str = ""   # override, mis. Ollama di host lain
    llm_api_key: str = ""    # bila diset, mengunci kunci provider aktif

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.data_dir.as_posix()}/transkrip.db"

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.upload_dir, self.media_dir):
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
