"""Kontrak ASR — satu interface, banyak provider (lokal / Groq / WhisperX nanti)."""
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol


@dataclass
class Segment:
    idx: int
    start_ms: int
    end_ms: int
    text: str
    speaker: str | None = None


# Callback progres opsional: dipanggil dgn persen (0-100) selama transkripsi.
ProgressCb = Callable[[int], None]


class ASRProvider(Protocol):
    def transcribe(
        self, audio_path: Path, language: str, on_progress: ProgressCb | None = None
    ) -> list[Segment]:
        """`language` = "auto" untuk deteksi otomatis, atau kode ISO (id/en/...)."""
        ...
