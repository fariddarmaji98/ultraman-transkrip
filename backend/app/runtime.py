"""Setelan yang bisa diubah dari UI saat aplikasi berjalan.

Disimpan ke `data/runtime.json` supaya pilihan bertahan lintas-restart.
Env var tetap menang: kalau TRANSKRIP_LOCAL_WHISPER_MODEL diset, file diabaikan.
"""
import json
import os
from pathlib import Path

from app.config import settings
from asr.local_whisper import reset_model_cache
from constants import LOCAL_MODEL_IDS

_ENV_KEY = "TRANSKRIP_LOCAL_WHISPER_MODEL"


def load() -> None:
    """Startup: terapkan model tersimpan bila masih valid dan tidak dikunci env."""
    if _ENV_KEY in os.environ:
        return
    model = _read().get("local_whisper_model")
    if model in LOCAL_MODEL_IDS:
        settings.local_whisper_model = model


def set_local_model(model: str) -> None:
    settings.local_whisper_model = model
    reset_model_cache()
    _write({"local_whisper_model": model})


def _path() -> Path:
    return settings.data_dir / "runtime.json"


def _read() -> dict:
    try:
        return json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _write(data: dict) -> None:
    _path().write_text(json.dumps(data, indent=2), encoding="utf-8")
