"""Adapter yt-dlp: probe tanpa mengunduh, lalu unduh video dengan cap resolusi.

Dipakai sebagai library (bukan subprocess) supaya dapat info terstruktur dan
progress hook tanpa mem-parse stdout.
"""
import shutil
import tempfile
from pathlib import Path

import yt_dlp

from capture.base import (
    CaptureError,
    MediaInfo,
    NeedsAuth,
    ProgressCb,
    UnsupportedUrl,
)
from constants import DOWNLOAD_MAX_HEIGHT

class _Silent:
    """yt-dlp tetap mencetak ke konsol meski `quiet`; kita menerjemahkan error sendiri."""

    def debug(self, msg): pass
    def info(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass


_QUIET = {
    "quiet": True, "no_warnings": True, "noplaylist": True,
    "no_color": True, "logger": _Silent(),
}


class YtDlpSource:
    def probe(self, url: str) -> MediaInfo:
        with yt_dlp.YoutubeDL(_QUIET) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
            except yt_dlp.utils.DownloadError as exc:
                raise _translate(exc) from exc
        return _to_info(_single(info))

    def fetch_video(self, url, dst_dir: Path, stem: str, on_progress=None) -> Path:
        with tempfile.TemporaryDirectory(prefix="transkrip-dl-") as tmp:
            tmp_dir = Path(tmp)
            self._download(url, tmp_dir, on_progress)
            produced = _only_file(tmp_dir)
            dst = dst_dir / f"{stem}{produced.suffix.lower()}"
            shutil.move(str(produced), dst)  # pindah hanya setelah sukses
        return dst

    def _download(self, url: str, tmp_dir: Path, on_progress: ProgressCb | None) -> None:
        seen = {"pct": 0}
        opts = {
            **_QUIET,
            "format": _FORMAT,
            "outtmpl": str(tmp_dir / "media.%(ext)s"),
            "merge_output_format": "mp4",
            "progress_hooks": [lambda d: _report(d, seen, on_progress)],
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                ydl.download([url])
            except yt_dlp.utils.DownloadError as exc:
                raise _translate(exc) from exc


_FORMAT = (
    f"bestvideo[height<={DOWNLOAD_MAX_HEIGHT}]+bestaudio/"
    f"best[height<={DOWNLOAD_MAX_HEIGHT}]/best"
)


def _report(d: dict, seen: dict, on_progress: ProgressCb | None) -> None:
    """Video & audio diunduh sebagai dua stream terpisah — persennya reset ke 0 di
    stream kedua. Tanpa penjaga ini, bar di UI terlihat mundur."""
    if not on_progress or d.get("status") != "downloading":
        return
    total = d.get("total_bytes") or d.get("total_bytes_estimate")
    if not total:
        return
    pct = min(99, int(100 * d.get("downloaded_bytes", 0) / total))
    if pct > seen["pct"]:
        seen["pct"] = pct
        on_progress(pct)


def _single(info: dict) -> dict:
    """Ambil satu video; `noplaylist` sudah aktif tapi sebagian extractor tetap membungkus."""
    entries = info.get("entries")
    if not entries:
        return info
    first = next((e for e in entries if e), None)
    if first is None:
        raise UnsupportedUrl("URL ini tidak berisi video")
    return first


def _to_info(info: dict) -> MediaInfo:
    duration = info.get("duration")
    size = info.get("filesize") or info.get("filesize_approx")
    return MediaInfo(
        title=info.get("title") or "Tanpa judul",
        duration_ms=int(duration * 1000) if duration else None,
        filesize_bytes=int(size) if size else None,
        extractor=info.get("extractor_key") or info.get("extractor") or "?",
        ext=info.get("ext") or "mp4",
    )


def _only_file(folder: Path) -> Path:
    files = [p for p in folder.iterdir() if p.is_file()]
    if not files:
        raise CaptureError("unduhan selesai tapi tidak ada file yang dihasilkan")
    return max(files, key=lambda p: p.stat().st_size)


def _translate(exc: Exception) -> CaptureError:
    """Pesan yt-dlp → pesan Indonesia yang bisa ditindaklanjuti user."""
    low = str(exc).lower()
    if "not a valid url" in low or "invalid url" in low:
        return UnsupportedUrl("URL tidak valid")
    if "unsupported url" in low or "no video" in low:
        return UnsupportedUrl("platform atau URL ini belum didukung")
    if any(k in low for k in ("private", "log in", "login", "sign in", "cookies")):
        return NeedsAuth("video privat atau butuh login — belum didukung")
    if any(k in low for k in ("unavailable", "not found", "removed", "410", "404")):
        return CaptureError("video tidak ditemukan atau sudah dihapus")
    if "geo" in low or "your country" in low:
        return CaptureError("video dibatasi wilayah")
    return CaptureError(f"gagal membaca video dari platform: {_first_line(exc)}")


def _first_line(exc: Exception) -> str:
    return str(exc).strip().splitlines()[0][:200]
