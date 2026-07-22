"""Judul default dari nama file: buang ekstensi + prefix situs pengunduh (vidssave.com dll)."""
import re
from pathlib import Path

# Prefix domain di awal nama (mis. "vidssave.com ", "ssyoutube.com-", "y2mate.net_").
_DOWNLOADER_PREFIX = re.compile(
    r"^\s*[\w-]+\.(?:com|net|io|to|cc|me|app|org|xyz)\s*[-_]?\s*", re.IGNORECASE
)


# Karakter yang dilarang di nama file Windows/macOS/Linux.
_ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def clean_title(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = _DOWNLOADER_PREFIX.sub("", stem).strip()
    return cleaned or stem


def download_name(title: str, source: str) -> str:
    """Nama berkas saat disimpan ke komputer: judul rekaman + ekstensi aslinya.

    Tanpa ini yang terunduh bernama UUID mentah — tidak ada gunanya di folder Unduhan.
    """
    safe = _ILLEGAL.sub("", title).strip().strip(".")
    return f"{(safe[:120] or 'rekaman')}{Path(source).suffix.lower()}"
