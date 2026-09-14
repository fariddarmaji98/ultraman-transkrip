"""Setelan yang bisa diubah dari UI saat aplikasi berjalan.

Disimpan ke `data/runtime.json` supaya pilihan bertahan lintas-restart.
Env selalu menang: bila env-nya diset, nilai dari file diabaikan (ADR 0005).

Kunci API LLM ikut tersimpan di file itu dalam bentuk plaintext — `data/` sudah
masuk .gitignore, tapi untuk deployment sungguhan pakai env (lihat README).
"""
import json
import os
from pathlib import Path

from app.config import settings
from asr.local_whisper import reset_model_cache
from constants import LLM_PROVIDER_IDS, LOCAL_MODEL_IDS

_MODEL_ENV = "TRANSKRIP_LOCAL_WHISPER_MODEL"
_LLM_ENV = "TRANSKRIP_LLM_PROVIDER"

_state: dict = {}


def load() -> None:
    """Startup: baca file, terapkan yang valid dan tidak dikunci env."""
    global _state
    _state = _read()
    _apply_asr_model()
    _apply_llm()


def set_local_model(model: str) -> None:
    settings.local_whisper_model = model
    reset_model_cache()
    _state["local_whisper_model"] = model
    _write()


def set_llm(provider: str, model: str, api_key: str | None = None,
            base_url: str | None = None) -> None:
    settings.llm_provider = provider
    settings.llm_model = model
    llm = _state.setdefault("llm", {})
    llm["provider"], llm["model"] = provider, model
    if api_key:
        llm.setdefault("keys", {})[provider] = api_key
    # Custom URL: base_url milik provider custom tersimpan sendiri; provider
    # bawaan tidak punya URL yang bisa diubah dari UI (katalog adalah sumbernya).
    if provider == "custom":
        if base_url:
            llm["custom_base_url"] = base_url.rstrip("/")
    _write()


def forget_llm_key(provider: str) -> None:
    _keys().pop(provider, None)
    _write()


def llm_key(provider: str) -> str:
    """Kunci provider: env (untuk provider aktif) menang atas yang tersimpan."""
    if provider == settings.llm_provider and settings.llm_api_key:
        return settings.llm_api_key
    return _keys().get(provider, "")


def custom_base_url() -> str:
    """Base URL provider custom tersimpan (dipakai hanya saat provider aktif)."""
    return (_state.get("llm") or {}).get("custom_base_url", "")


def providers_with_key() -> set[str]:
    """Provider yang punya kunci — dipakai FE tanpa membocorkan nilainya."""
    owned = set(_keys())
    if settings.llm_api_key:
        owned.add(settings.llm_provider)
    return owned


def _apply_asr_model() -> None:
    model = _state.get("local_whisper_model")
    if _MODEL_ENV not in os.environ and model in LOCAL_MODEL_IDS:
        settings.local_whisper_model = model


def _apply_llm() -> None:
    if _LLM_ENV in os.environ:
        return
    llm = _state.get("llm") or {}
    if llm.get("provider") in LLM_PROVIDER_IDS:
        settings.llm_provider = llm["provider"]
        settings.llm_model = llm.get("model") or ""


def _keys() -> dict:
    return _state.setdefault("llm", {}).setdefault("keys", {})


def _path() -> Path:
    return settings.data_dir / "runtime.json"


def _read() -> dict:
    try:
        return json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _write() -> None:
    _path().write_text(json.dumps(_state, indent=2), encoding="utf-8")
