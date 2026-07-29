"""Konfigurasi runtime — override lewat env (prefix TRANSKRIP_) atau .env."""
from pathlib import Path

from pydantic import field_validator
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

    # Path media disimpan APA ADANYA ke DB (`Recording.upload_path`), jadi bentuk
    # `data_dir` ikut permanen ke sana. DB yang ada sudah berisi baris absolut dan
    # baris relatif sekaligus, dan CAMPURAN itulah bahayanya: satu-satunya pembaca
    # baru (label pembicara lapis 0) harus bisa membuka berkas tanpa peduli baris
    # mana yang dibacanya. Diseragamkan ke absolut karena mayoritas sudah absolut.
    # HARGANYA: memindahkan atau mengganti nama folder proyek mematikan baris lama
    # — jalan keluarnya `scripts/repair_media_paths.py`, bukan mengedit DB manual.
    @field_validator("data_dir")
    @classmethod
    def _absolutkan(cls, v: Path) -> Path:
        return v.resolve()

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
