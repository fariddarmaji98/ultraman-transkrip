"""Judul default dari nama file: buang ekstensi + prefix situs pengunduh (vidssave.com dll)."""
import re
from pathlib import Path

# Prefix domain di awal nama (mis. "vidssave.com ", "ssyoutube.com-", "y2mate.net_").
_DOWNLOADER_PREFIX = re.compile(
    r"^\s*[\w-]+\.(?:com|net|io|to|cc|me|app|org|xyz)\s*[-_]?\s*", re.IGNORECASE
)


def clean_title(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = _DOWNLOADER_PREFIX.sub("", stem).strip()
    return cleaned or stem
