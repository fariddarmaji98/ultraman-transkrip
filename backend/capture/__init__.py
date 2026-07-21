"""Pemilih sumber media dari URL (cermin `asr/__init__.py`)."""
from capture.base import (
    CaptureError,
    MediaInfo,
    MediaSource,
    NeedsAuth,
    UnsupportedUrl,
)
from capture.ytdlp import YtDlpSource

__all__ = [
    "CaptureError", "MediaInfo", "MediaSource", "NeedsAuth",
    "UnsupportedUrl", "get_source",
]


def get_source() -> MediaSource:
    return YtDlpSource()
