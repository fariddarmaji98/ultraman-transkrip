"""Migrasi sekali-jalan: tambah kolom `source_kind` & `source_url` ke `recordings`.

`create_all` hanya membuat tabel yang belum ada — tabel lama tidak ikut berubah,
jadi DB yang sudah berisi rekaman perlu ALTER manual. Aman dijalankan berulang.

Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/migrate_add_source_columns.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from constants import SOURCE_UPLOAD  # noqa: E402

COLUMNS = {
    "source_kind": f"TEXT NOT NULL DEFAULT '{SOURCE_UPLOAD}'",
    "source_url": "TEXT",
}


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
