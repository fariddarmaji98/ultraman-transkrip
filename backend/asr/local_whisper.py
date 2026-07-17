"""Provider lokal: faster-whisper (CTranslate2, int8, CPU). Model lazy-load & di-cache."""
from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import settings
from asr.base import Segment


@lru_cache(maxsize=1)
def _model() -> WhisperModel:
    return WhisperModel(
        settings.local_whisper_model, device="cpu", compute_type="int8"
    )


class LocalWhisperProvider:
    def transcribe(self, audio_path: Path, language: str) -> list[Segment]:
        lang = None if language == "auto" else language
        segments, _ = _model().transcribe(
            str(audio_path), language=lang, vad_filter=True
        )
        return [_to_segment(i, s) for i, s in enumerate(segments)]


def _to_segment(idx: int, s) -> Segment:
    return Segment(
        idx=idx,
        start_ms=int(s.start * 1000),
        end_ms=int(s.end * 1000),
        text=s.text.strip(),
    )
