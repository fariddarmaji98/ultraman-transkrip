"""Provider lokal: faster-whisper (CTranslate2, int8, CPU). Model lazy-load & di-cache.

Lapor progres per segmen (fase transkripsi dipetakan ke 30-90%).
"""
from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import settings
from asr.base import ProgressCb, Segment


@lru_cache(maxsize=1)
def _model() -> WhisperModel:
    return WhisperModel(
        settings.local_whisper_model, device="cpu", compute_type="int8"
    )


def reset_model_cache() -> None:
    """Dipanggil saat model diganti dari UI; model baru dimuat di transkrip berikutnya."""
    _model.cache_clear()


class LocalWhisperProvider:
    def transcribe(self, audio_path, language, on_progress: ProgressCb | None = None):
        lang = None if language == "auto" else language
        segments, info = _model().transcribe(
            str(audio_path), language=lang, vad_filter=True
        )
        return list(_iter_segments(segments, info, on_progress))


def _iter_segments(segments, info, on_progress):
    for i, s in enumerate(segments):
        yield _to_segment(i, s)
        if on_progress and info.duration:
            on_progress(min(90, 30 + int(60 * s.end / info.duration)))


def _to_segment(idx: int, s) -> Segment:
    return Segment(
        idx=idx,
        start_ms=int(s.start * 1000),
        end_ms=int(s.end * 1000),
        text=s.text.strip(),
    )
