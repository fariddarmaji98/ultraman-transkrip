"""Seam capture — kontrak sumber media dari URL.

Di balik interface ini yt-dlp bisa ditukar (Cobalt dll) tanpa mengubah pemanggil,
pola yang sama dengan `ASRProvider` dan `LLMProvider`.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol

ProgressCb = Callable[[int], None]


class CaptureError(RuntimeError):
    """Gagal membaca/mengunduh dari platform. Pesannya sudah ramah untuk user."""


class UnsupportedUrl(CaptureError):
    """Platform tidak punya extractor, atau URL-nya bukan video."""


class NeedsAuth(CaptureError):
    """Video privat / butuh login — cookies menyusul di Fase C."""


@dataclass
class MediaInfo:
    title: str
    duration_ms: int | None
    filesize_bytes: int | None  # perkiraan; sering None sebelum unduh
    extractor: str              # nama platform menurut yt-dlp
    ext: str                    # perkiraan ekstensi hasil unduhan


class MediaSource(Protocol):
    def probe(self, url: str) -> MediaInfo:
        ...

    def fetch_video(
        self, url: str, dst_dir: Path, stem: str, on_progress: ProgressCb | None
    ) -> Path:
        """Unduh ke temp, pindah ke `dst_dir/stem.<ext>` hanya bila sukses."""
        ...
