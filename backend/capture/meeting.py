"""Sesi rekaman meeting: simpan potongan per-`seq`, lalu sambung jadi satu file.

Kenapa berkas ber-nomor, bukan append ke satu file: potongan datang lewat HTTP
terpisah, jadi bisa tiba tak berurutan atau terkirim ulang saat retry. Menulis
`000007.part` membuat kiriman ganda **menimpa dirinya sendiri** dan urutan
ditentukan saat menyambung — dua masalah hilang tanpa penguncian.

Sambungannya byte-per-byte apa adanya: WebM dari `MediaRecorder` hanya menaruh
header di potongan pertama, jadi potongan berikutnya memang harus menempel
mentah — bukan diperlakukan sebagai berkas utuh masing-masing.
"""
import shutil
from pathlib import Path

from app.config import settings
from constants import MEETING_CHUNK_SUFFIX


def session_dir(recording_id: int) -> Path:
    return settings.data_dir / "meeting" / str(recording_id)


def save_chunk(recording_id: int, seq: int, data: bytes) -> None:
    folder = session_dir(recording_id)
    folder.mkdir(parents=True, exist_ok=True)
    # Nama berlapis nol supaya urutan leksikografis = urutan waktu.
    (folder / f"{seq:06d}{MEETING_CHUNK_SUFFIX}").write_bytes(data)


def _parts(recording_id: int) -> list[Path]:
    folder = session_dir(recording_id)
    if not folder.exists():
        return []
    return sorted(folder.glob(f"*{MEETING_CHUNK_SUFFIX}"))


def received_bytes(recording_id: int) -> int:
    return sum(p.stat().st_size for p in _parts(recording_id))


def assemble(recording_id: int, dst: Path) -> int:
    """Sambung semua potongan ke `dst`. Mengembalikan jumlah byte yang ditulis."""
    parts = _parts(recording_id)
    if not parts:
        return 0
    dst.parent.mkdir(parents=True, exist_ok=True)
    with dst.open("wb") as out:
        for part in parts:
            out.write(part.read_bytes())
    return dst.stat().st_size


def discard(recording_id: int) -> None:
    """Buang potongan mentah — dipanggil setelah tersambung atau saat sesi dibatalkan."""
    shutil.rmtree(session_dir(recording_id), ignore_errors=True)
