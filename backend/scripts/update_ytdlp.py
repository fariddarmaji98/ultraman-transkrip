"""Perbarui yt-dlp ke rilis nightly terbaru.

Extractor rusak setiap situs berubah — ini penyebab kegagalan unduh nomor satu,
dan memperbaruinya bukan opsional (lihat planning §10).

Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/update_ytdlp.py
"""
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
CMD = ["uv", "pip", "install", "-U", "--prerelease=allow", "yt-dlp[default]"]


def installed_version() -> str:
    out = subprocess.run(
        [str(BACKEND / ".venv/Scripts/python.exe"), "-c",
         "import yt_dlp; print(yt_dlp.version.__version__)"],
        capture_output=True, text=True,
    )
    return out.stdout.strip() or "(tidak terbaca)"


def main() -> int:
    before = installed_version()
    print(f"versi sekarang : {before}")
    result = subprocess.run(CMD, cwd=BACKEND, env={
        **__import__("os").environ, "VIRTUAL_ENV": str(BACKEND / ".venv")
    })
    if result.returncode != 0:
        print("gagal memperbarui — pastikan `uv` ada di PATH", file=sys.stderr)
        return result.returncode
    after = installed_version()
    print(f"versi sesudah  : {after}")
    print("tidak ada perubahan" if before == after else "diperbarui")
    print("Restart backend agar versi baru dipakai.")
    return 0


sys.exit(main())
