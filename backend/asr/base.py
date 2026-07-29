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


@dataclass
class TranscriptResult:
    """Hasil ASR: segmen + bahasa yang benar-benar didengar.

    Bahasa ikut di balikan, bukan jadi atribut samping pada provider, karena ia
    memang HASIL transkripsi — bukan efek sampingnya. Pola yang sama dipakai
    `MediaSource.probe()` yang mengembalikan `MediaInfo`.

    `language` **None bila tidak diketahui**, dan itu keadaan yang wajar: pada
    permintaan bahasa eksplisit, provider hanya memantulkan kembali apa yang
    diminta — memanggilnya "terdeteksi" akan menghapus jejak bahwa itu bukan deteksi.
    """
    segments: list[Segment]
    language: str | None = None


class ASRProvider(Protocol):
    def transcribe(
        self, audio_path: Path, language: str, on_progress: ProgressCb | None = None
    ) -> TranscriptResult:
        """`language` = "auto" untuk deteksi otomatis, atau kode ISO (id/en/...)."""
        ...
