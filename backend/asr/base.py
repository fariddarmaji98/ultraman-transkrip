"""Kontrak ASR — satu interface, banyak provider (lokal / Groq / WhisperX nanti)."""
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass
class Segment:
    idx: int
    start_ms: int
    end_ms: int
    text: str
    speaker: str | None = None


class ASRProvider(Protocol):
    def transcribe(self, audio_path: Path, language: str) -> list[Segment]:
        """`language` = "auto" untuk deteksi otomatis, atau kode ISO (id/en/...)."""
        ...
