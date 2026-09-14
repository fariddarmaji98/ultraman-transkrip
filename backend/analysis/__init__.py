"""Pemilih & resolver provider LLM (cermin `asr/__init__.py`)."""
from analysis.base import EmbeddingProvider, LLMProvider
from analysis.openai_compat import LLMError, OpenAICompatProvider
from app import runtime
from app.config import settings
from constants import LLM_PROVIDERS, LLM_TIMEOUT_S

__all__ = [
    "EmbeddingProvider", "LLMError", "LLMProvider",
    "catalog_of", "get_llm", "resolve",
]


def catalog_of(provider_id: str) -> dict:
    return next(p for p in LLM_PROVIDERS if p["id"] == provider_id)


def resolve(provider_id: str = "", model: str = "") -> dict:
    """Setelan efektif: katalog sebagai dasar, ditimpa env / pilihan user."""
    entry = catalog_of(provider_id or settings.llm_provider)
    base_url = entry["base_url"]
    if settings.llm_base_url and entry["id"] == settings.llm_provider:
        base_url = settings.llm_base_url  # escape hatch env, mis. Ollama di host lain
    # Custom URL: URL-nya datang dari runtime.json (diisi via UI), bukan katalog.
    if entry["id"] == "custom":
        base_url = runtime.custom_base_url()
    return {
        "provider": entry["id"],
        "base_url": base_url,
        "model": model or settings.llm_model or entry["default_model"],
        "api_key": runtime.llm_key(entry["id"]),
        "needs_key": entry["needs_key"],
    }


def get_llm(provider_id: str = "", model: str = "",
            timeout: int = LLM_TIMEOUT_S) -> OpenAICompatProvider:
    cfg = resolve(provider_id, model)
    return OpenAICompatProvider(cfg["base_url"], cfg["model"], cfg["api_key"], timeout)
