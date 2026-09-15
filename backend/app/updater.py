"""Updater yt-dlp otomatis: saat startup + cek harian, tanpa restart backend.

Extractor yt-dlp rusak tiap situs berubah — repo ini memakai channel NIGHTLY
dengan aturan "update rutin, bukan opsional" (requirements.txt). Sebelumnya
update adalah langkah manual (scripts/update_ytdlp.py + restart) yang muncul
sebagai peringatan di UI — tidak layak tampil ke pengguna app yang dipublish.

Cara kerja:
- `maintenance_loop()` dijalankan lifespan app: sekali di awal (selalu update),
  lalu tidur 24 jam dan mengulang cek (update bila versi berumur >= 1 hari).
- Install lewat `uv pip install -U` (subprocess) ke venv yang sama.
- Setelah install, `importlib.reload(yt_dlp)` memuat kode baru KE DALAM proses
  yang sedang jalan. yt-dlp murni Python dan `YoutubeDL` dibuat per-panggilan
  (tidak ada instance lama yang tersimpan), jadi reload aman. Bila reload gagal,
  server tetap hidup dengan versi lama + pesan "perlu restart" — bukan crash.
- Selama berjalan, `status()` = `{updating: true, ...}` — frontend membacanya
  untuk splashscreen maintenance (interaksi diblok sampai selesai).

Antrean transkrip TIDAK dijeda: unduhan yang sedang berjalan memakai instance
YoutubeDL lama (Python menjaga kode lama tetap hidup untuk objek yang sudah
ada), dan unduhan baru otomatis memakai kode baru setelah reload.
"""
import asyncio
import importlib
import os
import subprocess
from datetime import date
from pathlib import Path

from loguru import logger

BACKEND = Path(__file__).resolve().parent.parent
# HANYA core yt-dlp, tanpa extras [default]: updater berjalan di dalam proses
# backend yang sedang memakai dependensinya (websockets, dll.) — mengganti
# paket yang sedang di-import Windows menimpa filenya dan mematikan uvicorn.
# Extras (curl_cffi, mutagen, dst.) di-install sekali lewat requirements.txt.
_CMD = ["uv", "pip", "install", "-U", "--prerelease=allow", "yt-dlp"]
_DAILY_S = 24 * 3600
# Startup: selalu update (permintaan eksplisit). Harian: hanya bila versi
# kemarin — uv yang "already satisfied" tiap hari hanya membebani jaringan.
_DAILY_MAX_AGE_DAYS = 1

_state: dict = {"updating": False, "message": "", "last_result": None}


def status() -> dict:
    """Dibaca route /api/maintenance — bentuknya stabil untuk frontend."""
    return {
        "updating": _state["updating"],
        "message": _state["message"],
        "last_result": _state["last_result"],
    }


def installed_version() -> str:
    out = subprocess.run(
        [str(BACKEND / ".venv/Scripts/python.exe"), "-c",
         "import yt_dlp; print(yt_dlp.version.__version__)"],
        capture_output=True, text=True,
    )
    return out.stdout.strip() or "(tidak terbaca)"


def _age_days(version: str) -> int | None:
    """Versi nightly berformat tanggal (2026.08.30.232658) — cermin health.py."""
    try:
        year, month, day = (int(p) for p in version.split(".")[:3])
        return (date.today() - date(year, month, day)).days
    except (ValueError, TypeError):
        return None


async def maintenance_loop() -> None:
    """Startup: update selalu. Lalu cek tiap 24 jam."""
    await run_update(force=True, reason="startup")
    while True:
        await asyncio.sleep(_DAILY_S)
        version = installed_version()
        age = _age_days(version)
        if age is None or age >= _DAILY_MAX_AGE_DAYS:
            await run_update(force=False, reason="harian")


async def run_update(force: bool, reason: str) -> None:
    """Jalankan satu siklus update + reload. Status dipantau lewat `status()`."""
    _state.update(updating=True, message="Memperbarui mesin unduh (yt-dlp)…")
    try:
        before = installed_version()
        result = await asyncio.to_thread(_install)
        if result.returncode != 0:
            _state["last_result"] = {
                "ok": False, "detail": "uv pip install gagal — cek log backend",
            }
            logger.warning("update yt-dlp gagal ({}): rc={}", reason, result.returncode)
            return
        after = installed_version()
        if before == after:
            _state["last_result"] = {"ok": True, "version": after, "updated": False}
            logger.info("yt-dlp sudah terbaru ({}, cek {})", after, reason)
            return
        if _reload():
            _state["last_result"] = {"ok": True, "version": after, "updated": True}
            logger.info("yt-dlp {} → {} ({}), dimuat ulang tanpa restart",
                        before, after, reason)
        else:
            # Install sukses tapi reload gagal — versi baru dipakai setelah
            # restart berikutnya; jangan digaduhkan ke pengguna.
            _state["last_result"] = {
                "ok": True, "version": after, "updated": True, "restart_needed": True,
            }
            logger.warning("yt-dlp diperbarui ke {} tapi reload gagal — dipakai "
                           "penuh setelah restart", after)
    finally:
        _state.update(updating=False, message="")


def _install() -> subprocess.CompletedProcess:
    """uv pip install ke venv backend (uv mendeteksi .venv dari cwd)."""
    return subprocess.run(
        _CMD, cwd=BACKEND,
        env={**os.environ, "VIRTUAL_ENV": str(BACKEND / ".venv")},
        capture_output=True, text=True,
    )


def _reload() -> bool:
    """Muat ulang modul yt_dlp yang baru diinstall ke proses ini."""
    try:
        import yt_dlp
        importlib.reload(yt_dlp)
        return True
    except Exception as exc:  # reload gagal tidak boleh mematikan server
        logger.warning("reload yt_dlp gagal: {}", exc)
        return False
