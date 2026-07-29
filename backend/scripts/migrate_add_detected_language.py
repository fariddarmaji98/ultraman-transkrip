"""Migrasi sekali-jalan: tambah kolom `detected_language` ke `recordings`.

`create_all` hanya membuat tabel yang belum ada — tabel lama tidak ikut berubah,
jadi DB yang sudah berisi rekaman perlu ALTER manual. Aman dijalankan berulang.

Sengaja TIDAK mengisi baris lama. Bahasa yang terdeteksi hanya bisa diketahui
dengan menjalankan ASR; menebaknya dari `language` justru salah, karena kolom itu
menyimpan yang DIMINTA (hampir selalu "auto"). Rekaman lama baru terisi bila
ditranskrip ulang, dan NULL memang berarti "belum pernah dideteksi".

Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/migrate_add_detected_language.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

COLUMNS = {"detected_language": "TEXT"}


def existing_columns(con: sqlite3.Connection) -> set[str]:
    rows = con.execute("PRAGMA table_info(recordings)").fetchall()
    return {row[1] for row in rows}


def main() -> None:
    db = settings.data_dir / "transkrip.db"
    if not db.exists():
        print(f"DB belum ada di {db} — tidak perlu migrasi.")
        return
    con = sqlite3.connect(db)
    have = existing_columns(con)
    for name, ddl in COLUMNS.items():
        if name in have:
            print(f"- {name}: sudah ada, dilewati")
            continue
        con.execute(f"ALTER TABLE recordings ADD COLUMN {name} {ddl}")
        print(f"+ {name}: ditambahkan")
    con.commit()
    con.close()
    print(f"Selesai: {db}")


main()
