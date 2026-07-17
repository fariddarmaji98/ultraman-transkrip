"""Pemilih provider ASR berdasar config."""
from app.config import settings
from asr.base import ASRProvider, Segment
from asr.groq import GroqProvider
from asr.local_whisper import LocalWhisperProvider

__all__ = ["ASRProvider", "Segment", "get_provider"]


def get_provider() -> ASRProvider:
    if settings.asr_provider == "groq":
        return GroqProvider()
    return LocalWhisperProvider()
