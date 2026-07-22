"""Cookies per-platform untuk yt-dlp (format Netscape `cookies.txt`).

Diperlakukan sebagai kredensial, sepola kunci API di ADR 0007: disimpan
server-side di `data/cookies/`, isinya tidak pernah dikirim balik ke browser.
"""
from pathlib import Path
from urllib.parse import urlparse

from app.config import settings
from constants import COOKIE_PLATFORMS


class CookieError(ValueError):
    """Berkas yang diunggah bukan cookies.txt yang bisa dipakai."""


def save(platform: str, raw: bytes) -> None:
    text = _decode(raw)
    if not _looks_like_netscape(text):
        raise CookieError(
            "bukan berkas cookies.txt format Netscape — ekspor ulang dengan "
            "ekstensi peramban yang menghasilkan format itu"
        )
    path = _path(platform)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def forget(platform: str) -> None:
    _path(platform).unlink(missing_ok=True)


def stored() -> set[str]:
    """Platform yang punya cookies — dipakai FE tanpa membocorkan isinya."""
    return {p["id"] for p in COOKIE_PLATFORMS if _path(p["id"]).exists()}


def for_url(url: str) -> Path | None:
    """Berkas cookies yang cocok dengan domain URL, bila ada."""
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    for entry in COOKIE_PLATFORMS:
        if any(host == d or host.endswith(f".{d}") for d in entry["domains"]):
            path = _path(entry["id"])
            return path if path.exists() else None
    return None


def _path(platform: str) -> Path:
    return settings.data_dir / "cookies" / f"{platform}.txt"


def _decode(raw: bytes) -> str:
    if len(raw) > 0 and b"\x00" in raw[:2048]:
        raise CookieError("berkas terlihat biner, bukan teks")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise CookieError("berkas bukan teks UTF-8") from exc


def _looks_like_netscape(text: str) -> bool:
    """Baris data Netscape = 7 kolom dipisah tab. Tanpa cek ini, mengunggah
    berkas keliru baru ketahuan saat unduhan gagal dengan pesan membingungkan."""
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        if len(line.split("\t")) >= 7:
            return True
    return False
