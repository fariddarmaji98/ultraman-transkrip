"""Perbaiki `upload_path`/`media_path` yang tidak lagi menunjuk berkas nyata.

Dua sebab, satu obat. (1) Rekaman meeting lama menyimpan path RELATIF, karena
`data_dir` dulu belum dibekukan absolut di `app/config.py`. (2) Setelah absolut,
memindahkan atau mengganti nama folder proyek membuat baris lama menunjuk ke
tempat yang sudah tidak ada — dan seluruh rekaman tetap tampil sehat di daftar
riwayat sampai ada yang mengkliknya.

Obatnya sama: cari berkas bernama sama di bawah `data_dir` sekarang, lalu tulis
ulang path-nya. Aman dijalankan berulang; baris yang sudah benar tidak disentuh.

Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/repair_media_paths.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

KOLOM = {"upload_path": "uploads", "media_path": "media"}


def cari(nama: str, folder: str) -> Path | None:
    """Cari berkas bernama sama di lokasi `data_dir` yang berlaku sekarang."""
    kandidat = settings.data_dir / folder / nama
    return kandidat if kandidat.exists() else None


def perbaikan(lama: str | None, folder: str) -> str | None:
    """Balikkan None bila tak perlu atau tak bisa diperbaiki."""
    if not lama or Path(lama).exists():
        return None
    baru = cari(Path(lama).name, folder)
    return str(baru) if baru else None


def main() -> None:
    db = settings.data_dir / "transkrip.db"
    if not db.exists():
        print(f"DB belum ada di {db} — tidak ada yang diperbaiki.")
        return
    con = sqlite3.connect(db)
    rows = con.execute(f"SELECT id, {', '.join(KOLOM)} FROM recordings").fetchall()
    for rid, *nilai in rows:
        for (kolom, folder), lama in zip(KOLOM.items(), nilai):
            laporkan(con, rid, kolom, lama, perbaikan(lama, folder))
    con.commit()
    con.close()
    print(f"Selesai: {db}")


def laporkan(con: sqlite3.Connection, rid: int, kolom: str, lama, baru) -> None:
    if baru:
        con.execute(f"UPDATE recordings SET {kolom} = ? WHERE id = ?", (baru, rid))
        print(f"+ rec {rid} {kolom}: {baru}")
    elif lama and not Path(lama).exists():
        # Dikatakan, bukan didiamkan: berkasnya memang sudah tidak ada di mana pun.
        print(f"! rec {rid} {kolom}: {lama} hilang, tidak ada penggantinya")


main()
